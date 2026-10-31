/**
 * Text layout shared by the editor and the PDF generator, so the screen
 * and the paper match: the same variables, the same font metrics (from
 * fontkit, as pdf-lib uses them) and the same rules.
 *
 * Text boxes hold one line at the size chosen; text is never resized. When
 * it does not fit, it is cut at the edge of the box, starting from the left
 * so its beginning stays readable, and the editor warns.
 *
 * Box positions are in millimeters; font sizes in points.
 */

const MM_PER_PT = 25.4 / 72;

/**
 * Variables a text box can hold.
 *
 * @param {Array<{key: string, label: string}>} questions Event questions.
 * @return {Array<{token: string, label: string}>} Variables.
 */
export function textVariables( questions = [] ) {
	const variables = [
		{ token: '{first_name}', label: 'First name' },
		{ token: '{last_name}', label: 'Last name' },
		{ token: '{full_name}', label: 'Full name' },
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
 * Replaces the variables with the attendee's data. Unknown variables are
 * left as typed, so a typo shows on the badge instead of vanishing.
 *
 * @param {string} content  Text with variables.
 * @param {Object} attendee Attendee from the REST API.
 * @return {string} Text.
 */
export function resolveText( content, attendee ) {
	return content.replace(
		/\{([a-z_]+)(?::([a-z0-9-]+))?\}/g,
		( match, name, key ) => {
			if ( name === 'first_name' ) {
				return attendee.firstName;
			}
			if ( name === 'last_name' ) {
				return attendee.lastName;
			}
			if ( name === 'full_name' ) {
				return ( attendee.firstName + ' ' + attendee.lastName ).trim();
			}
			if ( name === 'question' && key ) {
				return ( attendee.answers && attendee.answers[ key ] ) || '';
			}
			return match;
		}
	);
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
 * Lays out the text of a box for one attendee.
 *
 * @param {Object} font     Fontkit font of the box's family and weight.
 * @param {Object} element  Text element.
 * @param {Object} attendee Attendee.
 * @return {Object} {text, size, width, overflow, x, baseline, ascent, descent}:
 *   size in points; width, x (from the box's left edge), baseline (from the
 *   box's top edge), ascent and descent (negative) in mm.
 */
export function layoutText( font, element, attendee ) {
	// An empty variable must not leave stray spaces that shift the text.
	let text = resolveText( element.content, attendee )
		.replace( /\s+/g, ' ' )
		.trim();
	if ( element.uppercase ) {
		text = text.toLocaleUpperCase();
	}

	const size = element.size;
	const width = textWidth( font, text, size );
	const overflow = width > element.width + 0.01;

	let x = 0;
	if ( ! overflow && element.align === 'center' ) {
		x = ( element.width - width ) / 2;
	} else if ( ! overflow && element.align === 'right' ) {
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
		overflow,
		x,
		baseline,
		ascent,
		descent,
	};
}
