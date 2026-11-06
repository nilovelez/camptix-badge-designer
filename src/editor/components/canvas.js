/**
 * The canvas: the badge page (trim size plus bleed) scaled to fit the
 * available space, with its background, the guides and the elements for
 * the attendee on screen.
 */
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Button, Spinner } from '@wordpress/components';
import { loadPdf } from '../pdf';
import { HOLE_MARK_LENGTH, pageSize } from '../geometry';
import { isPastTrim, moveElement, resizeElement } from '../elements';
import { ElementView } from './element-view';

// Free space around the page, in screen pixels.
const MARGIN = 32;
// Snap distance to the center lines, in screen pixels.
const SNAP_PX = 6;
const CORNERS = [ 'nw', 'ne', 'sw', 'se' ];

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
				className="ctbd-canvas__background"
				style={ { width, height } }
			/>
			{ state === 'loading' && (
				<div className="ctbd-canvas__overlay">
					<Spinner />
				</div>
			) }
			{ state === 'error' && (
				<div className="ctbd-canvas__overlay">
					{ __(
						'The PDF background could not be loaded.',
						'camptix-badge-designer'
					) }
				</div>
			) }
		</>
	);
}

/**
 * One element on the canvas, with its selection frame and handles.
 *
 * @param {Object}   props
 * @param {Object}   props.element  Element.
 * @param {number}   props.scale    Screen pixels per mm.
 * @param {Object}   props.size     Print size.
 * @param {boolean}  props.selected Whether it is selected.
 * @param {Object}   props.layout   Text layout for this attendee, or null.
 * @param {Function} props.onSelect Called with the element id.
 * @param {Function} props.onChange Called with the changed element and an undo group.
 * @param {Function} props.onSnap   Called with the axes being snapped, or null.
 * @param {Object}   props.children Content.
 */
function ElementBox( {
	element,
	scale,
	size,
	selected,
	layout,
	onSelect,
	onChange,
	onSnap,
	children,
} ) {
	function startDrag( event, mode ) {
		if ( event.button !== 0 ) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		onSelect( element.id );

		const start = { x: event.clientX, y: event.clientY };
		const group = 'drag-' + element.id + '-' + Date.now();
		const target = event.currentTarget;
		target.setPointerCapture( event.pointerId );
		let moved = false;

		function onMove( moveEvent ) {
			const px = moveEvent.clientX - start.x;
			const py = moveEvent.clientY - start.y;
			// A click is not a move.
			if ( ! moved && Math.abs( px ) < 3 && Math.abs( py ) < 3 ) {
				return;
			}
			moved = true;
			if ( mode === 'move' ) {
				const result = moveElement(
					element,
					px / scale,
					py / scale,
					size,
					SNAP_PX / scale
				);
				onSnap( { x: result.snapX, y: result.snapY } );
				onChange( result.element, group );
			} else {
				onChange(
					resizeElement( element, mode, px / scale, py / scale ),
					group
				);
			}
		}
		function onUp() {
			target.removeEventListener( 'pointermove', onMove );
			target.removeEventListener( 'pointerup', onUp );
			target.removeEventListener( 'pointercancel', onUp );
			onSnap( null );
		}
		target.addEventListener( 'pointermove', onMove );
		target.addEventListener( 'pointerup', onUp );
		target.addEventListener( 'pointercancel', onUp );
	}

	const overflow = layout && layout.overflow;
	// Characters the font cannot print, drawn as the PDF will: empty boxes.
	const missing = layout && layout.missing && layout.missing.length > 0;
	let warning = '';
	if ( missing ) {
		warning = __(
			'The font cannot print some characters of this attendee: they print as empty boxes.',
			'camptix-badge-designer'
		);
	} else if ( overflow ) {
		warning = __(
			'This text does not fit for this attendee, even made smaller: it is cut.',
			'camptix-badge-designer'
		);
	}
	let className = 'ctbd-element is-' + element.type;
	if ( selected ) {
		className += ' is-selected';
	}
	if ( warning ) {
		className += ' is-overflow';
	}
	if ( isPastTrim( element, size ) ) {
		className += ' is-past-trim';
	}

	return (
		<div
			className={ className }
			style={ {
				left: element.x * scale,
				top: element.y * scale,
				width: element.width * scale,
				height: element.height * scale,
			} }
			onPointerDown={ ( event ) => startDrag( event, 'move' ) }
		>
			{ children }
			{ warning && (
				<span className="ctbd-element__warning" title={ warning }>
					!
				</span>
			) }
			{ selected &&
				CORNERS.map( ( corner ) => (
					<span
						key={ corner }
						className={ 'ctbd-element__handle is-' + corner }
						onPointerDown={ ( event ) =>
							startDrag( event, corner )
						}
					/>
				) ) }
		</div>
	);
}

export function Canvas( {
	design,
	backgroundFile,
	onSelectBackground,
	attendee,
	fonts,
	layouts,
	selectedId,
	onSelect,
	onChangeElement,
	images,
} ) {
	const areaRef = useRef( null );
	const [ area, setArea ] = useState( { width: 0, height: 0 } );
	const [ snap, setSnap ] = useState( null );

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
					className="ctbd-canvas__background"
					src={ backgroundFile.url }
					alt=""
				/>
			);
		}
	} else if ( background && ! backgroundFile ) {
		backgroundLayer = (
			<div className="ctbd-canvas__overlay">
				{ __(
					'The background file is no longer in the Media Library.',
					'camptix-badge-designer'
				) }
			</div>
		);
	} else {
		backgroundLayer = (
			<div className="ctbd-canvas__overlay is-empty">
				<p>{ __( 'No background yet.', 'camptix-badge-designer' ) }</p>
				<Button variant="secondary" onClick={ onSelectBackground }>
					{ __( 'Select background', 'camptix-badge-designer' ) }
				</Button>
			</div>
		);
	}

	return (
		<main
			className="ctbd-canvas"
			ref={ areaRef }
			aria-label={ __( 'Badge canvas', 'camptix-badge-designer' ) }
			onPointerDown={ () => onSelect( null ) }
		>
			{ scale > 0 && (
				<div className="ctbd-canvas__page" style={ { width, height } }>
					{ backgroundLayer }
					{ guides && (
						<>
							<div
								className="ctbd-canvas__trim"
								title={ sprintf(
									/* translators: 1: width, 2: height, in millimeters. */
									__(
										'Trim: %1$s × %2$s mm',
										'camptix-badge-designer'
									),
									size.width,
									size.height
								) }
								style={ {
									left: mm( size.bleed ),
									top: mm( size.bleed ),
									width: mm( size.width ),
									height: mm( size.height ),
								} }
							/>
							<div
								className="ctbd-canvas__safe"
								title={ sprintf(
									/* translators: %s: distance in millimeters. */
									__(
										'Safe area: %s mm inside the trim',
										'camptix-badge-designer'
									),
									size.safe
								) }
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
					<div
						className="ctbd-canvas__elements"
						style={ {
							left: mm( size.bleed ),
							top: mm( size.bleed ),
							width: mm( size.width ),
							height: mm( size.height ),
						} }
					>
						{ design.elements.map( ( element ) => (
							<ElementBox
								key={ element.id }
								element={ element }
								scale={ scale }
								size={ size }
								selected={ element.id === selectedId }
								layout={ layouts[ element.id ] }
								onSelect={ onSelect }
								onChange={ onChangeElement }
								onSnap={ setSnap }
							>
								<ElementView
									element={ element }
									attendee={ attendee }
									scale={ scale }
									fonts={ fonts }
									layout={ layouts[ element.id ] }
									images={ images }
								/>
							</ElementBox>
						) ) }
						{ design.holeMark && (
							<div
								className="ctbd-canvas__hole"
								title={ __(
									'Mark for the lanyard hole',
									'camptix-badge-designer'
								) }
								style={ {
									left: mm( size.width / 2 ),
									top: mm( -size.bleed ),
									height: mm( HOLE_MARK_LENGTH + size.bleed ),
								} }
							/>
						) }
						{ snap && snap.x && (
							<div className="ctbd-canvas__snap is-vertical" />
						) }
						{ snap && snap.y && (
							<div className="ctbd-canvas__snap is-horizontal" />
						) }
					</div>
				</div>
			) }
		</main>
	);
}
