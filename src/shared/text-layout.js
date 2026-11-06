/**
 * Text layout shared by the editor and the PDF generator, so the screen
 * and the paper match: the same variables, the same font metrics (from
 * fontkit, as pdf-lib uses them) and the same rules.
 *
 * Text boxes hold one line, never two (decided by Nilo). Text that does not
 * fit at the size chosen shrinks, down to SHRINK_LIMIT of that size. If it
 * still does not fit, it is cut after the last whole character that fits
 * and ends with an ellipsis, so its beginning stays readable, and the
 * editor warns.
 *
 * Box positions are in millimeters; font sizes in points.
 */

import { __ } from '@wordpress/i18n';
import { missingCharacters } from './scripts';

const MM_PER_PT = 25.4 / 72;

// Text may shrink to 80% of its size to fit its box.
export const SHRINK_LIMIT = 0.8;

// Cut text ends with the ellipsis character (U+2026), not three periods.
const ELLIPSIS = '…';

// Characters that separate two variables, as in "{job} · {country}".
const SEPARATOR = '[·•|/,;:\\u2013\\u2014-]';
const SEPARATOR_AT_END = new RegExp( '\\s*' + SEPARATOR + '+\\s*$' );
const SEPARATOR_AT_START = new RegExp( '^\\s*' + SEPARATOR + '+\\s*' );

/**
 * Variables a text box can hold.
 *
 * @param {Array<{key: string, label: string}>} questions Event questions.
 * @return {Array<{token: string, label: string}>} Variables.
 */
export function textVariables( questions = [] ) {
	const variables = [
		{
			token: '{first_name}',
			label: __( 'First name', 'camptix-badge-designer' ),
		},
		{
			token: '{last_name}',
			label: __( 'Last name', 'camptix-badge-designer' ),
		},
		{
			token: '{full_name}',
			label: __( 'Full name', 'camptix-badge-designer' ),
		},
		{
			token: '{username}',
			label: __(
				'WordPress.org username (@username)',
				'camptix-badge-designer'
			),
		},
	];
	for ( const question of questions ) {
		variables.push( {
			token: '{question:' + question.key + '}',
			label: question.label,
		} );
	}
	return variables;
}

/**
 * Value of one variable for an attendee.
 *
 * @param {string} match    The variable as typed.
 * @param {string} name     Its name.
 * @param {string} key      Its key, for questions.
 * @param {Object} attendee Attendee.
 * @return {string} Value; the variable as typed when it is unknown.
 */
function variableValue( match, name, key, attendee ) {
	if ( name === 'first_name' ) {
		return attendee.firstName;
	}
	if ( name === 'last_name' ) {
		return attendee.lastName;
	}
	if ( name === 'full_name' ) {
		return ( attendee.firstName + ' ' + attendee.lastName ).trim();
	}
	// As the HTML badges print it: @username, or nothing without one.
	if ( name === 'username' ) {
		return attendee.username ? '@' + attendee.username : '';
	}
	if ( name === 'question' && key ) {
		return ( attendee.answers && attendee.answers[ key ] ) || '';
	}
	return match;
}

/**
 * Replaces the variables with the attendee's data. Unknown variables are
 * left as typed, so a typo shows on the badge instead of vanishing.
 *
 * An empty variable takes one separator next to it with it, so
 * "{job} · {country}" gives "Italy", not "· Italy": the one before it when
 * there is text before, otherwise the one after it.
 *
 * @param {string} content  Text with variables.
 * @param {Object} attendee Attendee from the REST API.
 * @return {string} Text.
 */
export function resolveText( content, attendee ) {
	// Literal text and variables, in order.
	const parts = [];
	const pattern = /\{([a-z_]+)(?::([a-z0-9-]+))?\}/g;
	let last = 0;
	let match;
	while ( ( match = pattern.exec( content ) ) !== null ) {
		parts.push( { literal: content.slice( last, match.index ) } );
		parts.push( {
			value: variableValue(
				match[ 0 ],
				match[ 1 ],
				match[ 2 ],
				attendee
			),
		} );
		last = pattern.lastIndex;
	}
	parts.push( { literal: content.slice( last ) } );

	for ( let i = 0; i < parts.length; i++ ) {
		if ( parts[ i ].value !== '' ) {
			continue;
		}
		const before = parts[ i - 1 ];
		const after = parts[ i + 1 ];
		const trimmedBefore = before.literal.replace( SEPARATOR_AT_END, '' );
		const textBefore = (
			parts
				.slice( 0, i - 1 )
				.map( ( part ) => part.literal ?? part.value )
				.join( '' ) + trimmedBefore
		).trim();
		if ( textBefore && SEPARATOR_AT_END.test( before.literal ) ) {
			before.literal = trimmedBefore;
		} else if ( after && SEPARATOR_AT_START.test( after.literal ) ) {
			after.literal = after.literal.replace( SEPARATOR_AT_START, '' );
		}
	}

	return parts.map( ( part ) => part.literal ?? part.value ).join( '' );
}

/**
 * Width of a text in millimeters.
 *
 * @param {Object} font Fontkit font.
 * @param {string} text Text.
 * @param {number} size Size in points.
 * @return {number} Width in mm.
 */
export function textWidth( font, text, size ) {
	const run = font.layout( text );
	return ( run.advanceWidth / font.unitsPerEm ) * size * MM_PER_PT;
}

/**
 * A text split into the characters a reader sees (grapheme clusters), so a
 * cut never separates a letter from its accent or an Indic consonant from
 * its vowel sign.
 *
 * @param {string} text Text.
 * @return {string[]} Characters.
 */
function graphemes( text ) {
	if ( typeof Intl !== 'undefined' && Intl.Segmenter ) {
		const segmenter = new Intl.Segmenter( undefined, {
			granularity: 'grapheme',
		} );
		return Array.from(
			segmenter.segment( text ),
			( part ) => part.segment
		);
	}
	return Array.from( text );
}

/**
 * Lays out the text of a box for one attendee, falling back to Inter when
 * the box's font cannot print every character and Inter can (milestone 13):
 * a CJK Noto font lacks some Central European letters, for example. The
 * whole text uses one font, never a mix, so measuring, shrinking and cutting
 * work as with a single font. The ellipsis of cut text counts too.
 *
 * @param {Object}      font     Fontkit font of the box's family and weight.
 * @param {Object|null} fallback Fontkit font of Inter at the closest weight,
 *                               or null when the box already uses Inter.
 * @param {Object}      element  Text element.
 * @param {Object}      attendee Attendee.
 * @return {Object} The layout of layoutText(), plus fallback (true when it
 *   uses the fallback font) and missing (characters neither font has, in
 *   the text as printed).
 */
export function layoutWithFallback( font, fallback, element, attendee ) {
	const layout = layoutText( font, element, attendee );
	const missing = missingCharacters( font, layout.text );
	if ( ! missing.length ) {
		return { ...layout, fallback: false, missing };
	}
	if ( fallback && fallback !== font ) {
		const other = layoutText( fallback, element, attendee );
		if ( ! missingCharacters( fallback, other.text ).length ) {
			return { ...other, fallback: true, missing: [] };
		}
	}
	return { ...layout, fallback: false, missing };
}

/**
 * Lays out the text of a box for one attendee.
 *
 * @param {Object} font     Fontkit font of the box's family and weight.
 * @param {Object} element  Text element.
 * @param {Object} attendee Attendee.
 * @return {Object} {text, size, width, shrunk, overflow, x, baseline, ascent,
 *   descent}: text as printed (cut when overflow is true); size in points,
 *   smaller than the element's when shrunk is true; width, x (from the box's
 *   left edge), baseline (from the box's top edge), ascent and descent
 *   (negative) in mm.
 */
export function layoutText( font, element, attendee ) {
	// An empty variable must not leave stray spaces that shift the text.
	let text = resolveText( element.content, attendee )
		.replace( /\s+/g, ' ' )
		.trim();
	if ( element.uppercase ) {
		text = text.toLocaleUpperCase();
	}

	let size = element.size;
	let width = textWidth( font, text, size );
	let shrunk = false;
	let overflow = false;

	if ( width > element.width + 0.01 ) {
		// Width grows with the size: the size that fits, in tenths of a point.
		const fitting =
			Math.floor( ( size * element.width * 10 ) / width ) / 10;
		const smallest = Math.round( size * SHRINK_LIMIT * 10 ) / 10;
		shrunk = true;
		size = Math.max( fitting, smallest );
		width = textWidth( font, text, size );
		if ( width > element.width + 0.01 ) {
			// Cut after the last whole character that fits with an ellipsis.
			overflow = true;
			const chars = graphemes( text );
			const cut = ( count ) =>
				chars.slice( 0, count ).join( '' ).trimEnd() + ELLIPSIS;
			let low = 0;
			let high = chars.length;
			while ( low < high ) {
				const middle = Math.ceil( ( low + high ) / 2 );
				if ( textWidth( font, cut( middle ), size ) <= element.width ) {
					low = middle;
				} else {
					high = middle - 1;
				}
			}
			text = low > 0 ? cut( low ) : '';
			width = textWidth( font, text, size );
		}
	}

	let x = 0;
	if ( element.align === 'center' ) {
		x = ( element.width - width ) / 2;
	} else if ( element.align === 'right' ) {
		x = element.width - width;
	}

	const ascent = ( font.ascent / font.unitsPerEm ) * size * MM_PER_PT;
	const descent = ( font.descent / font.unitsPerEm ) * size * MM_PER_PT;
	// Center the line (ascent to descent) vertically in the box.
	const baseline = element.height / 2 + ( ascent + descent ) / 2;

	return {
		text,
		size,
		width,
		shrunk,
		overflow,
		x,
		baseline,
		ascent,
		descent,
	};
}
