/**
 * The canvas: the badge page (trim size plus bleed) scaled to fit the
 * available space, with its background and the guides.
 */
import { useEffect, useRef, useState } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import { loadPdf } from '../pdf';
import { pageSize } from '../geometry';

// Free space around the page, in screen pixels.
const MARGIN = 32;

/**
 * Draws page 1 of a PDF so it fills the given box, at the screen's
 * resolution. A PDF whose shape does not match is stretched, as it will
 * be in the generated PDF.
 *
 * @param {Object} props
 * @param {string} props.url    PDF URL.
 * @param {number} props.width  Box width in CSS pixels.
 * @param {number} props.height Box height in CSS pixels.
 */
function PdfBackground( { url, width, height } ) {
	const canvasRef = useRef( null );
	const [ state, setState ] = useState( 'loading' );

	useEffect( () => {
		let cancelled = false;
		let task = null;

		// Wait until resizing settles before rendering again.
		const timer = setTimeout( async () => {
			try {
				const pdf = await loadPdf( url );
				const page = await pdf.getPage( 1 );
				if ( cancelled ) {
					return;
				}
				const ratio = window.devicePixelRatio || 1;
				const base = page.getViewport( { scale: 1 } );
				const viewport = page.getViewport( {
					scale: ( width / base.width ) * ratio,
				} );
				const canvas = canvasRef.current;
				canvas.width = Math.round( width * ratio );
				canvas.height = Math.round( height * ratio );
				// Stretch vertically if the page shape differs from the box.
				const stretch = canvas.height / viewport.height;
				task = page.render( {
					canvas,
					viewport,
					transform: [ 1, 0, 0, stretch, 0, 0 ],
				} );
				await task.promise;
				if ( ! cancelled ) {
					setState( 'ready' );
				}
			} catch ( error ) {
				if (
					! cancelled &&
					error?.name !== 'RenderingCancelledException'
				) {
					setState( 'error' );
				}
			}
		}, 150 );

		return () => {
			cancelled = true;
			clearTimeout( timer );
			if ( task ) {
				task.cancel();
			}
		};
	}, [ url, width, height ] );

	return (
		<>
			<canvas
				ref={ canvasRef }
				className="ctbg-canvas__background"
				style={ { width, height } }
			/>
			{ state === 'loading' && (
				<div className="ctbg-canvas__overlay">
					<Spinner />
				</div>
			) }
			{ state === 'error' && (
				<div className="ctbg-canvas__overlay">
					The PDF background could not be loaded.
				</div>
			) }
		</>
	);
}

export function Canvas( { design, backgroundFile, onSelectBackground } ) {
	const areaRef = useRef( null );
	const [ area, setArea ] = useState( { width: 0, height: 0 } );

	useEffect( () => {
		const observer = new window.ResizeObserver( ( [ entry ] ) => {
			setArea( {
				width: entry.contentRect.width,
				height: entry.contentRect.height,
			} );
		} );
		observer.observe( areaRef.current );
		return () => observer.disconnect();
	}, [] );

	const { size, background, guides } = design;
	const page = pageSize( size );
	const scale = Math.max(
		0,
		Math.min(
			( area.width - 2 * MARGIN ) / page.width,
			( area.height - 2 * MARGIN ) / page.height
		)
	);
	const width = Math.floor( page.width * scale );
	const height = Math.floor( page.height * scale );
	const mm = ( value ) => value * scale;

	let backgroundLayer = null;
	if ( background && backgroundFile ) {
		if ( background.type === 'pdf' ) {
			backgroundLayer = (
				<PdfBackground
					url={ backgroundFile.url }
					width={ width }
					height={ height }
				/>
			);
		} else {
			backgroundLayer = (
				<img
					className="ctbg-canvas__background"
					src={ backgroundFile.url }
					alt=""
				/>
			);
		}
	} else if ( background && ! backgroundFile ) {
		backgroundLayer = (
			<div className="ctbg-canvas__overlay">
				The background file is no longer in the Media Library.
			</div>
		);
	} else {
		backgroundLayer = (
			<div className="ctbg-canvas__overlay">
				<p>No background yet.</p>
				<Button variant="secondary" onClick={ onSelectBackground }>
					Select background
				</Button>
			</div>
		);
	}

	return (
		<main className="ctbg-canvas" ref={ areaRef } aria-label="Badge canvas">
			{ scale > 0 && (
				<div className="ctbg-canvas__page" style={ { width, height } }>
					{ backgroundLayer }
					{ guides && (
						<>
							<div
								className="ctbg-canvas__trim"
								title={
									'Trim: ' +
									size.width +
									' × ' +
									size.height +
									' mm'
								}
								style={ {
									left: mm( size.bleed ),
									top: mm( size.bleed ),
									width: mm( size.width ),
									height: mm( size.height ),
								} }
							/>
							<div
								className="ctbg-canvas__safe"
								title={
									'Safe area: ' +
									size.safe +
									' mm inside the trim'
								}
								style={ {
									left: mm( size.bleed + size.safe ),
									top: mm( size.bleed + size.safe ),
									width: mm(
										Math.max(
											0,
											size.width - 2 * size.safe
										)
									),
									height: mm(
										Math.max(
											0,
											size.height - 2 * size.safe
										)
									),
								} }
							/>
						</>
					) }
				</div>
			) }
		</main>
	);
}
