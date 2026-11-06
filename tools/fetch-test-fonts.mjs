/**
 * Downloads the Noto fonts the JavaScript tests use into tests/fonts/
 * (ignored by Git: about 9 MB), the same files the WordPress Font Library
 * installs from its Google Fonts collection: weight 400, upright, WOFF2.
 *
 * Usage: node tools/fetch-test-fonts.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const COLLECTION =
	'https://s.w.org/images/fonts/wp-6.7/collections/google-fonts-with-preview.json';
const FAMILIES = [
	'Noto Sans JP',
	'Noto Sans KR',
	'Noto Sans SC',
	'Noto Sans Devanagari',
	'Noto Sans Bengali',
	'Noto Sans Tamil',
	'Noto Sans Arabic',
	'Noto Sans Hebrew',
	'Noto Sans Thai',
];

const out = join( dirname( fileURLToPath( import.meta.url ) ), '..', 'tests', 'fonts' );
mkdirSync( out, { recursive: true } );

const collection = await ( await fetch( COLLECTION ) ).json();
const all = collection.font_families.map( ( f ) => f.font_family_settings );

for ( const family of FAMILIES ) {
	const file = join( out, family.replace( /\s/g, '' ) + '-400.woff2' );
	if ( existsSync( file ) ) {
		console.log( 'Already there:', family );
		continue;
	}
	const settings = all.find( ( f ) => f.name === family );
	const face =
		settings &&
		settings.fontFace.find(
			( f ) => String( f.fontWeight ) === '400' && f.fontStyle === 'normal'
		);
	if ( ! face ) {
		console.log( 'Not in the collection:', family );
		continue;
	}
	const url = Array.isArray( face.src ) ? face.src[ 0 ] : face.src;
	const bytes = Buffer.from( await ( await fetch( url ) ).arrayBuffer() );
	writeFileSync( file, bytes );
	console.log( 'Downloaded:', family, Math.round( bytes.length / 1024 ) + ' KB' );
}
