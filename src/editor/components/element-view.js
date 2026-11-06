/**
 * What each element shows on the canvas for the attendee on screen.
 */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { profileQr, profileUrl } from '../../shared/qr';
import { gravatarUrls } from '../../shared/gravatar';

const PT_TO_MM = 25.4 / 72;

/**
 * Text drawn from the font's own glyphs, as the PDF draws it. Used when the
 * font lacks some characters: the browser would fill them in from a system
 * font and the canvas would look right, while the PDF prints the font's
 * empty box (.notdef). Drawing the same glyphs shows the same boxes.
 *
 * @param {Object} props        Props.
 * @param {Object} props.font   Fontkit font.
 * @param {Object} props.layout Layout of the text.
 * @param {string} props.color  Text color.
 * @param {number} props.scale  Pixels per millimeter.
 * @return {Element} SVG.
 */
function GlyphText( { font, layout, color, scale } ) {
	const run = font.layout( layout.text );
	// Font units to pixels; the glyphs are drawn with the y axis up.
	const units = ( layout.size * PT_TO_MM * scale ) / font.unitsPerEm;
	const paths = [];
	let x = 0;
	let y = 0;
	run.glyphs.forEach( ( glyph, index ) => {
		const position = run.positions[ index ];
		paths.push(
			<path
				key={ index }
				transform={
					'translate(' +
					( x + position.xOffset ) +
					' ' +
					( y + position.yOffset ) +
					')'
				}
				d={ glyph.path.toSVG() }
			/>
		);
		x += position.xAdvance;
		y += position.yAdvance;
	} );
	return (
		<div className="ctbd-element__clip">
			<svg
				className="ctbd-element__glyphs"
				role="img"
				aria-label={ layout.text }
			>
				<title>{ layout.text }</title>
				<g
					fill={ color }
					transform={
						'translate(' +
						layout.x * scale +
						' ' +
						layout.baseline * scale +
						') scale(' +
						units +
						' ' +
						-units +
						')'
					}
				>
					{ paths }
				</g>
			</svg>
		</div>
	);
}

function TextView( { element, layout, fonts, scale } ) {
	// The face the layout chose: the box's own, or Inter as its fallback.
	const loaded = layout && fonts[ layout.faceKey ];
	if ( ! loaded ) {
		return null;
	}
	if ( layout.missing && layout.missing.length ) {
		return (
			<GlyphText
				font={ loaded.font }
				layout={ layout }
				color={ element.color }
				scale={ scale }
			/>
		);
	}
	const lineHeight = ( layout.ascent - layout.descent ) * scale;
	return (
		<div className="ctbd-element__clip">
			<span
				className="ctbd-element__text"
				style={ {
					left: layout.x * scale,
					top: ( layout.baseline - layout.ascent ) * scale,
					fontFamily: loaded.css,
					fontSize: layout.size * PT_TO_MM * scale,
					lineHeight: lineHeight + 'px',
					color: element.color,
				} }
			>
				{ layout.text }
			</span>
		</div>
	);
}

function QrView( { element, attendee } ) {
	const url = profileUrl( attendee );
	if ( ! url ) {
		// Nothing is printed; the editor shows where the code would go.
		return (
			<span className="ctbd-element__placeholder">
				{ __( 'No username: no QR code', 'camptix-badge-designer' ) }
			</span>
		);
	}
	const qr = profileQr( url );
	return (
		<svg
			className="ctbd-element__qr"
			viewBox={ '0 0 ' + qr.size + ' ' + qr.size }
			shapeRendering="crispEdges"
			aria-label={ __( 'QR code', 'camptix-badge-designer' ) }
		>
			{ ! element.transparent && (
				<rect width={ qr.size } height={ qr.size } fill="#fff" />
			) }
			<path d={ qr.path } fill="#000" />
		</svg>
	);
}

function GravatarView( { element, attendee, scale, images } ) {
	// URLs that failed to load, so the next one is tried.
	const [ failed, setFailed ] = useState( [] );
	// Ask for about the size on screen, in steps, so zooming reuses images.
	const px = Math.min(
		2048,
		Math.ceil(
			( element.width * scale * ( window.devicePixelRatio || 1 ) ) / 64
		) * 64
	);
	const url = gravatarUrls( attendee, px, element.fallback ).find(
		( candidate ) => ! failed.includes( candidate )
	);
	const className =
		'ctbd-element__gravatar' +
		( element.shape === 'round' ? ' is-round' : '' );

	if ( ! url ) {
		// No Gravatar: the fixed fallback image, if there is one.
		const fallbackUrl =
			element.fallback === 'image' && images[ element.fallbackImage ];
		if ( fallbackUrl ) {
			return (
				<img
					className={ className }
					src={ fallbackUrl }
					alt=""
					draggable="false"
				/>
			);
		}
		// No Gravatar: nothing is printed; the editor shows a silhouette.
		return (
			<span
				className={ className + ' is-missing' }
				title={ __(
					'No Gravatar for this attendee',
					'camptix-badge-designer'
				) }
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<circle cx="12" cy="9" r="4" />
					<path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6z" />
				</svg>
			</span>
		);
	}
	return (
		<img
			className={ className }
			src={ url }
			alt=""
			draggable="false"
			onError={ () => setFailed( ( current ) => [ ...current, url ] ) }
		/>
	);
}

export function ElementView( {
	element,
	attendee,
	scale,
	fonts,
	layout,
	images,
} ) {
	if ( element.type === 'text' ) {
		return (
			<TextView
				element={ element }
				layout={ layout }
				fonts={ fonts }
				scale={ scale }
			/>
		);
	}
	if ( element.type === 'qr' ) {
		return <QrView element={ element } attendee={ attendee } />;
	}
	return (
		<GravatarView
			element={ element }
			attendee={ attendee }
			scale={ scale }
			images={ images }
		/>
	);
}
