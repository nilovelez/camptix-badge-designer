/**
 * Builds the badges PDF in the browser with pdf-lib: one page per
 * attendee, from the same layout code the editor uses, so the paper
 * matches the screen.
 *
 * Positions in the design are in millimeters from the top-left corner of
 * the trim box; PDF coordinates are points from the bottom-left corner.
 */
import {
	PDFDocument,
	rgb,
	pushGraphicsState,
	popGraphicsState,
	moveTo,
	appendBezierCurve,
	closePath,
	rectangle,
	clip,
	endPath,
	concatTransformationMatrix,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { profileQr, profileUrl } from '../shared/qr';
import { gravatarUrls } from '../shared/gravatar';
import { faceKey, layoutTextBox, loadFace, neededFaces } from './fonts';
import { CROP_MARK_LENGTH, HOLE_MARK_LENGTH, pageGeometry } from './geometry';

const PT_PER_MM = 72 / 25.4;
const pt = ( mm ) => mm * PT_PER_MM;

const PRINT_DPI = 300;
// Gravatar requests running at once.
const GRAVATAR_LANES = 8;

const BLACK = rgb( 0, 0, 0 );
const WHITE = rgb( 1, 1, 1 );

/**
 * @param {string} hex Color as #rrggbb.
 * @return {Object} pdf-lib color.
 */
function hexToRgb( hex ) {
	let value = String( hex ).replace( '#', '' );
	// Short form: #f80 is #ff8800.
	if ( value.length === 3 ) {
		value =
			value[ 0 ] +
			value[ 0 ] +
			value[ 1 ] +
			value[ 1 ] +
			value[ 2 ] +
			value[ 2 ];
	}
	value = value.padEnd( 6, '0' );
	const channel = ( start ) =>
		( parseInt( value.slice( start, start + 2 ), 16 ) || 0 ) / 255;
	return rgb( channel( 0 ), channel( 2 ), channel( 4 ) );
}

async function fetchBytes( url, options ) {
	const response = await fetch( url, options );
	if ( ! response.ok ) {
		const error = new Error( 'HTTP ' + response.status + ' for ' + url );
		error.status = response.status;
		throw error;
	}
	return new Uint8Array( await response.arrayBuffer() );
}

/**
 * Embeds a PNG or a JPEG. Any other format the browser can read (a GIF
 * uploaded to Gravatar, for example) is converted to PNG first.
 *
 * @param {Object}     doc   PDF document.
 * @param {Uint8Array} bytes Image file.
 * @return {Promise<Object>} Embedded image.
 */
async function embedImage( doc, bytes ) {
	if (
		bytes[ 0 ] === 0x89 &&
		bytes[ 1 ] === 0x50 &&
		bytes[ 2 ] === 0x4e &&
		bytes[ 3 ] === 0x47
	) {
		return doc.embedPng( bytes );
	}
	if ( bytes[ 0 ] === 0xff && bytes[ 1 ] === 0xd8 ) {
		return doc.embedJpg( bytes );
	}
	const bitmap = await window.createImageBitmap(
		new window.Blob( [ bytes ] )
	);
	const canvas = document.createElement( 'canvas' );
	canvas.width = bitmap.width;
	canvas.height = bitmap.height;
	canvas.getContext( '2d' ).drawImage( bitmap, 0, 0 );
	const blob = await new Promise( ( resolve ) =>
		canvas.toBlob( resolve, 'image/png' )
	);
	return doc.embedPng( new Uint8Array( await blob.arrayBuffer() ) );
}

/**
 * Runs `worker` over `items` with at most `limit` running at once.
 *
 * @param {Array}                       items  Items.
 * @param {number}                      limit  Lanes.
 * @param {(item: any) => Promise<any>} worker Async worker.
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

function circlePath( cx, cy, r ) {
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

/**
 * Draws an image to cover a box, cropped to the box or to its circle.
 *
 * @param {Object}  page  PDF page.
 * @param {Object}  image Embedded image.
 * @param {Object}  box   {x, y, size} in points; y is the bottom edge.
 * @param {boolean} round Crop to a circle.
 */
function drawCoverImage( page, image, box, round ) {
	const scale = Math.max( box.size / image.width, box.size / image.height );
	const width = image.width * scale;
	const height = image.height * scale;
	const shape = round
		? circlePath( box.x + box.size / 2, box.y + box.size / 2, box.size / 2 )
		: [ rectangle( box.x, box.y, box.size, box.size ) ];
	page.pushOperators( pushGraphicsState(), ...shape, clip(), endPath() );
	page.drawImage( image, {
		x: box.x + ( box.size - width ) / 2,
		y: box.y + ( box.size - height ) / 2,
		width,
		height,
	} );
	page.pushOperators( popGraphicsState() );
}

function drawCropMarks( page, left, bottom, right, top, offset ) {
	const length = pt( CROP_MARK_LENGTH );
	const line = { thickness: 0.25, color: BLACK };
	const corners = [
		[ left, top, -1, 1 ],
		[ right, top, 1, 1 ],
		[ left, bottom, -1, -1 ],
		[ right, bottom, 1, -1 ],
	];
	for ( const [ x, y, dx, dy ] of corners ) {
		// On the line of the trim edges, outside the bleed.
		page.drawLine( {
			start: { x: x + dx * offset, y },
			end: { x: x + dx * ( offset + length ), y },
			...line,
		} );
		page.drawLine( {
			start: { x, y: y + dy * offset },
			end: { x, y: y + dy * ( offset + length ) },
			...line,
		} );
	}
}

/**
 * Hole mark: a short vertical line at the top center, to find the center
 * when punching the lanyard hole. Black on a thin white outline, so it
 * shows on light and dark backgrounds.
 *
 * @param {Object} page   PDF page.
 * @param {number} x      Center of the badge, in points.
 * @param {number} top    Top edge of the bleed, in points.
 * @param {number} bottom Where the line ends inside the trim, in points.
 */
function drawHoleMark( page, x, top, bottom ) {
	for ( const [ color, thickness ] of [
		[ WHITE, 1.2 ],
		[ BLACK, 0.4 ],
	] ) {
		page.drawLine( {
			start: { x, y: top },
			end: { x, y: bottom },
			thickness,
			color,
		} );
	}
}

/**
 * Fold marks: dashed, on the line of the fold, outside the bleed on both
 * sides, like the crop marks.
 *
 * @param {Object} page   PDF page.
 * @param {number} left   Left trim edge, in points.
 * @param {number} right  Right trim edge, in points.
 * @param {number} y      Fold line, in points.
 * @param {number} offset Distance from the trim edge, in points (the bleed).
 */
function drawFoldMarks( page, left, right, y, offset ) {
	const length = pt( CROP_MARK_LENGTH );
	const line = { thickness: 0.25, color: BLACK, dashArray: [ 2, 1.5 ] };
	page.drawLine( {
		start: { x: left - offset, y },
		end: { x: left - offset - length, y },
		...line,
	} );
	page.drawLine( {
		start: { x: right + offset, y },
		end: { x: right + offset + length, y },
		...line,
	} );
}

function gravatarPixels( element ) {
	return Math.round( ( element.width / 25.4 ) * PRINT_DPI );
}

/**
 * Builds the PDF.
 *
 * @param {Object}                     options
 * @param {Object}                     options.design         Design.
 * @param {Object|null}                options.backgroundFile {url} of the background, or null.
 * @param {Object}                     options.images         Fallback image URLs by attachment id.
 * @param {Array}                      options.attendees      Attendees, one page each, in order.
 * @param {(progress: Object) => void} [options.onProgress]   Called with {step, done, total}.
 * @param {AbortSignal}                [options.signal]       Cancels the build.
 * @return {Promise<{bytes: Uint8Array, stats: Object}>} The PDF and what happened.
 */
export async function buildBadgesPdf( {
	design,
	backgroundFile,
	images,
	attendees,
	onProgress = () => {},
	signal,
} ) {
	const checkCancelled = () => {
		if ( signal && signal.aborted ) {
			throw new DOMException( 'Cancelled', 'AbortError' );
		}
	};
	const elements = design.elements || [];
	const stats = {
		pages: attendees.length,
		gravatars: 0,
		gravatarsMissing: 0,
		gravatarsFailed: 0,
	};

	const doc = await PDFDocument.create();
	doc.setTitle( 'Badges' );
	doc.setCreator( 'CampTix Badge Designer' );
	doc.setProducer( 'CampTix Badge Designer with pdf-lib' );
	doc.registerFontkit( fontkit );

	// Fonts: the same files the editor measured, subset to the glyphs in use.
	onProgress( { step: 'fonts' } );
	// Each text box may fall back to Inter for some attendees (see
	// layoutTextBox()): the layouts are worked out first, so only the faces
	// some badge uses are embedded.
	const loaded = {};
	for ( const face of neededFaces( elements ) ) {
		loaded[ faceKey( face ) ] = await loadFace( face );
	}
	const textLayouts = new Map();
	const usedFaces = new Set();
	for ( const attendee of attendees ) {
		const layouts = {};
		for ( const element of elements ) {
			if ( element.type !== 'text' ) {
				continue;
			}
			const layout = layoutTextBox( element, attendee, loaded );
			if ( layout ) {
				layouts[ element.id ] = layout;
				usedFaces.add( layout.faceKey );
			}
		}
		textLayouts.set( attendee, layouts );
	}
	const pdfFonts = {};
	for ( const key of usedFaces ) {
		pdfFonts[ key ] = await doc.embedFont( loaded[ key ].bytes, {
			subset: true,
		} );
	}
	checkCancelled();

	// Background: embedded once, drawn on every page. A PDF stays vector.
	onProgress( { step: 'background' } );
	let background = null;
	if ( design.background && backgroundFile ) {
		const bytes = await fetchBytes( backgroundFile.url );
		if ( design.background.type === 'pdf' ) {
			const [ embedded ] = await doc.embedPdf( bytes, [ 0 ] );
			background = { kind: 'page', object: embedded };
		} else {
			background = {
				kind: 'image',
				object: await embedImage( doc, bytes ),
			};
		}
	}

	// Fixed Gravatar fallback images, embedded once each.
	const fallbackImages = {};
	for ( const element of elements ) {
		const id =
			element.type === 'gravatar' &&
			element.fallback === 'image' &&
			element.fallbackImage;
		if ( id && images[ id ] && ! fallbackImages[ id ] ) {
			fallbackImages[ id ] = await embedImage(
				doc,
				await fetchBytes( images[ id ] )
			);
		}
	}
	checkCancelled();

	// Gravatars: one request per distinct image, a few at a time, at print
	// resolution. An attendee may have more than one URL to try in order
	// (the ticket email's, then the WordPress.org account's): the first that
	// loads is used. A missing or failed one never stops the build.
	const gravatarChains = new Map();
	for ( const element of elements ) {
		if ( element.type !== 'gravatar' ) {
			continue;
		}
		for ( const attendee of attendees ) {
			const urls = gravatarUrls(
				attendee,
				gravatarPixels( element ),
				element.fallback
			);
			if ( urls.length ) {
				gravatarChains.set( urls.join( ' ' ), urls );
			}
		}
	}
	const gravatars = new Map();
	let fetched = 0;
	await runPool(
		[ ...gravatarChains ],
		GRAVATAR_LANES,
		async ( [ key, urls ] ) => {
			let image = null;
			let failed = false;
			for ( const url of urls ) {
				checkCancelled();
				try {
					const bytes = await fetchBytes( url, {
						mode: 'cors',
						credentials: 'omit',
						signal,
					} );
					image = await embedImage( doc, bytes );
					break;
				} catch ( error ) {
					if ( error.name === 'AbortError' ) {
						throw error;
					}
					if ( error.status !== 404 ) {
						failed = true;
					}
				}
			}
			gravatars.set( key, image );
			if ( image ) {
				stats.gravatars++;
			} else if ( failed ) {
				stats.gravatarsFailed++;
			} else {
				stats.gravatarsMissing++;
			}
			fetched++;
			onProgress( {
				step: 'gravatars',
				done: fetched,
				total: gravatarChains.size,
			} );
		}
	);

	// Pages. A single badge has one face per page. A folded badge has the
	// face twice, joined at the fold: the bottom one upright and the top one
	// upside down, each without the bleed at its top edge, so the page folds
	// in half into a two-sided badge.
	const geometry = pageGeometry( design );
	const { size } = design;
	const folded = !! design.folded;
	const trimLeft = pt( geometry.margin );
	const trimBottom = pt( geometry.margin );
	const trimRight = trimLeft + pt( size.width );
	const trimTop = trimBottom + pt( size.height );
	const fromLeft = ( mm ) => trimLeft + pt( mm );
	const fromTop = ( mm ) => trimTop - pt( mm );
	const bleed = pt( size.bleed );

	// Draws one face with its trim box at trimLeft, trimBottom.
	function drawFace( page, attendee ) {
		if ( background ) {
			const box = {
				x: trimLeft - bleed,
				y: trimBottom - bleed,
				width: pt( size.width ) + 2 * bleed,
				height: pt( size.height ) + 2 * bleed,
			};
			if ( background.kind === 'page' ) {
				page.drawPage( background.object, box );
			} else {
				page.drawImage( background.object, box );
			}
		}

		for ( const element of elements ) {
			if ( element.type === 'text' ) {
				const layout = textLayouts.get( attendee )[ element.id ];
				if ( ! layout || ! layout.text ) {
					continue;
				}
				// Text that does not fit is cut at the edge of the box.
				page.pushOperators(
					pushGraphicsState(),
					rectangle(
						fromLeft( element.x ),
						fromTop( element.y + element.height ),
						pt( element.width ),
						pt( element.height )
					),
					clip(),
					endPath()
				);
				page.drawText( layout.text, {
					x: fromLeft( element.x + layout.x ),
					y: fromTop( element.y + layout.baseline ),
					size: layout.size,
					font: pdfFonts[ layout.faceKey ],
					color: hexToRgb( element.color ),
				} );
				page.pushOperators( popGraphicsState() );
			} else if ( element.type === 'qr' ) {
				const url = profileUrl( attendee );
				if ( ! url ) {
					continue;
				}
				const qr = profileQr( url );
				const side = pt( element.width );
				const x = fromLeft( element.x );
				const top = fromTop( element.y );
				// A transparent code leaves the background behind it, which
				// must be light and plain enough for phones to read it.
				if ( ! element.transparent ) {
					page.drawRectangle( {
						x,
						y: top - side,
						width: side,
						height: side,
						color: WHITE,
					} );
				}
				page.drawSvgPath( qr.path, {
					x,
					y: top,
					scale: side / qr.size,
					color: BLACK,
					borderWidth: 0,
				} );
			} else if ( element.type === 'gravatar' ) {
				const urls = gravatarUrls(
					attendee,
					gravatarPixels( element ),
					element.fallback
				);
				let image = urls.length
					? gravatars.get( urls.join( ' ' ) )
					: null;
				if ( ! image && element.fallback === 'image' ) {
					image = fallbackImages[ element.fallbackImage ] || null;
				}
				if ( image ) {
					drawCoverImage(
						page,
						image,
						{
							x: fromLeft( element.x ),
							y: fromTop( element.y + element.height ),
							size: pt( element.width ),
						},
						element.shape === 'round'
					);
				}
			}
		}

		if ( design.holeMark ) {
			drawHoleMark(
				page,
				( trimLeft + trimRight ) / 2,
				trimTop + bleed,
				fromTop( HOLE_MARK_LENGTH )
			);
		}
	}

	for ( let index = 0; index < attendees.length; index++ ) {
		const attendee = attendees[ index ];
		const page = doc.addPage( [
			pt( geometry.width ),
			pt( geometry.height ),
		] );

		if ( ! folded ) {
			drawFace( page, attendee );
		} else {
			const fold = trimTop;
			const left = trimLeft - bleed;
			const width = pt( size.width ) + 2 * bleed;

			// Bottom face, upright, cut at the fold.
			page.pushOperators(
				pushGraphicsState(),
				rectangle(
					left,
					trimBottom - bleed,
					width,
					fold - trimBottom + bleed
				),
				clip(),
				endPath()
			);
			drawFace( page, attendee );
			page.pushOperators( popGraphicsState() );

			// Top face, turned 180 degrees about the middle of its trim box,
			// cut at the fold.
			page.pushOperators(
				pushGraphicsState(),
				rectangle( left, fold, width, pt( size.height ) + bleed ),
				clip(),
				endPath(),
				concatTransformationMatrix(
					-1,
					0,
					0,
					-1,
					trimLeft + trimRight,
					2 * fold
				)
			);
			drawFace( page, attendee );
			page.pushOperators( popGraphicsState() );
		}

		if ( design.cropMarks ) {
			const top = folded ? trimTop + pt( size.height ) : trimTop;
			drawCropMarks( page, trimLeft, trimBottom, trimRight, top, bleed );
			if ( folded ) {
				drawFoldMarks( page, trimLeft, trimRight, trimTop, bleed );
			}
		}

		// Let the browser breathe and show progress every few pages.
		if ( index % 10 === 9 || index === attendees.length - 1 ) {
			onProgress( {
				step: 'pages',
				done: index + 1,
				total: attendees.length,
			} );
			await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
			checkCancelled();
		}
	}
	onProgress( { step: 'saving' } );
	const bytes = await doc.save( { useObjectStreams: true } );
	return { bytes, stats };
}
