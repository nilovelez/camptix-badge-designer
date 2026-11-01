/**
 * The Design panel: export the design to a JSON file and import it on
 * another site (for example next year's WordCamp).
 *
 * The file has the print size, the options and the elements with their
 * styles. It does not have the background, nor the fixed Gravatar image:
 * they are files of this site's Media Library, so they are chosen again
 * after importing.
 */
import { useState } from '@wordpress/element';
import {
	Button,
	FormFileUpload,
	Modal,
	Notice,
	PanelBody,
} from '@wordpress/components';
import { DESIGN_VERSION, upgradeDesign } from '../elements';
import { fontFamilies } from '../fonts';

const FORMAT = 'camptix-badge-designer/design';
const ELEMENT_TYPES = [ 'text', 'gravatar', 'qr' ];

function exportDesign( design ) {
	const elements = design.elements.map( ( element ) => {
		if ( element.type !== 'gravatar' ) {
			return element;
		}
		// The fixed image is a file of this site: it is not exported.
		const { fallbackImage, ...rest } = element; // eslint-disable-line no-unused-vars
		return rest;
	} );
	const file = {
		format: FORMAT,
		version: DESIGN_VERSION,
		exported: new Date().toISOString(),
		design: {
			size: design.size,
			cropMarks: design.cropMarks,
			guides: design.guides,
			elements,
		},
	};
	const blob = new window.Blob( [ JSON.stringify( file, null, '\t' ) ], {
		type: 'application/json',
	} );
	const url = URL.createObjectURL( blob );
	const link = document.createElement( 'a' );
	link.href = url;
	link.download = 'badge-design.json';
	document.body.appendChild( link );
	link.click();
	link.remove();
	setTimeout( () => URL.revokeObjectURL( url ), 1000 );
}

/**
 * Reads an exported file and checks it.
 *
 * @param {string} text File contents.
 * @return {{imported: Object, notes: string[]}} Design parts to apply, and what the organizer has to redo.
 * @throws {Error} When the file is not a badge design.
 */
function readDesignFile( text ) {
	let file;
	try {
		file = JSON.parse( text );
	} catch {
		throw new Error( 'The file is not valid JSON.' );
	}
	if ( ! file || file.format !== FORMAT || ! file.design ) {
		throw new Error(
			'The file is not a badge design exported by this plugin.'
		);
	}
	if ( file.version > DESIGN_VERSION ) {
		throw new Error(
			'The file comes from a newer version of the plugin. Update the plugin first.'
		);
	}
	const source = file.design;
	if (
		! source.size ||
		typeof source.size.width !== 'number' ||
		! Array.isArray( source.elements )
	) {
		throw new Error(
			'The file is damaged: it has no print size or no elements.'
		);
	}

	const notes = [];
	const families = fontFamilies().map( ( f ) => f.family );
	const missingFonts = new Set();
	const elements = source.elements
		.filter(
			( element ) =>
				element && ELEMENT_TYPES.includes( element.type ) && element.id
		)
		.map( ( element ) => {
			if (
				element.type === 'text' &&
				! families.includes( element.font )
			) {
				missingFonts.add( element.font );
			}
			if ( element.type === 'gravatar' && element.fallback === 'image' ) {
				notes.push(
					'Choose the image for attendees without a Gravatar again: images are not exported.'
				);
				return { ...element, fallback: '404', fallbackImage: 0 };
			}
			return element;
		} );
	if ( missingFonts.size ) {
		notes.push(
			'Install these fonts in Appearance › Fonts, or the text uses Inter: ' +
				[ ...missingFonts ].join( ', ' ) +
				'.'
		);
	}

	const imported = {
		size: source.size,
		cropMarks: !! source.cropMarks,
		guides: source.guides !== false,
		elements,
	};
	return { imported, notes };
}

export function DesignPanel( { design, updateDesign } ) {
	const [ pending, setPending ] = useState( null );
	const [ error, setError ] = useState( null );
	const [ done, setDone ] = useState( null );

	function onFile( event ) {
		const file = event.currentTarget.files[ 0 ];
		event.currentTarget.value = '';
		setError( null );
		setDone( null );
		if ( ! file ) {
			return;
		}
		file.text().then( ( text ) => {
			try {
				setPending( { name: file.name, ...readDesignFile( text ) } );
			} catch ( e ) {
				setError( e.message );
			}
		} );
	}

	function apply() {
		updateDesign( ( current ) => {
			const next = {
				...current,
				...pending.imported,
				version: DESIGN_VERSION,
			};
			// Brings older files up to date (QR minimum size and so on).
			return upgradeDesign( next ) || next;
		} );
		setDone( pending.notes );
		setPending( null );
	}

	return (
		<PanelBody title="Import/Export Design" initialOpen={ false }>
			<p className="ctbd-help">
				Reuse this design on another site. The file has the print size
				and the elements with their styles; not the background.
			</p>
			<div className="ctbd-button-row">
				<Button
					variant="secondary"
					onClick={ () => exportDesign( design ) }
				>
					Export JSON
				</Button>
				<FormFileUpload
					accept="application/json,.json"
					onChange={ onFile }
					render={ ( { openFileDialog } ) => (
						<Button variant="secondary" onClick={ openFileDialog }>
							Import JSON
						</Button>
					) }
				/>
			</div>
			{ error && (
				<Notice status="error" onRemove={ () => setError( null ) }>
					{ error }
				</Notice>
			) }
			{ done && (
				<Notice status="success" onRemove={ () => setDone( null ) }>
					Design imported. You can undo it.
					{ done.length > 0 && (
						<ul className="ctbd-notes">
							{ [ ...new Set( done ) ].map( ( note ) => (
								<li key={ note }>{ note }</li>
							) ) }
						</ul>
					) }
				</Notice>
			) }
			{ pending && (
				<Modal
					title="Import design"
					onRequestClose={ () => setPending( null ) }
					className="ctbd-pdf-dialog"
				>
					<p>
						Replace the current design with{ ' ' }
						<strong>{ pending.name }</strong>?
					</p>
					<div className="ctbd-summary">
						<span>
							Print size { pending.imported.size.width } ×{ ' ' }
							{ pending.imported.size.height } mm,{ ' ' }
							{ pending.imported.size.bleed } mm bleed
							{ pending.imported.cropMarks
								? ', with crop marks'
								: '' }
							.
						</span>
						<span>
							{ pending.imported.elements.length }{ ' ' }
							{ pending.imported.elements.length === 1
								? 'element'
								: 'elements' }
							.
						</span>
						<span>
							The background stays as it is. You can undo the
							import.
						</span>
					</div>
					{ pending.notes.length > 0 && (
						<Notice status="warning" isDismissible={ false }>
							<ul className="ctbd-notes">
								{ [ ...new Set( pending.notes ) ].map(
									( note ) => (
										<li key={ note }>{ note }</li>
									)
								) }
							</ul>
						</Notice>
					) }
					<div className="ctbd-pdf-dialog__actions">
						<Button
							variant="tertiary"
							onClick={ () => setPending( null ) }
						>
							Cancel
						</Button>
						<Button variant="primary" onClick={ apply }>
							Import
						</Button>
					</div>
				</Modal>
			) }
		</PanelBody>
	);
}
