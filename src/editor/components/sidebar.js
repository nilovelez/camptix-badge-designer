/**
 * The fixed right sidebar, with the Document and Element tabs.
 */
import { useState } from '@wordpress/element';
import {
	Button,
	Modal,
	Notice,
	PanelBody,
	Spinner,
	TabPanel,
	ToggleControl,
} from '@wordpress/components';
import { MmField } from './mm-field';
import { AttendeesList } from './attendees-list';
import {
	LIMITS,
	RECOMMENDED_DPI,
	backgroundFits,
	effectiveDpi,
	pageSize,
	recommendedPixels,
} from '../geometry';

const TYPE_NAMES = { pdf: 'PDF', png: 'PNG', jpg: 'JPG' };

function BackgroundPanel( {
	design,
	backgroundFile,
	onSelect,
	onRemove,
	onFixSize,
} ) {
	const { background, size } = design;

	if ( ! background ) {
		return (
			<PanelBody title="Background">
				<p>
					A PDF, PNG or JPG file with the badge artwork, including the
					bleed.
				</p>
				<Button variant="secondary" onClick={ onSelect }>
					Select background
				</Button>
			</PanelBody>
		);
	}

	const dpi = effectiveDpi( background, size );
	const fits = backgroundFits( background, size );
	let detail;
	if ( background.type === 'pdf' ) {
		detail =
			'PDF, vector · ' +
			background.pageWidth +
			' × ' +
			background.pageHeight +
			' mm';
	} else {
		detail =
			TYPE_NAMES[ background.type ] +
			' · ' +
			background.pixelWidth +
			' × ' +
			background.pixelHeight +
			' px · ' +
			dpi +
			' dpi';
	}

	return (
		<PanelBody title="Background">
			<div className="ctbg-background-card">
				{ backgroundFile && background.type !== 'pdf' ? (
					<img
						className="ctbg-background-card__thumb"
						src={ backgroundFile.url }
						alt=""
					/>
				) : (
					<span className="ctbg-background-card__thumb is-pdf">
						PDF
					</span>
				) }
				<span className="ctbg-background-card__text">
					<strong>
						{ backgroundFile
							? backgroundFile.filename
							: 'Missing file' }
					</strong>
					<span>{ detail }</span>
				</span>
			</div>
			{ ! backgroundFile && (
				<Notice status="error" isDismissible={ false }>
					The background file is no longer in the Media Library.
					Select it again.
				</Notice>
			) }
			{ dpi !== null && dpi < RECOMMENDED_DPI && (
				<Notice status="warning" isDismissible={ false }>
					Low resolution for print. At this size, { RECOMMENDED_DPI }{ ' ' }
					dpi needs { recommendedPixels( size ).width } ×{ ' ' }
					{ recommendedPixels( size ).height } px.
				</Notice>
			) }
			{ ! fits && (
				<Notice status="warning" isDismissible={ false }>
					The background does not match the page with bleed (
					{ pageSize( size ).width } × { pageSize( size ).height }{ ' ' }
					mm), so it is stretched.{ ' ' }
					<Button variant="link" onClick={ onFixSize }>
						Adjust the print size
					</Button>
				</Notice>
			) }
			<div className="ctbg-button-row">
				<Button variant="secondary" onClick={ onSelect }>
					Replace
				</Button>
				<Button variant="tertiary" isDestructive onClick={ onRemove }>
					Remove
				</Button>
			</div>
		</PanelBody>
	);
}

function PrintSizePanel( { design, updateDesign } ) {
	const { size } = design;
	const page = pageSize( size );
	const setSize = ( key ) => ( value ) =>
		updateDesign( ( current ) => ( {
			...current,
			size: { ...current.size, [ key ]: value },
		} ) );
	const setFlag = ( key ) => ( value ) =>
		updateDesign( ( current ) => ( { ...current, [ key ]: value } ) );

	return (
		<PanelBody title="Print size">
			<div className="ctbg-size-grid">
				<MmField
					label="Width"
					value={ size.width }
					{ ...LIMITS.width }
					onChange={ setSize( 'width' ) }
				/>
				<MmField
					label="Height"
					value={ size.height }
					{ ...LIMITS.height }
					onChange={ setSize( 'height' ) }
				/>
				<MmField
					label="Bleed"
					value={ size.bleed }
					{ ...LIMITS.bleed }
					onChange={ setSize( 'bleed' ) }
				/>
			</div>
			<p className="ctbg-help">
				Millimeters. Page with bleed: { page.width } × { page.height }{ ' ' }
				mm.
			</p>
			<MmField
				label="Safe area"
				value={ size.safe }
				{ ...LIMITS.safe }
				onChange={ setSize( 'safe' ) }
				help="Margin inside the trim for text and images."
			/>
			<div className="ctbg-toggles">
				<ToggleControl
					__nextHasNoMarginBottom
					label="Crop marks in the PDF"
					checked={ design.cropMarks }
					onChange={ setFlag( 'cropMarks' ) }
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label="Show trim and safe area"
					checked={ design.guides }
					onChange={ setFlag( 'guides' ) }
				/>
			</div>
		</PanelBody>
	);
}

function AttendeesPanel( { attendees } ) {
	const [ open, setOpen ] = useState( false );
	const { data, error } = attendees;

	let body;
	if ( error ) {
		body = (
			<Notice status="warning" isDismissible={ false }>
				{ error }
			</Notice>
		);
	} else if ( ! data ) {
		body = <Spinner />;
	} else {
		body = (
			<>
				<p>{ data.attendees.length } attendees, in purchase order.</p>
				<p className="ctbg-help">
					{ data.stats.withoutUsername } without a WordPress.org
					username (no QR code).
					<br />
					Source: { data.source }
				</p>
				<Button variant="secondary" onClick={ () => setOpen( true ) }>
					View list
				</Button>
				{ open && (
					<Modal
						title="Attendees"
						onRequestClose={ () => setOpen( false ) }
						size="fill"
					>
						<AttendeesList data={ data } />
					</Modal>
				) }
			</>
		);
	}

	return (
		<PanelBody title="Attendees" initialOpen={ true }>
			{ body }
		</PanelBody>
	);
}

function DocumentTab( props ) {
	return (
		<>
			<BackgroundPanel { ...props } />
			<PrintSizePanel { ...props } />
			<PanelBody title="Elements">
				<p className="ctbg-help">No elements yet.</p>
			</PanelBody>
			<AttendeesPanel attendees={ props.attendees } />
			<PanelBody title="Design" initialOpen={ false }>
				<p className="ctbg-help">
					Reuse this design on another site. The file does not include
					the background.
				</p>
				<div className="ctbg-button-row">
					<Button variant="secondary" disabled>
						Export JSON
					</Button>
					<Button variant="secondary" disabled>
						Import JSON
					</Button>
				</div>
			</PanelBody>
		</>
	);
}

export function Sidebar( props ) {
	return (
		<aside className="ctbg-sidebar" aria-label="Settings">
			<TabPanel
				className="ctbg-sidebar__tabs"
				tabs={ [
					{ name: 'document', title: 'Document' },
					{ name: 'element', title: 'Element' },
				] }
			>
				{ ( tab ) =>
					tab.name === 'document' ? (
						<DocumentTab { ...props } />
					) : (
						<p className="ctbg-sidebar__empty">
							Select an element on the badge to edit it.
						</p>
					)
				}
			</TabPanel>
		</aside>
	);
}
