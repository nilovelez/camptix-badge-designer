/**
 * Characters a font cannot print, grouped by writing system (script), and
 * the font to suggest for each one: the Noto family the WordPress Font
 * Library installs from Google Fonts (milestone 13, after bor0's review).
 *
 * The scripts are matched with Unicode property escapes built at run time,
 * so the build leaves them as they are instead of expanding them.
 */

import { __ } from '@wordpress/i18n';

/*
 * In the order they are checked. Japanese comes before Chinese: kanji are
 * Han characters, so a text is Japanese when it also has kana. Han alone
 * could be Chinese or Japanese.
 */
const SCRIPTS = [
	{
		id: 'japanese',
		pattern: 'Hiragana|Katakana',
		label: __( 'Japanese', 'camptix-badge-designer' ),
		font: 'Noto Sans JP',
	},
	{
		id: 'han',
		pattern: 'Han',
		label: __( 'Chinese or Japanese (kanji)', 'camptix-badge-designer' ),
		font: 'Noto Sans SC, Noto Sans TC or Noto Sans JP',
	},
	{
		id: 'korean',
		pattern: 'Hangul',
		label: __( 'Korean', 'camptix-badge-designer' ),
		font: 'Noto Sans KR',
	},
	{
		id: 'devanagari',
		pattern: 'Devanagari',
		label: __( 'Devanagari', 'camptix-badge-designer' ),
		font: 'Noto Sans Devanagari',
	},
	{
		id: 'bengali',
		pattern: 'Bengali',
		label: __( 'Bengali', 'camptix-badge-designer' ),
		font: 'Noto Sans Bengali',
	},
	{
		id: 'tamil',
		pattern: 'Tamil',
		label: __( 'Tamil', 'camptix-badge-designer' ),
		font: 'Noto Sans Tamil',
	},
	{
		id: 'telugu',
		pattern: 'Telugu',
		label: __( 'Telugu', 'camptix-badge-designer' ),
		font: 'Noto Sans Telugu',
	},
	{
		id: 'kannada',
		pattern: 'Kannada',
		label: __( 'Kannada', 'camptix-badge-designer' ),
		font: 'Noto Sans Kannada',
	},
	{
		id: 'malayalam',
		pattern: 'Malayalam',
		label: __( 'Malayalam', 'camptix-badge-designer' ),
		font: 'Noto Sans Malayalam',
	},
	{
		id: 'gujarati',
		pattern: 'Gujarati',
		label: __( 'Gujarati', 'camptix-badge-designer' ),
		font: 'Noto Sans Gujarati',
	},
	{
		id: 'gurmukhi',
		pattern: 'Gurmukhi',
		label: __( 'Gurmukhi', 'camptix-badge-designer' ),
		font: 'Noto Sans Gurmukhi',
	},
	{
		id: 'oriya',
		pattern: 'Oriya',
		label: __( 'Odia', 'camptix-badge-designer' ),
		font: 'Noto Sans Oriya',
	},
	{
		id: 'sinhala',
		pattern: 'Sinhala',
		label: __( 'Sinhala', 'camptix-badge-designer' ),
		font: 'Noto Sans Sinhala',
	},
	{
		id: 'arabic',
		pattern: 'Arabic',
		label: __( 'Arabic', 'camptix-badge-designer' ),
		font: 'Noto Sans Arabic',
	},
	{
		id: 'hebrew',
		pattern: 'Hebrew',
		label: __( 'Hebrew', 'camptix-badge-designer' ),
		font: 'Noto Sans Hebrew',
	},
	{
		id: 'thai',
		pattern: 'Thai',
		label: __( 'Thai', 'camptix-badge-designer' ),
		font: 'Noto Sans Thai',
	},
	{
		id: 'lao',
		pattern: 'Lao',
		label: __( 'Lao', 'camptix-badge-designer' ),
		font: 'Noto Sans Lao',
	},
	{
		id: 'khmer',
		pattern: 'Khmer',
		label: __( 'Khmer', 'camptix-badge-designer' ),
		font: 'Noto Sans Khmer',
	},
	{
		id: 'myanmar',
		pattern: 'Myanmar',
		label: __( 'Burmese', 'camptix-badge-designer' ),
		font: 'Noto Sans Myanmar',
	},
	{
		id: 'georgian',
		pattern: 'Georgian',
		label: __( 'Georgian', 'camptix-badge-designer' ),
		font: 'Noto Sans Georgian',
	},
	{
		id: 'armenian',
		pattern: 'Armenian',
		label: __( 'Armenian', 'camptix-badge-designer' ),
		font: 'Noto Sans Armenian',
	},
	{
		id: 'ethiopic',
		pattern: 'Ethiopic',
		label: __( 'Ethiopic', 'camptix-badge-designer' ),
		font: 'Noto Sans Ethiopic',
	},
	// Inter covers these, so they only show up with another font.
	{
		id: 'latin',
		pattern: 'Latin',
		label: __( 'Latin', 'camptix-badge-designer' ),
		font: 'Inter',
	},
	{
		id: 'greek',
		pattern: 'Greek',
		label: __( 'Greek', 'camptix-badge-designer' ),
		font: 'Inter',
	},
	{
		id: 'cyrillic',
		pattern: 'Cyrillic',
		label: __( 'Cyrillic', 'camptix-badge-designer' ),
		font: 'Inter',
	},
].map( ( script ) => ( {
	...script,
	regexp: new RegExp(
		'^(?:' +
			script.pattern
				.split( '|' )
				.map( ( name ) => '\\p{Script=' + name + '}' )
				.join( '|' ) +
			')$',
		'u'
	),
} ) );

// Emoji, symbols and anything else: no font to suggest.
const OTHER = {
	id: 'other',
	label: __( 'Emoji, symbols or other characters', 'camptix-badge-designer' ),
	font: '',
};

/*
 * Characters a font needs no glyph for: spaces, invisible format characters
 * (joiners, direction marks) and variation selectors. The shaper handles
 * them, and most fonts lack them.
 */
const IGNORED = new RegExp(
	'^[\\p{White_Space}\\p{Cf}\\p{Variation_Selector}]$',
	'u'
);

/**
 * Characters of a text a font has no glyph for, each listed once.
 *
 * @param {Object} font Fontkit font.
 * @param {string} text Text.
 * @return {string[]} Missing characters.
 */
export function missingCharacters( font, text ) {
	const missing = [];
	for ( const char of text ) {
		if ( IGNORED.test( char ) || missing.includes( char ) ) {
			continue;
		}
		if ( ! font.hasGlyphForCodePoint( char.codePointAt( 0 ) ) ) {
			missing.push( char );
		}
	}
	return missing;
}

/**
 * The script of one character.
 *
 * @param {string} char One character.
 * @return {{id: string, label: string, font: string}} Script.
 */
export function scriptOf( char ) {
	for ( const script of SCRIPTS ) {
		if ( script.regexp.test( char ) ) {
			return script;
		}
	}
	return OTHER;
}

/**
 * The scripts of some characters, each once, in a stable order. Japanese
 * replaces Han when both appear, since kanji are part of Japanese.
 *
 * @param {string[]} chars Characters.
 * @return {string[]} Script ids.
 */
export function scriptsOf( chars ) {
	const ids = new Set( chars.map( ( char ) => scriptOf( char ).id ) );
	if ( ids.has( 'japanese' ) ) {
		ids.delete( 'han' );
	}
	const order = SCRIPTS.map( ( script ) => script.id ).concat( OTHER.id );
	return order.filter( ( id ) => ids.has( id ) );
}

/**
 * A script by id.
 *
 * @param {string} id Script id.
 * @return {{id: string, label: string, font: string}} Script.
 */
export function scriptById( id ) {
	return SCRIPTS.find( ( script ) => script.id === id ) || OTHER;
}
