/**
 * What each element shows on the canvas for the attendee on screen.
 */
import { useState } from '@wordpress/element';
import { profileQr } from '../../shared/qr';
import { faceKey, resolveFace } from '../fonts';

const PT_TO_MM = 25.4 / 72;

function TextView( { element, layout, fonts, scale } ) {
	const face = resolveFace( element.font, element.weight );
	const loaded = face && fonts[ faceKey( face ) ];
	if ( ! loaded || ! layout ) {
		return null;
	}
	const lineHeight = ( layout.ascent - layout.descent ) * scale;
	return (
		<div className="ctbg-element__clip">
			<span
				className="ctbg-element__text"
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

function QrView( { attendee } ) {
	if ( ! attendee.username ) {
		// Nothing is printed; the editor shows where the code would go.
		return (
			<span className="ctbg-element__placeholder">
				No username: no QR code
			</span>
		);
	}
	const qr = profileQr( attendee.username );
	return (
		<svg
			className="ctbg-element__qr"
			viewBox={ '0 0 ' + qr.size + ' ' + qr.size }
			shapeRendering="crispEdges"
			aria-label="QR code"
		>
			<rect width={ qr.size } height={ qr.size } fill="#fff" />
			<path d={ qr.path } fill="#000" />
		</svg>
	);
}

function GravatarView( { element, attendee, scale } ) {
	const [ failed, setFailed ] = useState( '' );
	// Ask for about the size on screen, in steps, so zooming reuses images.
	const px = Math.min(
		2048,
		Math.ceil(
			( element.width * scale * ( window.devicePixelRatio || 1 ) ) / 64
		) * 64
	);
	const url = attendee.gravatarHash
		? 'https://gravatar.com/avatar/' +
			attendee.gravatarHash +
			'?s=' +
			px +
			'&d=' +
			element.fallback +
			'&r=g'
		: '';
	const className =
		'ctbg-element__gravatar' +
		( element.shape === 'round' ? ' is-round' : '' );

	if ( ! url || failed === url ) {
		// No Gravatar: nothing is printed; the editor shows a silhouette.
		return (
			<span
				className={ className + ' is-missing' }
				title="No Gravatar for this attendee"
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
			onError={ () => setFailed( url ) }
		/>
	);
}

export function ElementView( { element, attendee, scale, fonts, layout } ) {
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
		return <QrView attendee={ attendee } />;
	}
	return (
		<GravatarView
			element={ element }
			attendee={ attendee }
			scale={ scale }
		/>
	);
}
