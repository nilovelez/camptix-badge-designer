/**
 * Builds the badges PDF in the browser with pdf-lib.
 *
 * All positions are in millimeters from the top-left corner of the trim
 * box, as the editor will store them; they are converted to PDF points
 * (bottom-left origin) only when drawing.
 */
import {
	PDFDocument,
	rgb,
	pushGraphicsState,
	popGraphicsState,
	moveTo,
	appendBezierCurve,
	closePath,
	clip,
	endPath,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { encode } from '../vendor/ladyqr/qr.js';
import { sha256 } from './sha256';

const PT_PER_MM = 72 / 25.4;
const mm = ( value ) => value * PT_PER_MM;

// Crop marks: 5 mm long, starting at the edge of the bleed, so the page
// grows by the bleed plus 6 mm on every side.
const CROP_MARK_LENGTH = 5;
const CROP_MARK_SPARE = 1;

export const LAYOUT = {
	width: 100,
	height: 150,
	bleed: 3,
	gravatar: { x: 30, y: 20, size: 40 },
	firstName: { x: 8, y: 75, width: 84, size: 26, minSize: 14, weight: '700' },
	lastName: { x: 8, y: 86, width: 84, size: 16, minSize: 10, weight: '600' },
	qr: { x: 37, y: 112, size: 26 },
};

const TEXT_COLOR = rgb( 0.118, 0.118, 0.118 );
const BLACK = rgb( 0, 0, 0 );
const WHITE = rgb( 1, 1, 1 );

function now() {
	return performance.now();
}

function heapMb() {
	if ( performance.memory ) {
		return Math.round( performance.memory.usedJSHeapSize / 1048576 );
	}
	return null;
}

async function fetchBytes( url ) {
	const response = await fetch( url );
	if ( ! response.ok ) {
		throw new Error( 'HTTP ' + response.status + ' for ' + url );
	}
	return new Uint8Array( await response.arrayBuffer() );
}

function imageType( bytes ) {
	if ( bytes[ 0 ] === 0x89 && bytes[ 1 ] === 0x50 && bytes[ 2 ] === 0x4e && bytes[ 3 ] === 0x47 ) {
		return 'png';
	}
	if ( bytes[ 0 ] === 0xff && bytes[ 1 ] === 0xd8 ) {
		return 'jpg';
	}
	return 'unknown';
}

/**
 * Runs `worker` over `items` with at most `limit` running at once.
 *
 * @param {Array}    items  Items to process.
 * @param {number}   limit  Maximum concurrent workers.
 * @param {Function} worker Async function called with each item.
 */
async function runPool( items, limit, worker ) {
	let next = 0;
	async function lane() {
		while ( next < items.length ) {
			const item = items[ next ];
			next++;
			await worker( item );
		}
	}
	const lanes = [];
	for ( let i = 0; i < Math.min( limit, items.length ); i++ ) {
		lanes.push( lane() );
	}
	await Promise.all( lanes );
}

/**
 * Shrinks the size until the text fits the box width, down to minSize.
 *
 * @param {Object} font  Embedded pdf-lib font.
 * @param {string} text  Text to fit.
 * @param {Object} box   Element with width (mm), size and minSize (pt).
 * @return {{size: number, width: number, overflow: boolean}} Fitted size and text width in points.
 */
function fitText( font, text, box ) {
	const maxWidth = mm( box.width );
	let size = box.size;
	let width = font.widthOfTextAtSize( text, size );
	while ( width > maxWidth && size > box.minSize ) {
		size = Math.max( box.minSize, size - 0.5 );
		width = font.widthOfTextAtSize( text, size );
	}
	return { size, width, overflow: width > maxWidth };
}

/**
 * The QR code as one SVG path in module units, so it is filled in a single
 * operation with no hairlines between modules.
 *
 * @param {boolean[][]} modules Module matrix from LadyQR.
 * @return {string} SVG path data.
 */
function qrPath( modules ) {
	let path = '';
	for ( let y = 0; y < modules.length; y++ ) {
		let x = 0;
		while ( x < modules.length ) {
			if ( ! modules[ y ][ x ] ) {
				x++;
				continue;
			}
			let run = 1;
			while ( x + run < modules.length && modules[ y ][ x + run ] ) {
				run++;
			}
			path += 'M' + x + ' ' + y + 'h' + run + 'v1h-' + run + 'z';
			x += run;
		}
	}
	return path;
}

function circleOperators( cx, cy, r ) {
	const k = 0.5522847498 * r;
	return [
		moveTo( cx + r, cy ),
		appendBezierCurve( cx + r, cy + k, cx + k, cy + r, cx, cy + r ),
		appendBezierCurve( cx - k, cy + r, cx - r, cy + k, cx - r, cy ),
		appendBezierCurve( cx - r, cy - k, cx - k, cy - r, cx, cy - r ),
		appendBezierCurve( cx + k, cy - r, cx + r, cy - k, cx + r, cy ),
		closePath(),
	];
}

function drawCropMarks( page, left, bottom, right, top, offset ) {
	const length = mm( CROP_MARK_LENGTH );
	const line = { thickness: 0.25, color: BLACK };
	const corners = [
		[ left, top, -1, 1 ],
		[ right, top, 1, 1 ],
		[ left, bottom, -1, -1 ],
		[ right, bottom, 1, -1 ],
	];
	for ( const [ x, y, dx, dy ] of corners ) {
		// Horizontal mark, on the line of the top or bottom trim edge.
		page.drawLine( { start: { x: x + dx * offset, y }, end: { x: x + dx * ( offset + length ), y }, ...line } );
		// Vertical mark, on the line of the left or right trim edge.
		page.drawLine( { start: { x, y: y + dy * offset }, end: { x, y: y + dy * ( offset + length ) }, ...line } );
	}
}

/**
 * Generates the PDF.
 *
 * @param {Object}   options
 * @param {Array}    options.attendees  Attendees, in purchase order.
 * @param {Object}   options.fonts      URLs of the Inter TTF files by weight.
 * @param {Object}   options.background {type: 'pdf'|'png'|'jpg', bytes} or null.
 * @param {boolean}  options.cropMarks  Draw crop marks.
 * @param {boolean}  options.subset     Subset the fonts.
 * @param {boolean}  options.gravatars  Fetch Gravatars.
 * @param {string}   options.fallback   Gravatar `d` parameter.
 * @param {string}   options.shape      'round' or 'square'.
 * @param {Function} options.log        Called with each measurement.
 * @return {Promise<Uint8Array>} The PDF.
 */
export async function generateBadges( options ) {
	const { attendees, log } = options;
	const layout = LAYOUT;
	const started = now();
	let mark = now();
	const step = ( label, detail ) => {
		const t = now();
		log( { label, ms: Math.round( t - mark ), detail, heap: heapMb() } );
		mark = t;
	};

	const doc = await PDFDocument.create();
	doc.registerFontkit( fontkit );
	doc.setTitle( 'Badges' );
	doc.setCreator( 'Camptix Badge Generator' );

	// Fonts.
	const fonts = {};
	for ( const weight of [ '700', '600' ] ) {
		const bytes = await fetchBytes( options.fonts[ weight ] );
		fonts[ weight ] = await doc.embedFont( bytes, { subset: options.subset } );
	}
	step( 'Fonts loaded and embedded', options.subset ? 'Inter 700 and 600, subset' : 'Inter 700 and 600, full fonts' );

	// Background, embedded once and drawn on every page.
	let background = null;
	if ( options.background ) {
		if ( options.background.type === 'pdf' ) {
			const [ embedded ] = await doc.embedPdf( options.background.bytes, [ 0 ] );
			background = { kind: 'page', object: embedded };
		} else if ( options.background.type === 'png' ) {
			background = { kind: 'image', object: await doc.embedPng( options.background.bytes ) };
		} else {
			background = { kind: 'image', object: await doc.embedJpg( options.background.bytes ) };
		}
		step( 'Background embedded', options.background.type.toUpperCase() + ', ' + Math.round( options.background.bytes.length / 1024 ) + ' KB' );
	}

	// Gravatars: one request per distinct email, a few at a time.
	const images = new Map();
	const gravatarStats = { requested: 0, png: 0, jpg: 0, missing: 0, failed: 0, nativeHash: null, errors: [] };
	if ( options.gravatars ) {
		const px = Math.round( ( layout.gravatar.size / 25.4 ) * 300 );
		const emails = [ ...new Set( attendees.map( ( a ) => a.email.trim().toLowerCase() ) ) ];
		await runPool( emails, 8, async ( email ) => {
			const hash = await sha256( email );
			gravatarStats.nativeHash = hash.native;
			const url = 'https://gravatar.com/avatar/' + hash.hex + '.png?s=' + px + '&d=' + encodeURIComponent( options.fallback ) + '&r=g';
			gravatarStats.requested++;
			try {
				const response = await fetch( url, { mode: 'cors', credentials: 'omit' } );
				// With d=404 ("none"), attendees without a Gravatar get a 404:
				// nothing is drawn and the background shows through.
				if ( response.status === 404 ) {
					gravatarStats.missing++;
					return;
				}
				if ( ! response.ok ) {
					throw new Error( 'HTTP ' + response.status );
				}
				const bytes = new Uint8Array( await response.arrayBuffer() );
				const type = imageType( bytes );
				if ( type === 'png' ) {
					images.set( email, await doc.embedPng( bytes ) );
					gravatarStats.png++;
				} else if ( type === 'jpg' ) {
					images.set( email, await doc.embedJpg( bytes ) );
					gravatarStats.jpg++;
				} else {
					throw new Error( 'Unknown image type' );
				}
			} catch ( error ) {
				// No image: the background shows through. Never stop.
				gravatarStats.failed++;
				if ( gravatarStats.errors.length < 3 ) {
					gravatarStats.errors.push( String( error.message || error ) );
				}
			}
		} );
		step(
			'Gravatars fetched and embedded',
			gravatarStats.requested + ' requested at ' + px + ' px: ' + gravatarStats.png + ' PNG, ' + gravatarStats.jpg + ' JPG, ' + gravatarStats.missing + ' without Gravatar, ' + gravatarStats.failed + ' failed' +
				( gravatarStats.errors.length ? ' (' + gravatarStats.errors.join( '; ' ) + ')' : '' ) +
				'. Hash: ' + ( gravatarStats.nativeHash ? 'crypto.subtle' : 'JavaScript fallback (not a secure context)' )
		);
	}

	// Page geometry.
	let margin = layout.bleed;
	if ( options.cropMarks ) {
		margin = layout.bleed + CROP_MARK_LENGTH + CROP_MARK_SPARE;
	}
	const pageWidth = mm( layout.width + 2 * margin );
	const pageHeight = mm( layout.height + 2 * margin );
	const trimLeft = mm( margin );
	const trimBottom = mm( margin );
	const trimTop = trimBottom + mm( layout.height );
	const trimRight = trimLeft + mm( layout.width );
	const fromTop = ( y ) => trimTop - mm( y );

	let overflow = 0;
	let withoutQr = 0;
	for ( const attendee of attendees ) {
		const page = doc.addPage( [ pageWidth, pageHeight ] );

		if ( background ) {
			const box = {
				x: trimLeft - mm( layout.bleed ),
				y: trimBottom - mm( layout.bleed ),
				width: mm( layout.width + 2 * layout.bleed ),
				height: mm( layout.height + 2 * layout.bleed ),
			};
			if ( background.kind === 'page' ) {
				page.drawPage( background.object, box );
			} else {
				page.drawImage( background.object, box );
			}
		}

		// Gravatar.
		const image = images.get( attendee.email.trim().toLowerCase() );
		if ( image ) {
			const g = layout.gravatar;
			const x = trimLeft + mm( g.x );
			const y = fromTop( g.y + g.size );
			const size = mm( g.size );
			if ( options.shape === 'round' ) {
				page.pushOperators( pushGraphicsState(), ...circleOperators( x + size / 2, y + size / 2, size / 2 ), clip(), endPath() );
				page.drawImage( image, { x, y, width: size, height: size } );
				page.pushOperators( popGraphicsState() );
			} else {
				page.drawImage( image, { x, y, width: size, height: size } );
			}
		}

		// Names, centered and shrunk to fit.
		for ( const [ key, text ] of [ [ 'firstName', attendee.firstName ], [ 'lastName', attendee.lastName ] ] ) {
			const box = layout[ key ];
			const font = fonts[ box.weight ];
			const fit = fitText( font, text, box );
			if ( fit.overflow ) {
				overflow++;
			}
			page.drawText( text, {
				x: trimLeft + mm( box.x ) + ( mm( box.width ) - fit.width ) / 2,
				y: fromTop( box.y ),
				size: fit.size,
				font,
				color: TEXT_COLOR,
			} );
		}

		// QR code, only with a username: otherwise the space stays empty.
		if ( attendee.username ) {
			const qr = encode( 'https://profiles.wordpress.org/' + attendee.username + '/', 'M' );
			const quiet = 2;
			const total = qr.size + 2 * quiet;
			const size = mm( layout.qr.size );
			const module = size / total;
			const x = trimLeft + mm( layout.qr.x );
			const top = fromTop( layout.qr.y );
			page.drawRectangle( { x, y: top - size, width: size, height: size, color: WHITE } );
			page.drawSvgPath( qrPath( qr.modules ), {
				x: x + quiet * module,
				y: top - quiet * module,
				scale: module,
				color: BLACK,
				borderWidth: 0,
			} );
		} else {
			withoutQr++;
		}

		if ( options.cropMarks ) {
			drawCropMarks( page, trimLeft, trimBottom, trimRight, trimTop, mm( layout.bleed ) );
		}
	}
	step(
		'Pages laid out',
		attendees.length + ' pages of ' + ( layout.width + 2 * margin ) + ' × ' + ( layout.height + 2 * margin ) + ' mm; ' +
			withoutQr + ' without QR (no username); ' + overflow + ' names still too wide at the minimum size'
	);

	const bytes = await doc.save( { useObjectStreams: true } );
	step( 'PDF saved', Math.round( ( bytes.length / 1048576 ) * 100 ) / 100 + ' MB' );
	log( { label: 'Total', ms: Math.round( now() - started ), detail: '', heap: heapMb(), total: true } );

	return bytes;
}

/**
 * Turns WOFF2 into TTF. @pdf-lib/fontkit reads WOFF2 but crashes when it
 * subsets it, so fonts from the Font Library are converted first. The
 * decoder (WebAssembly, about 300 KB) is only loaded when needed.
 *
 * @param {Uint8Array} bytes Font file.
 * @return {Promise<{bytes: Uint8Array, converted: boolean}>} A font pdf-lib can subset.
 */
export async function toEmbeddableFont( bytes ) {
	const isWoff2 = bytes[ 0 ] === 0x77 && bytes[ 1 ] === 0x4f && bytes[ 2 ] === 0x46 && bytes[ 3 ] === 0x32;
	if ( ! isWoff2 ) {
		return { bytes, converted: false };
	}
	const { default: decompress } = await import( /* webpackChunkName: "woff2" */ 'woff2-encoder/decompress' );
	return { bytes: await decompress( bytes ), converted: true };
}

/**
 * Checks that a WOFF2 file, as the Font Library installs them, ends up embedded.
 *
 * @param {string} url URL of a WOFF2 font.
 * @return {Promise<{ok: boolean, detail: string, bytes?: Uint8Array}>} The result.
 */
export async function checkWoff2( url ) {
	try {
		const fontBytes = await fetchBytes( url );
		const started = now();
		const ttf = await toEmbeddableFont( fontBytes );
		const ms = Math.round( now() - started );
		const doc = await PDFDocument.create();
		doc.registerFontkit( fontkit );
		const font = await doc.embedFont( ttf.bytes, { subset: true } );
		const page = doc.addPage( [ mm( 100 ), mm( 30 ) ] );
		page.drawText( 'WOFF2: Begoña Íñiguez Ølstad', { x: mm( 5 ), y: mm( 12 ), size: 14, font } );
		const bytes = await doc.save();
		return {
			ok: true,
			detail: 'WOFF2 of ' + Math.round( fontBytes.length / 1024 ) + ' KB converted to TTF in ' + ms + ' ms, subset and embedded (' + Math.round( bytes.length / 1024 ) + ' KB PDF).',
			bytes,
		};
	} catch ( error ) {
		return { ok: false, detail: String( error.message || error ) };
	}
}
