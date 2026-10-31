/**
 * Preview badge (a one-page PDF of the attendee on screen) and Generate
 * PDF (one page per attendee, for a range of pages).
 */
import { useEffect, useRef, useState } from '@wordpress/element';
import {
	Button,
	Modal,
	Notice,
	RadioControl,
	Spinner,
} from '@wordpress/components';
import { buildBadgesPdf, pageGeometry } from '../build-pdf';
import { loadPdf } from '../pdf';

const STEP_LABELS = {
	fonts: 'Embedding fonts…',
	background: 'Embedding the background…',
	gravatars: 'Fetching Gravatars',
	pages: 'Laying out pages',
	saving: 'Saving the PDF…',
};

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
	const label = STEP_LABELS[ progress.step ] || '';
	const counted = progress.total
		? ' ' + progress.done + ' of ' + progress.total
		: '';
	const percent = progress.total
		? Math.round( ( progress.done / progress.total ) * 100 )
		: null;
	return (
		<div className="ctbd-progress">
			<p>
				{ label }
				{ counted }
			</p>
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
			{ stats.gravatarsFailed } Gravatars could not be downloaded (network
			error); those badges have none.
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
			title={ 'Preview: badge ' + attendee.number }
			onRequestClose={ onClose }
			className="ctbd-pdf-dialog"
		>
			{ state.status === 'running' && (
				<Progress progress={ state.progress } />
			) }
			{ state.status === 'error' && (
				<Notice status="error" isDismissible={ false }>
					The preview could not be made: { state.message }
				</Notice>
			) }
			{ state.status === 'done' && (
				<>
					<p className="ctbd-help">
						The PDF as the print shop will get it:{ ' ' }
						{ pageGeometry( design ).width } ×{ ' ' }
						{ pageGeometry( design ).height } mm,{ ' ' }
						{ formatSize( state.bytes.length ) }.
					</p>
					<div className="ctbd-pdf-dialog__preview">
						<canvas ref={ canvasRef } />
					</div>
					<GravatarNote stats={ state.stats } />
				</>
			) }
			<div className="ctbd-pdf-dialog__actions">
				<Button variant="tertiary" onClick={ onClose }>
					Close
				</Button>
				{ state.status === 'done' && (
					<>
						<Button
							variant="secondary"
							href={ state.url }
							target="_blank"
							rel="noreferrer"
						>
							Open in a new tab
						</Button>
						<Button
							variant="primary"
							onClick={ () => download( state.url, filename ) }
						>
							Download
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
	overflows,
	onClose,
} ) {
	const total = attendees.length;
	const [ range, setRange ] = useState( 'all' );
	const [ from, setFrom ] = useState( '1' );
	const [ to, setTo ] = useState( String( total ) );
	const { state, start, cancel } = useBuild();

	const first = range === 'all' ? 1 : parseInt( from, 10 );
	const last = range === 'all' ? total : parseInt( to, 10 );
	const valid = first >= 1 && last <= total && first <= last;
	const count = valid ? last - first + 1 : 0;
	const geometry = pageGeometry( design );
	const cut = valid
		? overflows.filter(
				( item ) => item.number >= first && item.number <= last
			).length
		: 0;
	const withoutQr = valid
		? attendees.slice( first - 1, last ).filter( ( a ) => ! a.username )
				.length
		: 0;
	const filename = 'badges-' + first + '-' + last + '.pdf';

	async function generate() {
		const url = await start( {
			design,
			backgroundFile,
			images,
			attendees: attendees.slice( first - 1, last ),
		} );
		if ( url ) {
			download( url, filename );
		}
	}

	const running = state.status === 'running';

	return (
		<Modal
			title="Generate PDF"
			onRequestClose={ running ? cancel : onClose }
			className="ctbd-pdf-dialog ctbd-generate-dialog"
		>
			{ state.status !== 'done' && (
				<>
					<p className="ctbd-help">
						One page per attendee, numbered in purchase order.
					</p>
					<RadioControl
						label="Pages"
						selected={ range }
						disabled={ running }
						options={ [
							{ label: 'All (1–' + total + ')', value: 'all' },
							{ label: 'A range', value: 'range' },
						] }
						onChange={ setRange }
					/>
					{ range === 'range' && (
						<div className="ctbd-range">
							<label htmlFor="ctbd-range-from">From</label>
							<input
								id="ctbd-range-from"
								type="number"
								min="1"
								max={ total }
								value={ from }
								disabled={ running }
								onChange={ ( e ) => setFrom( e.target.value ) }
							/>
							<label htmlFor="ctbd-range-to">to</label>
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
					<div className="ctbd-summary">
						{ valid ? (
							<>
								<strong>
									{ count }{ ' ' }
									{ count === 1 ? 'badge' : 'badges' }
								</strong>
								<span>
									{ geometry.width } × { geometry.height } mm
									pages ({ design.size.width } ×{ ' ' }
									{ design.size.height } mm +{ ' ' }
									{ design.size.bleed } mm bleed)
									{ design.cropMarks
										? ', with crop marks'
										: '' }
									.
								</span>
								{ withoutQr > 0 && (
									<span>
										{ withoutQr } without a QR code (no
										username).
									</span>
								) }
								{ cut > 0 && (
									<span className="is-warning">
										{ cut } with text that is cut.
									</span>
								) }
							</>
						) : (
							<span className="is-warning">
								Choose pages between 1 and { total }, the first
								not after the last.
							</span>
						) }
					</div>
				</>
			) }
			{ running && <Progress progress={ state.progress } /> }
			{ state.status === 'error' && (
				<Notice status="error" isDismissible={ false }>
					The PDF could not be made: { state.message }
				</Notice>
			) }
			{ state.status === 'done' && (
				<>
					<Notice status="success" isDismissible={ false }>
						{ state.stats.pages } badges,{ ' ' }
						{ formatSize( state.bytes.length ) }, made in{ ' ' }
						{ state.seconds.toFixed( 1 ) } s. The download has
						started.
					</Notice>
					<GravatarNote stats={ state.stats } />
				</>
			) }
			<div className="ctbd-pdf-dialog__actions">
				{ running && (
					<Button variant="tertiary" onClick={ cancel }>
						Cancel
					</Button>
				) }
				{ ! running && (
					<Button variant="tertiary" onClick={ onClose }>
						{ state.status === 'done' ? 'Close' : 'Cancel' }
					</Button>
				) }
				{ state.status === 'done' && (
					<Button
						variant="secondary"
						onClick={ () => download( state.url, filename ) }
					>
						Download again
					</Button>
				) }
				{ state.status !== 'done' && (
					<Button
						variant="primary"
						disabled={ ! valid || running }
						isBusy={ running }
						onClick={ generate }
					>
						Generate PDF
					</Button>
				) }
			</div>
		</Modal>
	);
}
