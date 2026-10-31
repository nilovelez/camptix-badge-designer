/**
 * Badge editor: toolbar, canvas and the Document and Element sidebar.
 */
import { createRoot, useEffect, useMemo, useState } from '@wordpress/element';
import { Notice, Spinner } from '@wordpress/components';
import { Toolbar } from './components/toolbar';
import { Canvas } from './components/canvas';
import { Sidebar } from './components/sidebar';
import { BackgroundSizeDialog } from './components/background-size-dialog';
import { useAttendees, useDesign } from './use-design';
import { faceKey, resolveFace, useFonts } from './fonts';
import { newElement } from './elements';
import { readPdfPageSize } from './pdf';
import { backgroundFits, round1 } from './geometry';
import { layoutText } from '../shared/text-layout';
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

/**
 * Lays out every text element for one attendee, with the fonts loaded so far.
 *
 * @param {Array}  elements Design elements.
 * @param {Object} fonts    Loaded faces by key.
 * @param {Object} attendee Attendee.
 * @return {Object} Layouts by element id.
 */
function layoutAll( elements, fonts, attendee ) {
	const layouts = {};
	for ( const element of elements ) {
		if ( element.type !== 'text' ) {
			continue;
		}
		const face = resolveFace( element.font, element.weight );
		const loaded = face && fonts[ faceKey( face ) ];
		if ( loaded ) {
			layouts[ element.id ] = layoutText(
				loaded.font,
				element,
				attendee
			);
		}
	}
	return layouts;
}

// Keys typed in these elements belong to them, not to the canvas.
function isTyping( target ) {
	return (
		target.closest &&
		target.closest(
			'input, textarea, select, [contenteditable="true"], .components-modal__frame, .media-modal'
		)
	);
}

function App() {
	const {
		loading,
		loadError,
		design,
		updateDesign,
		undo,
		redo,
		history,
		backgroundFile,
		setBackgroundFile,
		saveStatus,
		saveError,
	} = useDesign();
	const attendees = useAttendees();
	const [ attendeeIndex, setAttendeeIndex ] = useState( 0 );
	const [ selectedId, setSelectedId ] = useState( null );
	const [ tab, setTab ] = useState( 'document' );
	// A background waiting for the organizer to confirm its print size.
	const [ pending, setPending ] = useState( null );
	const [ error, setError ] = useState( null );

	const elements = design ? design.elements || [] : [];
	const fonts = useFonts( elements );
	const index = Math.min( attendeeIndex, attendees.list.length - 1 );
	const attendee = attendees.list[ index ];
	const selectedElement =
		elements.find( ( element ) => element.id === selectedId ) || null;

	const layouts = useMemo(
		() => layoutAll( elements, fonts, attendee ),
		[ elements, fonts, attendee ]
	);

	// Attendees whose text is cut in some box, to check them before printing.
	const overflows = useMemo( () => {
		const result = [];
		if ( ! attendees.data ) {
			return result;
		}
		for ( const person of attendees.data.attendees ) {
			const personLayouts = layoutAll( elements, fonts, person );
			if (
				Object.values( personLayouts ).some(
					( layout ) => layout.overflow
				)
			) {
				result.push( {
					number: person.number,
					name: person.firstName + ' ' + person.lastName,
				} );
			}
		}
		return result;
	}, [ elements, fonts, attendees.data ] );

	function changeElement( next, group ) {
		updateDesign(
			( current ) => ( {
				...current,
				elements: current.elements.map( ( element ) =>
					element.id === next.id ? next : element
				),
			} ),
			group
		);
	}

	function selectElement( id ) {
		setSelectedId( id );
		if ( id ) {
			setTab( 'element' );
		}
	}

	function addElement( type ) {
		const element = newElement( type, design.size );
		updateDesign( ( current ) => ( {
			...current,
			elements: [ ...current.elements, element ],
		} ) );
		selectElement( element.id );
	}

	function deleteElement( id ) {
		updateDesign( ( current ) => ( {
			...current,
			elements: current.elements.filter(
				( element ) => element.id !== id
			),
		} ) );
		if ( id === selectedId ) {
			setSelectedId( null );
		}
	}

	function reorderElement( id, direction ) {
		updateDesign( ( current ) => {
			const list = [ ...current.elements ];
			const from = list.findIndex( ( element ) => element.id === id );
			const to = from + direction;
			if ( from < 0 || to < 0 || to >= list.length ) {
				return current;
			}
			[ list[ from ], list[ to ] ] = [ list[ to ], list[ from ] ];
			return { ...current, elements: list };
		} );
	}

	// Keyboard: undo and redo; with an element selected, arrows move it
	// (Shift for bigger steps), Delete removes it and Escape deselects it.
	useEffect( () => {
		function onKeyDown( event ) {
			if ( isTyping( event.target ) ) {
				return;
			}
			const mod = event.ctrlKey || event.metaKey;
			const key = event.key.toLowerCase();
			if ( mod && key === 'z' ) {
				event.preventDefault();
				if ( event.shiftKey ) {
					redo();
				} else {
					undo();
				}
				return;
			}
			if ( mod && key === 'y' ) {
				event.preventDefault();
				redo();
				return;
			}
			if ( ! selectedElement ) {
				return;
			}
			const step = event.shiftKey ? 5 : 0.5;
			const moves = {
				arrowleft: [ -step, 0 ],
				arrowright: [ step, 0 ],
				arrowup: [ 0, -step ],
				arrowdown: [ 0, step ],
			};
			if ( moves[ key ] ) {
				event.preventDefault();
				const [ dx, dy ] = moves[ key ];
				changeElement(
					{
						...selectedElement,
						x: round1( selectedElement.x + dx ),
						y: round1( selectedElement.y + dy ),
					},
					'nudge-' + selectedElement.id
				);
			} else if ( key === 'delete' || key === 'backspace' ) {
				event.preventDefault();
				deleteElement( selectedElement.id );
			} else if ( key === 'escape' ) {
				setSelectedId( null );
			}
		}
		document.addEventListener( 'keydown', onKeyDown );
		return () => document.removeEventListener( 'keydown', onKeyDown );
	} );

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
				attendees={ attendees.list }
				attendeeIndex={ index }
				onAttendee={ setAttendeeIndex }
				onAdd={ addElement }
				onUndo={ undo }
				onRedo={ redo }
				history={ history }
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
					attendee={ attendee }
					fonts={ fonts }
					layouts={ layouts }
					selectedId={ selectedId }
					onSelect={ selectElement }
					onChangeElement={ changeElement }
				/>
				<Sidebar
					tab={ tab }
					onTab={ setTab }
					design={ design }
					updateDesign={ updateDesign }
					backgroundFile={ backgroundFile }
					attendees={ attendees }
					overflows={ overflows }
					onGoTo={ ( number ) => setAttendeeIndex( number - 1 ) }
					layouts={ layouts }
					selectedId={ selectedId }
					selectedElement={ selectedElement }
					onSelectElement={ selectElement }
					onChangeElement={ changeElement }
					onReorder={ reorderElement }
					onDelete={ deleteElement }
					onSelectBackground={ selectBackground }
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
