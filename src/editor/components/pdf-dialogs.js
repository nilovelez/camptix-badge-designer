/**
 * Preview badge (a one-page PDF of the attendee on screen) and Generate
 * PDF (one page per attendee, for a range of pages).
 */
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	Button,
	Modal,
	Notice,
	RadioControl,
	SelectControl,
	Spinner,
} from '@wordpress/components';
import { pageGeometry } from '../geometry';
import { loadPdf } from '../pdf';

/**
 * The PDF generator, with pdf-lib, loaded the first time a PDF is made, so
 * the editor itself loads without it.
 *
 * @return {Promise<Function>} buildBadgesPdf().
 */
async function loadBuilder() {
	const module = await import(
		/* webpackChunkName: "build-pdf" */ '../build-pdf'
	);
	return module.buildBadgesPdf;
}

function stepLabel( step, done, total ) {
	if ( step === 'gravatars' && total ) {
		return sprintf(
			/* translators: 1: Gravatars fetched so far, 2: Gravatars to fetch. */
			__( 'Fetching Gravatars %1$d of %2$d', 'camptix-badge-designer' ),
			done,
			total
		);
	}
	if ( step === 'pages' && total ) {
		return sprintf(
			/* translators: 1: pages laid out so far, 2: pages to lay out. */
			__( 'Laying out pages %1$d of %2$d', 'camptix-badge-designer' ),
			done,
			total
		);
	}
	const labels = {
		fonts: __( 'Embedding fonts…', 'camptix-badge-designer' ),
		background: __( 'Embedding the background…', 'camptix-badge-designer' ),
		gravatars: __( 'Fetching Gravatars…', 'camptix-badge-designer' ),
		pages: __( 'Laying out pages…', 'camptix-badge-designer' ),
		saving: __( 'Saving the PDF…', 'camptix-badge-designer' ),
	};
	return labels[ step ] || '';
}

function formatSize( bytes ) {
	if ( bytes < 1048576 ) {
		return Math.max( 1, Math.round( bytes / 1024 ) ) + ' KB';
	}
	return ( bytes / 1048576 ).toFixed( 1 ) + ' MB';
}

/**
 * Saves a file, as a download.
 *
 * @param {string} url      Object URL.
 * @param {string} filename File name.
 */
function download( url, filename ) {
	const link = document.createElement( 'a' );
	link.href = url;
	link.download = filename;
	document.body.appendChild( link );
	link.click();
	link.remove();
}

function Progress( { progress } ) {
	if ( ! progress ) {
		return <Spinner />;
	}
	const label = stepLabel( progress.step, progress.done, progress.total );
	const percent = progress.total
		? Math.round( ( progress.done / progress.total ) * 100 )
		: null;
	return (
		<div className="ctbd-progress">
			<p>{ label }</p>
			<div className="ctbd-progress__bar">
				<span
					style={ {
						width: ( percent === null ? 100 : percent ) + '%',
					} }
					className={ percent === null ? 'is-indeterminate' : '' }
				/>
			</div>
		</div>
	);
}

/**
 * Builds a PDF and keeps its object URL until the dialog closes.
 *
 * @return {Object} Build state and the function that starts it.
 */
function useBuild() {
	const [ state, setState ] = useState( { status: 'idle' } );
	const controller = useRef( null );
	const urlRef = useRef( null );

	useEffect(
		() => () => {
			if ( controller.current ) {
				controller.current.abort();
			}
			if ( urlRef.current ) {
				URL.revokeObjectURL( urlRef.current );
			}
		},
		[]
	);

	async function start( options ) {
		controller.current = new window.AbortController();
		setState( { status: 'running', progress: null } );
		const started = performance.now();
		try {
			const buildBadgesPdf = await loadBuilder();
			const result = await buildBadgesPdf( {
				...options,
				signal: controller.current.signal,
				onProgress: ( progress ) =>
					setState( { status: 'running', progress } ),
			} );
			const blob = new window.Blob( [ result.bytes ], {
				type: 'application/pdf',
			} );
			urlRef.current = URL.createObjectURL( blob );
			setState( {
				status: 'done',
				url: urlRef.current,
				bytes: result.bytes,
				stats: result.stats,
				seconds: ( performance.now() - started ) / 1000,
			} );
			return urlRef.current;
		} catch ( error ) {
			if ( error.name === 'AbortError' ) {
				setState( { status: 'idle' } );
			} else {
				setState( {
					status: 'error',
					message: error.message || String( error ),
				} );
			}
			return null;
		}
	}

	function cancel() {
		if ( controller.current ) {
			controller.current.abort();
		}
	}

	return { state, start, cancel };
}

function GravatarNote( { stats } ) {
	if ( ! stats.gravatarsFailed ) {
		return null;
	}
	return (
		<Notice status="warning" isDismissible={ false }>
			{ sprintf(
				/* translators: %d: number of Gravatars. */
				_n(
					'%d Gravatar could not be downloaded (network error); that badge has none.',
					'%d Gravatars could not be downloaded (network error); those badges have none.',
					stats.gravatarsFailed,
					'camptix-badge-designer'
				),
				stats.gravatarsFailed
			) }
		</Notice>
	);
}

export function PreviewDialog( {
	design,
	backgroundFile,
	images,
	attendee,
	onClose,
} ) {
	const { state, start } = useBuild();
	const canvasRef = useRef( null );
	const filename = 'badge-preview-' + attendee.number + '.pdf';

	useEffect( () => {
		start( { design, backgroundFile, images, attendees: [ attendee ] } );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	// Show the PDF itself, rendered by PDF.js: what the print shop gets.
	useEffect( () => {
		if ( state.status !== 'done' ) {
			return;
		}
		let cancelled = false;
		( async () => {
			const pdf = await loadPdf( state.url );
			const page = await pdf.getPage( 1 );
			if ( cancelled ) {
				return;
			}
			const base = page.getViewport( { scale: 1 } );
			const ratio = window.devicePixelRatio || 1;
			const height = Math.min( 560, window.innerHeight - 260 );
			const viewport = page.getViewport( {
				scale: ( height / base.height ) * ratio,
			} );
			const canvas = canvasRef.current;
			canvas.width = viewport.width;
			canvas.height = viewport.height;
			canvas.style.width = viewport.width / ratio + 'px';
			canvas.style.height = viewport.height / ratio + 'px';
			await page.render( { canvas, viewport } ).promise;
		} )();
		return () => {
			cancelled = true;
		};
	}, [ state ] );

	return (
		<Modal
			title={ sprintf(
				/* translators: %d: badge number. */
				__( 'Preview: badge %d', 'camptix-badge-designer' ),
				attendee.number
			) }
			onRequestClose={ onClose }
			className="ctbd-pdf-dialog"
		>
			{ state.status === 'running' && (
				<Progress progress={ state.progress } />
			) }
			{ state.status === 'error' && (
				<Notice status="error" isDismissible={ false }>
					{ sprintf(
						/* translators: %s: error message. */
						__(
							'The preview could not be made: %s',
							'camptix-badge-designer'
						),
						state.message
					) }
				</Notice>
			) }
			{ state.status === 'done' && (
				<>
					<p className="ctbd-help">
						{ sprintf(
							/* translators: 1: page width, 2: page height, in millimeters; 3: file size. */
							__(
								'The PDF as the print shop will get it: %1$s × %2$s mm, %3$s.',
								'camptix-badge-designer'
							),
							pageGeometry( design ).width,
							pageGeometry( design ).height,
							formatSize( state.bytes.length )
						) }
					</p>
					<div className="ctbd-pdf-dialog__preview">
						<canvas ref={ canvasRef } />
					</div>
					<GravatarNote stats={ state.stats } />
				</>
			) }
			<div className="ctbd-pdf-dialog__actions">
				<Button variant="tertiary" onClick={ onClose }>
					{ __( 'Close', 'camptix-badge-designer' ) }
				</Button>
				{ state.status === 'done' && (
					<>
						<Button
							variant="secondary"
							href={ state.url }
							target="_blank"
							rel="noreferrer"
						>
							{ __(
								'Open in a new tab',
								'camptix-badge-designer'
							) }
						</Button>
						<Button
							variant="primary"
							onClick={ () => download( state.url, filename ) }
						>
							{ __( 'Download', 'camptix-badge-designer' ) }
						</Button>
					</>
				) }
			</div>
		</Modal>
	);
}

export function GenerateDialog( {
	design,
	backgroundFile,
	images,
	attendees,
	flags,
	overflows,
	missing,
	onClose,
} ) {
	const total = attendees.length;
	const [ range, setRange ] = useState( 'all' );
	const [ from, setFrom ] = useState( '1' );
	const [ to, setTo ] = useState( String( total ) );
	// A CampTix admin flag, to print only the attendees who have it.
	const [ flag, setFlag ] = useState( '' );
	const { state, start, cancel } = useBuild();

	const first = range === 'all' ? 1 : parseInt( from, 10 );
	const last = range === 'all' ? total : parseInt( to, 10 );
	const validRange = first >= 1 && last <= total && first <= last;
	const selected = validRange
		? attendees
				.slice( first - 1, last )
				.filter(
					( a ) => ! flag || ( a.flags && a.flags.includes( flag ) )
				)
		: [];
	const valid = selected.length > 0;
	const count = selected.length;
	const geometry = pageGeometry( design );
	const selectedNumbers = new Set( selected.map( ( a ) => a.number ) );
	const cut = overflows.filter( ( item ) =>
		selectedNumbers.has( item.number )
	).length;
	const unprintable = missing.filter( ( item ) =>
		selectedNumbers.has( item.number )
	).length;
	const withoutQr = selected.filter( ( a ) => ! a.username ).length;
	const filename =
		'badges-' + first + '-' + last + ( flag ? '-' + flag : '' ) + '.pdf';
	const pageSizes = [
		geometry.width,
		geometry.height,
		design.size.width,
		design.size.height,
		design.size.bleed,
	];
	const pagesText = design.cropMarks
		? sprintf(
				/* translators: 1: page width, 2: page height, 3: trim width, 4: trim height, 5: bleed, all in millimeters. */
				__(
					'%1$s × %2$s mm pages (%3$s × %4$s mm + %5$s mm bleed), with crop marks.',
					'camptix-badge-designer'
				),
				...pageSizes
			)
		: sprintf(
				/* translators: 1: page width, 2: page height, 3: trim width, 4: trim height, 5: bleed, all in millimeters. */
				__(
					'%1$s × %2$s mm pages (%3$s × %4$s mm + %5$s mm bleed).',
					'camptix-badge-designer'
				),
				...pageSizes
			);

	async function generate() {
		const url = await start( {
			design,
			backgroundFile,
			images,
			attendees: selected,
		} );
		if ( url ) {
			download( url, filename );
		}
	}

	const running = state.status === 'running';

	return (
		<Modal
			title={ __( 'Generate PDF', 'camptix-badge-designer' ) }
			onRequestClose={ running ? cancel : onClose }
			className="ctbd-pdf-dialog ctbd-generate-dialog"
		>
			{ state.status !== 'done' && (
				<>
					<p className="ctbd-help">
						{ __(
							'One page per attendee, numbered in purchase order.',
							'camptix-badge-designer'
						) }
					</p>
					<RadioControl
						label={ __( 'Pages', 'camptix-badge-designer' ) }
						selected={ range }
						disabled={ running }
						options={ [
							{
								label: sprintf(
									/* translators: %d: number of the last page. */
									__(
										'All (1–%d)',
										'camptix-badge-designer'
									),
									total
								),
								value: 'all',
							},
							{
								label: __(
									'A range',
									'camptix-badge-designer'
								),
								value: 'range',
							},
						] }
						onChange={ setRange }
					/>
					{ range === 'range' && (
						<div className="ctbd-range">
							<label htmlFor="ctbd-range-from">
								{ __( 'From', 'camptix-badge-designer' ) }
							</label>
							<input
								id="ctbd-range-from"
								type="number"
								min="1"
								max={ total }
								value={ from }
								disabled={ running }
								onChange={ ( e ) => setFrom( e.target.value ) }
							/>
							<label htmlFor="ctbd-range-to">
								{ __( 'to', 'camptix-badge-designer' ) }
							</label>
							<input
								id="ctbd-range-to"
								type="number"
								min="1"
								max={ total }
								value={ to }
								disabled={ running }
								onChange={ ( e ) => setTo( e.target.value ) }
							/>
						</div>
					) }
					{ flags.length > 0 && (
						<SelectControl
							__next40pxDefaultSize
							__nextHasNoMarginBottom
							className="ctbd-generate-dialog__flag"
							label={ __(
								'Attendees',
								'camptix-badge-designer'
							) }
							value={ flag }
							disabled={ running }
							options={ [
								{
									label: __(
										'Everyone',
										'camptix-badge-designer'
									),
									value: '',
								},
								...flags.map( ( item ) => ( {
									label: sprintf(
										/* translators: %s: name of a CampTix admin flag, such as Volunteer. */
										__(
											'Only those flagged: %s',
											'camptix-badge-designer'
										),
										item.label
									),
									value: item.key,
								} ) ),
							] }
							onChange={ setFlag }
							help={ __(
								'Admin flags are set on each attendee in CampTix.',
								'camptix-badge-designer'
							) }
						/>
					) }
					<div className="ctbd-summary">
						{ valid ? (
							<>
								<strong>
									{ sprintf(
										/* translators: %d: number of badges. */
										_n(
											'%d badge',
											'%d badges',
											count,
											'camptix-badge-designer'
										),
										count
									) }
								</strong>
								<span>{ pagesText }</span>
								{ design.folded && (
									<span>
										{ __(
											'Folded: each page has the badge twice, the top one upside down, to fold in half.',
											'camptix-badge-designer'
										) }
									</span>
								) }
								{ withoutQr > 0 && (
									<span>
										{ sprintf(
											/* translators: %d: number of badges. */
											__(
												'%d without a QR code (no username).',
												'camptix-badge-designer'
											),
											withoutQr
										) }
									</span>
								) }
								{ cut > 0 && (
									<span className="is-warning">
										{ sprintf(
											/* translators: %d: number of badges. */
											__(
												'%d with text that is cut.',
												'camptix-badge-designer'
											),
											cut
										) }
									</span>
								) }
								{ unprintable > 0 && (
									<span className="is-warning">
										{ sprintf(
											/* translators: %d: number of badges. */
											__(
												'%d with characters the font cannot print (see Attendees).',
												'camptix-badge-designer'
											),
											unprintable
										) }
									</span>
								) }
							</>
						) : (
							<span className="is-warning">
								{ validRange
									? __(
											'No attendee in these pages has this flag.',
											'camptix-badge-designer'
										)
									: sprintf(
											/* translators: %d: number of the last page. */
											__(
												'Choose pages between 1 and %d, the first not after the last.',
												'camptix-badge-designer'
											),
											total
										) }
							</span>
						) }
					</div>
				</>
			) }
			{ running && <Progress progress={ state.progress } /> }
			{ state.status === 'error' && (
				<Notice status="error" isDismissible={ false }>
					{ sprintf(
						/* translators: %s: error message. */
						__(
							'The PDF could not be made: %s',
							'camptix-badge-designer'
						),
						state.message
					) }
				</Notice>
			) }
			{ state.status === 'done' && (
				<>
					<Notice status="success" isDismissible={ false }>
						{ sprintf(
							/* translators: 1: number of badges, 2: file size, 3: seconds. */
							_n(
								'%1$d badge, %2$s, made in %3$s s. The download has started.',
								'%1$d badges, %2$s, made in %3$s s. The download has started.',
								state.stats.pages,
								'camptix-badge-designer'
							),
							state.stats.pages,
							formatSize( state.bytes.length ),
							state.seconds.toFixed( 1 )
						) }
					</Notice>
					<GravatarNote stats={ state.stats } />
				</>
			) }
			<div className="ctbd-pdf-dialog__actions">
				{ running && (
					<Button variant="tertiary" onClick={ cancel }>
						{ __( 'Cancel', 'camptix-badge-designer' ) }
					</Button>
				) }
				{ ! running && (
					<Button variant="tertiary" onClick={ onClose }>
						{ state.status === 'done'
							? __( 'Close', 'camptix-badge-designer' )
							: __( 'Cancel', 'camptix-badge-designer' ) }
					</Button>
				) }
				{ state.status === 'done' && (
					<Button
						variant="secondary"
						onClick={ () => download( state.url, filename ) }
					>
						{ __( 'Download again', 'camptix-badge-designer' ) }
					</Button>
				) }
				{ state.status !== 'done' && (
					<Button
						variant="primary"
						disabled={ ! valid || running }
						isBusy={ running }
						onClick={ generate }
					>
						{ __( 'Generate PDF', 'camptix-badge-designer' ) }
					</Button>
				) }
			</div>
		</Modal>
	);
}
