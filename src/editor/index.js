/**
 * Badge editor: toolbar, canvas and the Document and Element sidebar.
 */
import { createRoot, useEffect, useMemo, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Notice } from '@wordpress/components';
import { Toolbar } from './components/toolbar';
import { Canvas } from './components/canvas';
import { Sidebar } from './components/sidebar';
import { BackgroundSizeDialog } from './components/background-size-dialog';
import { GenerateDialog, PreviewDialog } from './components/pdf-dialogs';
import { useAttendees, useDesign, withNameOption } from './use-design';
import { layoutTextBox, useFonts } from './fonts';
import { newElement } from './elements';
import { readPdfPageSize } from './pdf';
import { round1 } from './geometry';
import { sortScripts } from '../shared/scripts';
import './editor.scss';

const BACKGROUND_TYPES = {
	'application/pdf': 'pdf',
	'image/png': 'png',
	'image/jpeg': 'jpg',
};

// Media Library frames, one per purpose, created on first use and reused,
// as WordPress recommends: each new frame would add another modal.
const MEDIA_FRAMES = {
	background: {
		title: __( 'Select the badge background', 'camptix-badge-designer' ),
		button: __( 'Use as background', 'camptix-badge-designer' ),
		types: Object.keys( BACKGROUND_TYPES ),
	},
	gravatarFallback: {
		title: __(
			'Select the image for attendees without a Gravatar',
			'camptix-badge-designer'
		),
		button: __( 'Use this image', 'camptix-badge-designer' ),
		types: [ 'image/png', 'image/jpeg' ],
	},
};
const mediaFrames = {};
const mediaCallbacks = {};

/**
 * Opens the Media Library to pick a file.
 *
 * @param {string}                       purpose Key of MEDIA_FRAMES.
 * @param {(attachment: Object) => void} onPick  Called with the attachment.
 */
function openMediaLibrary( purpose, onPick ) {
	mediaCallbacks[ purpose ] = onPick;
	if ( ! mediaFrames[ purpose ] ) {
		const config = MEDIA_FRAMES[ purpose ];
		const frame = window.wp.media( {
			title: config.title,
			button: { text: config.button },
			library: { type: config.types },
			multiple: false,
		} );
		frame.on( 'select', () => {
			const attachment = frame
				.state()
				.get( 'selection' )
				.first()
				.toJSON();
			mediaCallbacks[ purpose ]( attachment );
		} );
		mediaFrames[ purpose ] = frame;
	}
	mediaFrames[ purpose ].open();
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
		const layout = layoutTextBox( element, attendee, fonts );
		if ( layout ) {
			layouts[ element.id ] = layout;
		}
	}
	return layouts;
}

/**
 * Checks every attendee's text against the fonts, to warn before printing:
 * the attendees whose text is cut, and those with characters no font can
 * print, after the fallbacks (Inter, then the Noto font of the script).
 *
 * @param {Array}  elements Design elements.
 * @param {Object} fonts    Loaded faces by key.
 * @param {Array}  people   Attendees.
 * @return {Object} {overflows, missing, byElement, byScript, wanted}:
 *   overflows and missing are lists of {number, name} (missing also has
 *   scripts, an array of script ids). byElement has, by element id,
 *   {fallback, families, missing, unresolved, resolved}: the number of
 *   attendees printed in a fallback font and those fonts; the number with
 *   characters no font can print, and by script; and by script, those a
 *   Noto fallback prints, {count, family}. byScript has, by script id,
 *   {count, families, unresolved}: attendees whose text needs a fallback
 *   in some box, the fonts used, and how many no font can print. wanted:
 *   installed fallback faces to load.
 */
function checkText( elements, fonts, people ) {
	const overflows = [];
	const missing = [];
	const byElement = {};
	const scripts = {};
	const wanted = {};
	for ( const person of people ) {
		const layouts = layoutAll( elements, fonts, person );
		let cut = false;
		const chars = [];
		const unprintable = [];
		for ( const [ id, layout ] of Object.entries( layouts ) ) {
			if ( ! byElement[ id ] ) {
				byElement[ id ] = {
					fallback: 0,
					families: [],
					missing: 0,
					unresolved: {},
					resolved: {},
				};
			}
			const stats = byElement[ id ];
			cut = cut || layout.overflow;
			for ( const face of layout.wanted ) {
				wanted[ face.family + '|' + face.weight ] = face;
			}
			for ( const script of layout.scripts ) {
				if ( ! scripts[ script ] ) {
					scripts[ script ] = {
						people: new Set(),
						families: new Set(),
						unresolved: new Set(),
					};
				}
				scripts[ script ].people.add( person.number );
			}
			if ( layout.fallbackFamily ) {
				stats.fallback++;
				if ( ! stats.families.includes( layout.fallbackFamily ) ) {
					stats.families.push( layout.fallbackFamily );
				}
				for ( const script of layout.scripts ) {
					scripts[ script ].families.add( layout.fallbackFamily );
					if ( layout.fallbackFamily !== 'Inter' ) {
						const resolved = stats.resolved[ script ] || {
							count: 0,
							family: layout.fallbackFamily,
						};
						resolved.count++;
						stats.resolved[ script ] = resolved;
					}
				}
			}
			if ( layout.missing.length ) {
				stats.missing++;
				for ( const script of layout.scripts ) {
					stats.unresolved[ script ] =
						( stats.unresolved[ script ] || 0 ) + 1;
					scripts[ script ].unresolved.add( person.number );
				}
				chars.push( ...layout.missing );
				unprintable.push( ...layout.scripts );
			}
		}
		const name = person.firstName + ' ' + person.lastName;
		if ( cut ) {
			overflows.push( { number: person.number, name } );
		}
		if ( chars.length ) {
			missing.push( {
				number: person.number,
				name,
				scripts: sortScripts( [ ...new Set( unprintable ) ] ),
			} );
		}
	}
	const byScript = {};
	for ( const [ id, entry ] of Object.entries( scripts ) ) {
		byScript[ id ] = {
			count: entry.people.size,
			families: [ ...entry.families ],
			unresolved: entry.unresolved.size,
		};
	}
	return {
		overflows,
		missing,
		byElement,
		byScript,
		wanted: Object.values( wanted ),
	};
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

/**
 * The loading bar, the same one the admin page prints while this script
 * downloads. Its progress is not real: it fills over time, and the negative
 * delay starts it at the time since the page began loading, so it carries on
 * where the printed one was instead of starting again.
 *
 * @return {Element} Loading bar.
 */
function LoadingBar() {
	const delay = -Math.round( window.performance.now() ) + 'ms';
	return (
		<div className="ctbd-editor__loading">
			<div className="ctbd-loading" role="status">
				<p>
					{ __(
						'Loading the badge editor…',
						'camptix-badge-designer'
					) }
				</p>
				<div className="ctbd-loading__bar">
					<div
						className="ctbd-loading__fill"
						style={ { animationDelay: delay } }
					/>
				</div>
			</div>
		</div>
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
		images,
		addImage,
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
	// 'preview' or 'generate' while a PDF dialog is open.
	const [ pdfDialog, setPdfDialog ] = useState( null );

	const elements = design ? design.elements || [] : [];
	// Noto fallback faces some attendee needs, loaded once that is known.
	const [ extraFaces, setExtraFaces ] = useState( [] );
	const fonts = useFonts( elements, extraFaces );
	const fixNames = ! design || design.fixNames !== false;
	// The attendees with their names as the design asks for them.
	const people = useMemo(
		() => withNameOption( attendees.list, fixNames ),
		[ attendees.list, fixNames ]
	);
	const index = Math.min( attendeeIndex, people.length - 1 );
	const attendee = people[ index ];
	const selectedElement =
		elements.find( ( element ) => element.id === selectedId ) || null;

	const layouts = useMemo(
		() => layoutAll( elements, fonts, attendee ),
		[ elements, fonts, attendee ]
	);

	// Attendees whose text is cut in some box or has characters the font
	// cannot print, to check them before printing.
	const textCheck = useMemo(
		() =>
			attendees.data
				? checkText( elements, fonts, people )
				: {
						overflows: [],
						missing: [],
						byElement: {},
						byScript: {},
						wanted: [],
					},
		[ elements, fonts, attendees.data, people ]
	);
	useEffect( () => {
		const known = new Set(
			extraFaces.map( ( face ) => face.family + '|' + face.weight )
		);
		const more = textCheck.wanted.filter(
			( face ) => ! known.has( face.family + '|' + face.weight )
		);
		if ( more.length ) {
			setExtraFaces( ( current ) => [ ...current, ...more ] );
		}
	}, [ textCheck, extraFaces ] );
	const overflows = textCheck.overflows;

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

	// Keyboard: undo and redo; Page Up and Page Down change the attendee;
	// with an element selected, arrows move it (Shift for bigger steps),
	// Delete removes it and Escape deselects it.
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
			// Page Up and Page Down: previous and next attendee.
			if ( key === 'pageup' || key === 'pagedown' ) {
				event.preventDefault();
				const step = key === 'pageup' ? -1 : 1;
				setAttendeeIndex(
					Math.min( Math.max( index + step, 0 ), people.length - 1 )
				);
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
		return <LoadingBar />;
	}
	if ( loadError ) {
		return (
			<div className="ctbd-editor__loading">
				<Notice status="error" isDismissible={ false }>
					{ sprintf(
						/* translators: %s: error message. */
						__(
							'The design could not be loaded: %s',
							'camptix-badge-designer'
						),
						loadError
					) }
				</Notice>
			</div>
		);
	}

	function applyBackground( background, file, size, folded ) {
		setBackgroundFile( file );
		updateDesign( ( current ) => ( {
			...current,
			background,
			size: size || current.size,
			folded: folded === undefined ? current.folded : folded,
		} ) );
	}

	async function pickBackground( attachment ) {
		setError( null );
		const type = BACKGROUND_TYPES[ attachment.mime ];
		if ( ! type ) {
			setError(
				__(
					'The background must be a PDF, PNG or JPG file.',
					'camptix-badge-designer'
				)
			);
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
				sprintf(
					/* translators: %s: error message. */
					__(
						'The background could not be read: %s',
						'camptix-badge-designer'
					),
					e.message || e
				)
			);
			return;
		}

		// The dialog asks for the badge type, and for the size when the
		// background does not fit the current page.
		const file = { url: attachment.url, filename: attachment.filename };
		setPending( { background, file } );
	}

	const selectBackground = () =>
		openMediaLibrary( 'background', pickBackground );

	// Picks the Gravatar fallback image; onPicked receives its attachment id.
	const pickFallbackImage = ( onPicked ) =>
		openMediaLibrary( 'gravatarFallback', ( attachment ) => {
			if (
				attachment.mime !== 'image/png' &&
				attachment.mime !== 'image/jpeg'
			) {
				setError(
					__(
						'The image must be a PNG or JPG file.',
						'camptix-badge-designer'
					)
				);
				return;
			}
			addImage( attachment.id, attachment.url );
			onPicked( attachment.id );
		} );

	return (
		<>
			<Toolbar
				attendees={ people }
				attendeeIndex={ index }
				onAttendee={ setAttendeeIndex }
				onAdd={ addElement }
				onUndo={ undo }
				onRedo={ redo }
				history={ history }
				saveStatus={ saveStatus }
				saveError={ saveError }
				onPreview={ () => setPdfDialog( 'preview' ) }
				onGenerate={ () => setPdfDialog( 'generate' ) }
			/>
			{ error && (
				<Notice status="error" onRemove={ () => setError( null ) }>
					{ error }
				</Notice>
			) }
			<div className="ctbd-editor__body">
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
					images={ images }
				/>
				<Sidebar
					tab={ tab }
					onTab={ setTab }
					design={ design }
					updateDesign={ updateDesign }
					backgroundFile={ backgroundFile }
					attendees={ attendees }
					overflows={ overflows }
					missing={ textCheck.missing }
					scriptStats={ textCheck.byScript }
					textStats={ textCheck.byElement }
					onGoTo={ ( number ) => setAttendeeIndex( number - 1 ) }
					layouts={ layouts }
					selectedId={ selectedId }
					selectedElement={ selectedElement }
					onSelectElement={ selectElement }
					onChangeElement={ changeElement }
					onReorder={ reorderElement }
					images={ images }
					onPickImage={ pickFallbackImage }
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
			{ pdfDialog === 'preview' && (
				<PreviewDialog
					design={ design }
					backgroundFile={ backgroundFile }
					images={ images }
					attendee={ attendee }
					onClose={ () => setPdfDialog( null ) }
				/>
			) }
			{ pdfDialog === 'generate' && (
				<GenerateDialog
					design={ design }
					backgroundFile={ backgroundFile }
					images={ images }
					attendees={ people }
					flags={ ( attendees.data && attendees.data.flags ) || [] }
					overflows={ overflows }
					missing={ textCheck.missing }
					onClose={ () => setPdfDialog( null ) }
				/>
			) }
			{ pending && (
				<BackgroundSizeDialog
					background={ pending.background }
					size={ design.size }
					folded={ design.folded }
					onCancel={ () => setPending( null ) }
					onApply={ ( size, folded ) => {
						applyBackground(
							pending.background,
							pending.file,
							size,
							folded
						);
						setPending( null );
					} }
				/>
			) }
		</>
	);
}

const container = document.getElementById( 'ctbd-editor' );
if ( container ) {
	createRoot( container ).render( <App /> );
}
