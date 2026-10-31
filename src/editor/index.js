/**
 * Badge editor: toolbar, canvas and the Document and Element sidebar.
 */
import { createRoot, useState } from '@wordpress/element';
import { Notice, Spinner } from '@wordpress/components';
import { Toolbar } from './components/toolbar';
import { Canvas } from './components/canvas';
import { Sidebar } from './components/sidebar';
import { BackgroundSizeDialog } from './components/background-size-dialog';
import { useAttendees, useDesign } from './use-design';
import { readPdfPageSize } from './pdf';
import { backgroundFits } from './geometry';
import './editor.scss';

const BACKGROUND_TYPES = {
	'application/pdf': 'pdf',
	'image/png': 'png',
	'image/jpeg': 'jpg',
};

// One Media Library frame, created on first use and reused, as WordPress
// recommends: each new frame would add another modal to the page.
let mediaFrame = null;
let mediaCallback = null;

/**
 * Opens the Media Library to pick a background.
 *
 * @param {(attachment: Object) => void} onPick Called with the attachment.
 */
function openMediaLibrary( onPick ) {
	mediaCallback = onPick;
	if ( ! mediaFrame ) {
		mediaFrame = window.wp.media( {
			title: 'Select the badge background',
			button: { text: 'Use as background' },
			library: { type: Object.keys( BACKGROUND_TYPES ) },
			multiple: false,
		} );
		mediaFrame.on( 'select', () => {
			const attachment = mediaFrame
				.state()
				.get( 'selection' )
				.first()
				.toJSON();
			mediaCallback( attachment );
		} );
	}
	mediaFrame.open();
}

function App() {
	const {
		loading,
		loadError,
		design,
		updateDesign,
		backgroundFile,
		setBackgroundFile,
		saveStatus,
		saveError,
	} = useDesign();
	const attendees = useAttendees();
	// A background waiting for the organizer to confirm its print size.
	const [ pending, setPending ] = useState( null );
	const [ error, setError ] = useState( null );

	if ( loading ) {
		return (
			<div className="ctbg-editor__loading">
				<Spinner />
			</div>
		);
	}
	if ( loadError ) {
		return (
			<div className="ctbg-editor__loading">
				<Notice status="error" isDismissible={ false }>
					The design could not be loaded: { loadError }
				</Notice>
			</div>
		);
	}

	function applyBackground( background, file, size ) {
		setBackgroundFile( file );
		updateDesign( ( current ) => ( {
			...current,
			background,
			size: size || current.size,
		} ) );
	}

	async function pickBackground( attachment ) {
		setError( null );
		const type = BACKGROUND_TYPES[ attachment.mime ];
		if ( ! type ) {
			setError( 'The background must be a PDF, PNG or JPG file.' );
			return;
		}

		let background;
		try {
			if ( type === 'pdf' ) {
				background = {
					id: attachment.id,
					type,
					...( await readPdfPageSize( attachment.url ) ),
				};
			} else {
				background = {
					id: attachment.id,
					type,
					pixelWidth: attachment.width,
					pixelHeight: attachment.height,
				};
			}
		} catch ( e ) {
			setError(
				'The background could not be read: ' + ( e.message || e )
			);
			return;
		}

		const file = { url: attachment.url, filename: attachment.filename };
		if ( backgroundFits( background, design.size ) ) {
			applyBackground( background, file );
		} else {
			setPending( { background, file } );
		}
	}

	const selectBackground = () => openMediaLibrary( pickBackground );

	return (
		<>
			<Toolbar
				attendees={ attendees.data ? attendees.data.attendees : null }
				saveStatus={ saveStatus }
				saveError={ saveError }
			/>
			{ error && (
				<Notice status="error" onRemove={ () => setError( null ) }>
					{ error }
				</Notice>
			) }
			<div className="ctbg-editor__body">
				<Canvas
					design={ design }
					backgroundFile={ backgroundFile }
					onSelectBackground={ selectBackground }
				/>
				<Sidebar
					design={ design }
					updateDesign={ updateDesign }
					backgroundFile={ backgroundFile }
					attendees={ attendees }
					onSelect={ selectBackground }
					onRemove={ () => applyBackground( null, null ) }
					onFixSize={ () =>
						setPending( {
							background: design.background,
							file: backgroundFile,
						} )
					}
				/>
			</div>
			{ pending && (
				<BackgroundSizeDialog
					background={ pending.background }
					size={ design.size }
					onCancel={ () => setPending( null ) }
					onApply={ ( size ) => {
						applyBackground(
							pending.background,
							pending.file,
							size
						);
						setPending( null );
					} }
				/>
			) }
		</>
	);
}

const container = document.getElementById( 'ctbg-editor' );
if ( container ) {
	createRoot( container ).render( <App /> );
}
