/**
 * Tests for the scripts check and the Inter fallback in src/shared/
 * (milestone 13). Run `node tools/fetch-test-fonts.mjs` once first: without
 * the Noto fonts, the tests that need them are skipped.
 *
 * Usage: node tests/js/text-test.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import decompress from 'woff2-encoder/decompress';

// The sources import local files without the extension, as webpack allows.
register( './resolve-js.mjs', import.meta.url );

// fontkit's Indic shaper expects this global, as wp-admin provides it
// (WordPress's regenerator-runtime script, a dependency of the editor).
globalThis.regeneratorRuntime = ( await import( 'regenerator-runtime' ) ).default;
const { missingCharacters, scriptOf, scriptsOf } = await import(
	'../../src/shared/scripts.js'
);
const { layoutWithFallback } = await import(
	'../../src/shared/text-layout.js'
);

const root = join( dirname( fileURLToPath( import.meta.url ) ), '..', '..' );
let failed = 0;
let skipped = 0;

function check( name, condition, detail = '' ) {
	if ( condition ) {
		console.log( 'ok   ' + name );
	} else {
		failed++;
		console.log( 'FAIL ' + name + ( detail ? ': ' + detail : '' ) );
	}
}

async function noto( name ) {
	const file = join( root, 'tests', 'fonts', name + '-400.woff2' );
	if ( ! existsSync( file ) ) {
		return null;
	}
	return fontkit.create( Buffer.from( await decompress( readFileSync( file ) ) ) );
}

const inter = fontkit.create(
	readFileSync( join( root, 'fonts', 'inter', 'Inter-Regular.ttf' ) )
);

function box( content, width = 80 ) {
	return {
		type: 'text',
		content,
		x: 0,
		y: 0,
		width,
		height: 12,
		size: 18,
		align: 'center',
		uppercase: false,
	};
}

function person( firstName, lastName = '' ) {
	return { firstName, lastName, username: '', answers: {} };
}

// Scripts.
check( 'scriptOf: hiragana is Japanese', scriptOf( 'や' ).id === 'japanese' );
check( 'scriptOf: kanji alone is Han', scriptOf( '山' ).id === 'han' );
check( 'scriptOf: Hangul is Korean', scriptOf( '김' ).id === 'korean' );
check( 'scriptOf: Devanagari', scriptOf( 'र' ).id === 'devanagari' );
check( 'scriptOf: Arabic', scriptOf( 'م' ).id === 'arabic' );
check( 'scriptOf: Ł is Latin', scriptOf( 'Ł' ).id === 'latin' );
check( 'scriptOf: an emoji is other', scriptOf( '😀' ).id === 'other' );
check(
	'scriptsOf: kanji with kana is only Japanese',
	scriptsOf( [ '山', 'や' ] ).join() === 'japanese'
);
check(
	'scriptsOf: each script once, in order',
	scriptsOf( [ 'م', '김', 'ر' ] ).join() === 'korean,arabic'
);

// Missing characters.
check(
	'Inter has every Latin, Greek and Cyrillic letter tested',
	missingCharacters( inter, 'Zoë Łukasz Ştefan Nguyễn Γιώργος Алексей …' )
		.length === 0
);
check(
	'Inter lacks CJK, each character listed once',
	missingCharacters( inter, '山田 山' ).join() === '山,田'
);
check(
	'spaces, joiners and variation selectors are not missing',
	missingCharacters( inter, 'a b‍c️' ).length === 0
);

// Inter alone: nothing to fall back to.
const cjkInInter = layoutWithFallback( inter, null, box( '{first_name}' ), person( '山田' ) );
check(
	'Inter with a Japanese name: missing, no fallback',
	cjkInInter.missing.length === 2 && ! cjkInInter.fallback
);

const jp = await noto( 'NotoSansJP' );
const arabic = await noto( 'NotoSansArabic' );
const devanagari = await noto( 'NotoSansDevanagari' );
if ( ! jp || ! arabic || ! devanagari ) {
	skipped++;
	console.log( 'skip the Noto tests: run node tools/fetch-test-fonts.mjs first' );
} else {
	const japanese = layoutWithFallback( jp, inter, box( '{full_name}' ), person( '山田', '太郎' ) );
	check(
		'Noto Sans JP prints a Japanese name itself',
		! japanese.fallback && japanese.missing.length === 0
	);
	const polish = layoutWithFallback( jp, inter, box( '{full_name}' ), person( 'Łukasz', 'Żółć' ) );
	check(
		'Noto Sans JP lacks Ł, so a Polish name prints in Inter',
		polish.fallback && polish.missing.length === 0
	);
	const plain = layoutWithFallback( jp, inter, box( '{full_name}' ), person( 'Maria', 'Garcia' ) );
	check( 'Noto Sans JP keeps a plain Latin name', ! plain.fallback );
	const mixed = layoutWithFallback(
		arabic,
		inter,
		box( '{first_name} · {last_name}', 200 ),
		person( 'محمد', 'Egypt' )
	);
	check(
		'Arabic mixed with Latin: no font has both, missing reported',
		! mixed.fallback && mixed.missing.includes( 'E' )
	);
	const long = layoutWithFallback(
		devanagari,
		inter,
		box( '{full_name}', 20 ),
		person( 'राहुल', 'शर्मा क्षत्रिय चक्रवर्ती' )
	);
	const beforeEllipsis = [ ...long.text.replace( /…$/, '' ) ].pop();
	check(
		'cut Devanagari text ends with the ellipsis after a whole syllable',
		long.overflow &&
			long.text.endsWith( '…' ) &&
			! /^[\p{M}्]$/u.test( beforeEllipsis ),
		long.text
	);
	check( 'Noto Sans Devanagari has the ellipsis', long.missing.length === 0 );
}

console.log( '' );
if ( failed ) {
	console.log( failed + ' failed' );
	process.exit( 1 );
}
console.log( 'All passed' + ( skipped ? ' (some skipped)' : '' ) );
