/**
 * Badge elements: defaults, new elements, labels, and the geometry of
 * moving and resizing. Positions and sizes are in millimeters from the
 * top-left corner of the trim box.
 */
import { round1 } from './geometry';

export const DESIGN_VERSION = 2;
const MIN_SIZE = 3;
const DEFAULT_COLOR = '#1e1e1e';

let counter = 0;
function newId( type ) {
	counter++;
	return type + '-' + Date.now().toString( 36 ) + '-' + counter;
}

/**
 * A new text element.
 *
 * @param {Object} props Overrides.
 * @return {Object} Element.
 */
export function makeText( props ) {
	return {
		id: newId( 'text' ),
		type: 'text',
		x: 10,
		y: 10,
		width: 60,
		height: 10,
		content: '{full_name}',
		font: 'Inter',
		weight: '600',
		size: 16,
		color: DEFAULT_COLOR,
		align: 'center',
		uppercase: false,
		...props,
	};
}

export function makeGravatar( props ) {
	return {
		id: newId( 'gravatar' ),
		type: 'gravatar',
		x: 10,
		y: 10,
		width: 30,
		height: 30,
		shape: 'round',
		fallback: '404',
		...props,
	};
}

export function makeQr( props ) {
	return {
		id: newId( 'qr' ),
		type: 'qr',
		x: 10,
		y: 10,
		width: 25,
		height: 25,
		...props,
	};
}

/**
 * The elements a new design starts with, laid out for its print size:
 * the Gravatar, the first name, the last name and the QR code, centered.
 *
 * @param {Object} size Print size.
 * @return {Array} Elements.
 */
export function defaultElements( size ) {
	const { width, height, safe } = size;
	const inner = width - 2 * safe;
	const scale = width / 100;
	const gravatar = round1( Math.min( 0.4 * width, 0.27 * height ) );
	const qr = round1( Math.min( 0.26 * width, 0.18 * height ) );

	return [
		makeGravatar( {
			x: round1( ( width - gravatar ) / 2 ),
			y: round1( 0.13 * height ),
			width: gravatar,
			height: gravatar,
		} ),
		makeText( {
			content: '{first_name}',
			x: safe,
			y: round1( 0.44 * height ),
			width: inner,
			height: round1( 0.08 * height ),
			weight: '700',
			size: Math.round( 26 * scale ),
		} ),
		makeText( {
			content: '{last_name}',
			x: safe,
			y: round1( 0.53 * height ),
			width: inner,
			height: round1( 0.06 * height ),
			weight: '600',
			size: Math.round( 16 * scale ),
		} ),
		makeQr( {
			x: round1( ( width - qr ) / 2 ),
			y: round1( 0.75 * height ),
			width: qr,
			height: qr,
		} ),
	];
}

/**
 * A new element of a type, centered in the badge.
 *
 * @param {string} type Element type.
 * @param {Object} size Print size.
 * @return {Object} Element.
 */
export function newElement( type, size ) {
	let element;
	if ( type === 'gravatar' ) {
		element = makeGravatar();
	} else if ( type === 'qr' ) {
		element = makeQr();
	} else {
		element = makeText( {
			width: Math.min( 60, size.width - 2 * size.safe ),
		} );
	}
	return {
		...element,
		x: round1( ( size.width - element.width ) / 2 ),
		y: round1( ( size.height - element.height ) / 2 ),
	};
}

/**
 * Brings a design from an older version up to date. Designs without
 * elements yet get the default ones, once.
 *
 * @param {Object} design Design from the server.
 * @return {Object|null} Updated design, or null if it is current.
 */
export function upgradeDesign( design ) {
	if (
		design.version >= DESIGN_VERSION &&
		Array.isArray( design.elements )
	) {
		return null;
	}
	const elements =
		Array.isArray( design.elements ) && design.elements.length
			? design.elements
			: defaultElements( design.size );
	return { ...design, version: DESIGN_VERSION, elements };
}

export function isSquare( element ) {
	return element.type === 'qr' || element.type === 'gravatar';
}

export function elementLabel( element ) {
	if ( element.type === 'gravatar' ) {
		return 'Gravatar';
	}
	if ( element.type === 'qr' ) {
		return 'QR code: profile';
	}
	return element.content || 'Empty text box';
}

/**
 * Moves an element, snapping its center to the center lines of the badge.
 *
 * @param {Object} start     Element when the drag started.
 * @param {number} dx        Horizontal movement in mm.
 * @param {number} dy        Vertical movement in mm.
 * @param {Object} size      Print size.
 * @param {number} tolerance Snap distance in mm.
 * @return {{element: Object, snapX: boolean, snapY: boolean}} Moved element and the axes it snapped to.
 */
export function moveElement( start, dx, dy, size, tolerance ) {
	let x = start.x + dx;
	let y = start.y + dy;
	let snapX = false;
	let snapY = false;
	if ( Math.abs( x + start.width / 2 - size.width / 2 ) <= tolerance ) {
		x = size.width / 2 - start.width / 2;
		snapX = true;
	}
	if ( Math.abs( y + start.height / 2 - size.height / 2 ) <= tolerance ) {
		y = size.height / 2 - start.height / 2;
		snapY = true;
	}
	return {
		element: { ...start, x: round1( x ), y: round1( y ) },
		snapX,
		snapY,
	};
}

/**
 * Resizes an element from one of its corners. Gravatars and QR codes stay
 * square.
 *
 * @param {Object} start  Element when the drag started.
 * @param {string} corner 'nw', 'ne', 'sw' or 'se'.
 * @param {number} dx     Horizontal movement in mm.
 * @param {number} dy     Vertical movement in mm.
 * @return {Object} Resized element.
 */
export function resizeElement( start, corner, dx, dy ) {
	const west = corner.includes( 'w' );
	const north = corner.includes( 'n' );
	let width = start.width + ( west ? -dx : dx );
	let height = start.height + ( north ? -dy : dy );

	if ( isSquare( start ) ) {
		const side = Math.max( width, height );
		width = side;
		height = side;
	}
	width = Math.max( MIN_SIZE, width );
	height = Math.max( MIN_SIZE, height );

	return {
		...start,
		x: round1( west ? start.x + start.width - width : start.x ),
		y: round1( north ? start.y + start.height - height : start.y ),
		width: round1( width ),
		height: round1( height ),
	};
}
