/**
 * Technical spike (milestone 1): generates a badges PDF in the browser and
 * reports how long each step takes, to confirm or change the proposals in
 * docs/decisions.md.
 */
import { createRoot, useState, useRef, useEffect } from '@wordpress/element';
import {
	Button,
	Card,
	CardBody,
	CardHeader,
	CheckboxControl,
	FormFileUpload,
	Notice,
	RadioControl,
	SelectControl,
	TextControl,
} from '@wordpress/components';
import apiFetch from '@wordpress/api-fetch';
import * as pdfjs from 'pdfjs-dist';
import { generateBadges, checkWoff2 } from './generate';
import { makeAttendees } from './attendees';
import { makeSampleBackground } from './sample-background';

const settings = window.ctbgSettings;
pdfjs.GlobalWorkerOptions.workerSrc = settings.pdfWorkerUrl;

function fileType( file ) {
	if ( file.type === 'application/pdf' ) {
		return 'pdf';
	}
	if ( file.type === 'image/png' ) {
		return 'png';
	}
	if ( file.type === 'image/jpeg' ) {
		return 'jpg';
	}
	return null;
}

/**
 * Renders the first page of a PDF into a canvas with PDF.js.
 *
 * @param {Uint8Array}        bytes  The PDF.
 * @param {HTMLCanvasElement} canvas Target canvas.
 * @param {number}            width  Width in CSS pixels.
 * @return {Promise<number>} Milliseconds taken.
 */
async function renderFirstPage( bytes, canvas, width ) {
	const started = performance.now();
	// PDF.js takes ownership of the buffer, so give it a copy.
	const task = pdfjs.getDocument( { data: bytes.slice() } );
	const pdf = await task.promise;
	const page = await pdf.getPage( 1 );
	const base = page.getViewport( { scale: 1 } );
	const ratio = window.devicePixelRatio || 1;
	const viewport = page.getViewport( {
		scale: ( width / base.width ) * ratio,
	} );
	canvas.width = viewport.width;
	canvas.height = viewport.height;
	canvas.style.width = width + 'px';
	canvas.style.height = viewport.height / ratio + 'px';
	await page.render( { canvas, viewport } ).promise;
	await task.destroy();
	return Math.round( performance.now() - started );
}

function App() {
	const [ attendeeData, setAttendeeData ] = useState( null );

	useEffect( () => {
		// Without the test CSV the spike still works with invented attendees.
		apiFetch( { path: '/ctbg/v1/attendees' } )
			.then( setAttendeeData )
			.catch( () => setAttendeeData( null ) );
	}, [] );

	return (
		<SpikePanel
			csvAttendees={ attendeeData ? attendeeData.attendees : null }
		/>
	);
}

function SpikePanel( { csvAttendees } ) {
	const [ attendeeSource, setAttendeeSource ] = useState( 'invented' );
	const [ count, setCount ] = useState( '300' );
	const [ backgroundSource, setBackgroundSource ] = useState( 'sample' );
	const [ backgroundFile, setBackgroundFile ] = useState( null );
	const [ gravatars, setGravatars ] = useState( true );
	const [ fallback, setFallback ] = useState( 'identicon' );
	const [ shape, setShape ] = useState( 'round' );
	const [ cropMarks, setCropMarks ] = useState( true );
	const [ subset, setSubset ] = useState( true );
	const [ running, setRunning ] = useState( false );
	const [ log, setLog ] = useState( [] );
	const [ error, setError ] = useState( null );
	const [ result, setResult ] = useState( null );
	const [ woff2, setWoff2 ] = useState( null );
	const canvasRef = useRef( null );

	useEffect( () => {
		return () => {
			if ( result ) {
				URL.revokeObjectURL( result.url );
			}
		};
	}, [ result ] );

	async function loadBackground() {
		if ( backgroundSource === 'none' ) {
			return null;
		}
		if ( backgroundSource === 'sample' ) {
			return { type: 'pdf', bytes: await makeSampleBackground() };
		}
		if ( ! backgroundFile ) {
			throw new Error( 'Choose a background file first.' );
		}
		const type = fileType( backgroundFile );
		if ( ! type ) {
			throw new Error( 'The background must be a PDF, PNG or JPG file.' );
		}
		return {
			type,
			bytes: new Uint8Array( await backgroundFile.arrayBuffer() ),
		};
	}

	async function run() {
		setRunning( true );
		setError( null );
		setLog( [] );
		setResult( null );
		const entries = [];
		const addEntry = ( entry ) => {
			entries.push( entry );
			setLog( [ ...entries ] );
		};
		try {
			const background = await loadBackground();
			let attendees;
			if ( attendeeSource === 'csv' && csvAttendees ) {
				attendees = csvAttendees;
			} else {
				attendees = makeAttendees(
					Math.max( 1, parseInt( count, 10 ) || 1 )
				);
			}
			const bytes = await generateBadges( {
				attendees,
				fonts: settings.fonts,
				background,
				cropMarks,
				subset,
				gravatars,
				fallback,
				shape,
				log: addEntry,
			} );
			const blob = new Blob( [ bytes ], { type: 'application/pdf' } );
			setResult( {
				url: URL.createObjectURL( blob ),
				size: bytes.length,
				pages: attendees.length,
			} );
			const ms = await renderFirstPage( bytes, canvasRef.current, 320 );
			addEntry( {
				label: 'Page 1 rendered with PDF.js',
				ms,
				detail: 'Canvas preview below',
				heap: null,
			} );
		} catch ( e ) {
			setError( String( e.message || e ) );
		}
		setRunning( false );
	}

	async function runWoff2() {
		setWoff2( { ok: null, detail: 'Checking…' } );
		try {
			setWoff2( await checkWoff2( settings.woff2Url ) );
		} catch ( e ) {
			setWoff2( { ok: false, detail: String( e.message || e ) } );
		}
	}

	return (
		<div
			style={ {
				display: 'grid',
				gridTemplateColumns: 'minmax(280px, 380px) 1fr',
				gap: 16,
				alignItems: 'start',
				marginTop: 16,
			} }
		>
			<Card>
				<CardHeader>
					<strong>Test PDF (technical spike)</strong>
				</CardHeader>
				<CardBody>
					<RadioControl
						label="Attendees"
						selected={ attendeeSource }
						options={ [
							{ label: 'Invented', value: 'invented' },
							{
								label: csvAttendees
									? 'Test CSV (' + csvAttendees.length + ')'
									: 'Test CSV (not available)',
								value: 'csv',
							},
						] }
						onChange={ setAttendeeSource }
					/>
					{ attendeeSource === 'invented' && (
						<div style={ { marginTop: 8 } }>
							<TextControl
								__next40pxDefaultSize
								__nextHasNoMarginBottom
								label="Attendees (invented data)"
								type="number"
								min="1"
								value={ count }
								onChange={ setCount }
							/>
						</div>
					) }
					<div style={ { height: 16 } } />
					<RadioControl
						label="Background"
						selected={ backgroundSource }
						options={ [
							{
								label: 'Sample vector PDF (generated)',
								value: 'sample',
							},
							{
								label: 'My own file (PDF, PNG or JPG)',
								value: 'file',
							},
							{ label: 'None', value: 'none' },
						] }
						onChange={ setBackgroundSource }
					/>
					{ backgroundSource === 'file' && (
						<div style={ { marginTop: 8 } }>
							<FormFileUpload
								__next40pxDefaultSize
								accept="application/pdf,image/png,image/jpeg"
								onChange={ ( event ) =>
									setBackgroundFile(
										event.currentTarget.files[ 0 ] || null
									)
								}
								variant="secondary"
							>
								{ backgroundFile
									? backgroundFile.name
									: 'Choose file…' }
							</FormFileUpload>
							<p className="description">
								Read in the browser only, not uploaded.
							</p>
						</div>
					) }
					<div style={ { height: 16 } } />
					<CheckboxControl
						__nextHasNoMarginBottom
						label="Fetch Gravatars"
						checked={ gravatars }
						onChange={ setGravatars }
					/>
					<div style={ { height: 8 } } />
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label="Gravatar fallback"
						value={ fallback }
						disabled={ ! gravatars }
						options={ [
							{ label: 'None (transparent)', value: '404' },
							{ label: 'Identicon', value: 'identicon' },
							{ label: 'Monster', value: 'monsterid' },
							{ label: 'Wavatar', value: 'wavatar' },
							{ label: 'Retro', value: 'retro' },
							{ label: 'Robot', value: 'robohash' },
						] }
						onChange={ setFallback }
					/>
					<div style={ { height: 8 } } />
					<SelectControl
						__next40pxDefaultSize
						__nextHasNoMarginBottom
						label="Gravatar shape"
						value={ shape }
						disabled={ ! gravatars }
						options={ [
							{ label: 'Round', value: 'round' },
							{ label: 'Square', value: 'square' },
						] }
						onChange={ setShape }
					/>
					<div style={ { height: 16 } } />
					<CheckboxControl
						__nextHasNoMarginBottom
						label="Crop marks"
						checked={ cropMarks }
						onChange={ setCropMarks }
					/>
					<CheckboxControl
						__nextHasNoMarginBottom
						label="Subset fonts"
						checked={ subset }
						onChange={ setSubset }
					/>
					<div style={ { height: 16 } } />
					<Button
						__next40pxDefaultSize
						variant="primary"
						onClick={ run }
						isBusy={ running }
						disabled={ running }
					>
						{ running ? 'Generating…' : 'Generate test PDF' }
					</Button>
					<hr />
					<Button
						__next40pxDefaultSize
						variant="secondary"
						onClick={ runWoff2 }
					>
						Check WOFF2 font
					</Button>
					{ woff2 && woff2.ok !== null && (
						<Notice
							status={ woff2.ok ? 'success' : 'error' }
							isDismissible={ false }
						>
							{ woff2.detail }
						</Notice>
					) }
				</CardBody>
			</Card>

			<div>
				{ error && (
					<Notice status="error" isDismissible={ false }>
						{ error }
					</Notice>
				) }
				<Card>
					<CardHeader>
						<strong>Results</strong>
					</CardHeader>
					<CardBody>
						{ log.length === 0 && (
							<p>Run the test to see the timings.</p>
						) }
						{ log.length > 0 && (
							<table className="widefat striped">
								<thead>
									<tr>
										<th>Step</th>
										<th style={ { textAlign: 'right' } }>
											Time
										</th>
										<th style={ { textAlign: 'right' } }>
											JS heap
										</th>
										<th>Detail</th>
									</tr>
								</thead>
								<tbody>
									{ log.map( ( entry, index ) => (
										<tr
											key={ index }
											style={
												entry.total
													? { fontWeight: 600 }
													: undefined
											}
										>
											<td>{ entry.label }</td>
											<td
												style={ {
													textAlign: 'right',
													whiteSpace: 'nowrap',
												} }
											>
												{ ( entry.ms / 1000 ).toFixed(
													2
												) }{ ' ' }
												s
											</td>
											<td
												style={ {
													textAlign: 'right',
													whiteSpace: 'nowrap',
												} }
											>
												{ entry.heap === null
													? '—'
													: entry.heap + ' MB' }
											</td>
											<td>{ entry.detail }</td>
										</tr>
									) ) }
								</tbody>
							</table>
						) }
						{ result && (
							<p style={ { marginTop: 16 } }>
								<a
									className="button button-primary"
									href={ result.url }
									download="badges-test.pdf"
								>
									Download PDF (
									{ ( result.size / 1048576 ).toFixed( 2 ) }{ ' ' }
									MB, { result.pages } pages)
								</a>{ ' ' }
								<a
									className="button"
									href={ result.url }
									target="_blank"
									rel="noreferrer"
								>
									Open in a new tab
								</a>
							</p>
						) }
						<canvas
							ref={ canvasRef }
							style={ {
								display: result ? 'block' : 'none',
								marginTop: 16,
								boxShadow: '0 1px 4px rgba(0,0,0,.25)',
							} }
						/>
					</CardBody>
				</Card>
			</div>
		</div>
	);
}

const container = document.getElementById( 'ctbg-spike' );
if ( container ) {
	createRoot( container ).render( <App /> );
}
