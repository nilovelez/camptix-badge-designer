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
import { __, _n, sprintf } from '@wordpress/i18n';
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
		const { fallbackImage, ...rest } = element;
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
			folded: !! design.folded,
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
		throw new Error(
			__( 'The file is not valid JSON.', 'camptix-badge-designer' )
		);
	}
	if ( ! file || file.format !== FORMAT || ! file.design ) {
		throw new Error(
			__(
				'The file is not a badge design exported by this plugin.',
				'camptix-badge-designer'
			)
		);
	}
	if ( file.version > DESIGN_VERSION ) {
		throw new Error(
			__(
				'The file comes from a newer version of the plugin. Update the plugin first.',
				'camptix-badge-designer'
			)
		);
	}
	const source = file.design;
	if (
		! source.size ||
		typeof source.size.width !== 'number' ||
		! Array.isArray( source.elements )
	) {
		throw new Error(
			__(
				'The file is damaged: it has no print size or no elements.',
				'camptix-badge-designer'
			)
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
					__(
						'Choose the image for attendees without a Gravatar again: images are not exported.',
						'camptix-badge-designer'
					)
				);
				return { ...element, fallback: '404', fallbackImage: 0 };
			}
			return element;
		} );
	if ( missingFonts.size ) {
		notes.push(
			sprintf(
				/* translators: %s: list of font family names. */
				__(
					'Install these fonts in Appearance › Fonts, or the text uses Inter: %s.',
					'camptix-badge-designer'
				),
				[ ...missingFonts ].join( ', ' )
			)
		);
	}

	const imported = {
		size: source.size,
		cropMarks: !! source.cropMarks,
		guides: source.guides !== false,
		folded: !! source.folded,
		elements,
	};
	return { imported, notes };
}

/**
 * The print size of an imported design, for the confirmation.
 *
 * @param {Object} imported Design parts read from the file.
 * @return {string} Text.
 */
function importedSizeText( imported ) {
	const { width, height, bleed } = imported.size;
	if ( imported.cropMarks ) {
		return sprintf(
			/* translators: 1: width, 2: height, 3: bleed, in millimeters. */
			__(
				'Print size %1$s × %2$s mm, %3$s mm bleed, with crop marks.',
				'camptix-badge-designer'
			),
			width,
			height,
			bleed
		);
	}
	return sprintf(
		/* translators: 1: width, 2: height, 3: bleed, in millimeters. */
		__(
			'Print size %1$s × %2$s mm, %3$s mm bleed.',
			'camptix-badge-designer'
		),
		width,
		height,
		bleed
	);
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
		<PanelBody
			title={ __( 'Import/Export Design', 'camptix-badge-designer' ) }
			initialOpen={ false }
		>
			<p className="ctbd-help">
				{ __(
					'Reuse this design on another site. The file has the print size and the elements with their styles; not the background.',
					'camptix-badge-designer'
				) }
			</p>
			<div className="ctbd-button-row">
				<Button
					variant="secondary"
					onClick={ () => exportDesign( design ) }
				>
					{ __( 'Export JSON', 'camptix-badge-designer' ) }
				</Button>
				<FormFileUpload
					accept="application/json,.json"
					onChange={ onFile }
					render={ ( { openFileDialog } ) => (
						<Button variant="secondary" onClick={ openFileDialog }>
							{ __( 'Import JSON', 'camptix-badge-designer' ) }
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
					{ __(
						'Design imported. You can undo it.',
						'camptix-badge-designer'
					) }
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
					title={ __( 'Import design', 'camptix-badge-designer' ) }
					onRequestClose={ () => setPending( null ) }
					className="ctbd-pdf-dialog"
				>
					<p>
						{ sprintf(
							/* translators: %s: file name. */
							__(
								'Replace the current design with %s?',
								'camptix-badge-designer'
							),
							pending.name
						) }
					</p>
					<div className="ctbd-summary">
						<span>{ importedSizeText( pending.imported ) }</span>
						<span>
							{ sprintf(
								/* translators: %d: number of elements. */
								_n(
									'%d element.',
									'%d elements.',
									pending.imported.elements.length,
									'camptix-badge-designer'
								),
								pending.imported.elements.length
							) }
						</span>
						<span>
							{ __(
								'The background stays as it is. You can undo the import.',
								'camptix-badge-designer'
							) }
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
							{ __( 'Cancel', 'camptix-badge-designer' ) }
						</Button>
						<Button variant="primary" onClick={ apply }>
							{ __( 'Import', 'camptix-badge-designer' ) }
						</Button>
					</div>
				</Modal>
			) }
		</PanelBody>
	);
}
