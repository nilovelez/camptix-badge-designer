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
	ToggleControl,
} from '@wordpress/components';
import {
	chevronDown,
	chevronUp,
	trash,
	typography,
	image,
	grid,
} from '@wordpress/icons';
import { MmField } from './mm-field';
import { AttendeesList } from './attendees-list';
import { ElementPanel } from './element-panel';
import { DesignPanel } from './design-panel';
import { elementLabel } from '../elements';
import {
	LIMITS,
	RECOMMENDED_DPI,
	backgroundFits,
	effectiveDpi,
	pageSize,
	recommendedPixels,
} from '../geometry';

const TYPE_NAMES = { pdf: 'PDF', png: 'PNG', jpg: 'JPG' };
const ELEMENT_ICONS = { text: typography, gravatar: image, qr: grid };

function BackgroundPanel( {
	design,
	backgroundFile,
	onSelectBackground,
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
				<Button variant="secondary" onClick={ onSelectBackground }>
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
			<div className="ctbd-background-card">
				{ backgroundFile && background.type !== 'pdf' ? (
					<img
						className="ctbd-background-card__thumb"
						src={ backgroundFile.url }
						alt=""
					/>
				) : (
					<span className="ctbd-background-card__thumb is-pdf">
						PDF
					</span>
				) }
				<span className="ctbd-background-card__text">
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
			<div className="ctbd-button-row">
				<Button variant="secondary" onClick={ onSelectBackground }>
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
			<div className="ctbd-size-grid">
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
			<p className="ctbd-help">
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
			<div className="ctbd-toggles">
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

function ElementsPanel( {
	design,
	selectedId,
	onSelectElement,
	onReorder,
	onDelete,
} ) {
	const elements = design.elements;
	if ( ! elements.length ) {
		return (
			<PanelBody title="Elements">
				<p className="ctbd-help">
					No elements. Add one with the + button.
				</p>
			</PanelBody>
		);
	}
	// Top layer first, as in layer lists.
	const rows = [ ...elements ].reverse();
	return (
		<PanelBody title="Elements">
			<ul className="ctbd-layers">
				{ rows.map( ( element ) => {
					const index = elements.indexOf( element );
					return (
						<li
							key={ element.id }
							className={
								element.id === selectedId ? 'is-selected' : ''
							}
						>
							<Button
								className="ctbd-layers__name"
								icon={ ELEMENT_ICONS[ element.type ] }
								onClick={ () => onSelectElement( element.id ) }
							>
								{ elementLabel( element ) }
							</Button>
							<Button
								size="small"
								icon={ chevronUp }
								label="Bring forward"
								disabled={ index === elements.length - 1 }
								onClick={ () => onReorder( element.id, 1 ) }
							/>
							<Button
								size="small"
								icon={ chevronDown }
								label="Send backward"
								disabled={ index === 0 }
								onClick={ () => onReorder( element.id, -1 ) }
							/>
							<Button
								size="small"
								icon={ trash }
								label="Delete"
								onClick={ () => onDelete( element.id ) }
							/>
						</li>
					);
				} ) }
			</ul>
		</PanelBody>
	);
}

function OverflowList( { overflows, onGoTo } ) {
	if ( ! overflows.length ) {
		return null;
	}
	return (
		<Notice status="warning" isDismissible={ false }>
			{ overflows.length === 1
				? '1 attendee has'
				: overflows.length + ' attendees have' }{ ' ' }
			text that does not fit and is cut:
			<ul className="ctbd-overflow-list">
				{ overflows.slice( 0, 50 ).map( ( item ) => (
					<li key={ item.number }>
						<Button
							variant="link"
							onClick={ () => onGoTo( item.number ) }
						>
							#{ item.number } { item.name }
						</Button>
					</li>
				) ) }
			</ul>
			{ overflows.length > 50 && (
				<span>…and { overflows.length - 50 } more.</span>
			) }
		</Notice>
	);
}

function AttendeesPanel( { attendees, overflows, onGoTo } ) {
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
				<p className="ctbd-help">
					{ data.stats.withoutUsername } without a WordPress.org
					username (no QR code).
					<br />
					Source: { data.source }
				</p>
				<OverflowList overflows={ overflows } onGoTo={ onGoTo } />
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
			<ElementsPanel { ...props } />
			<AttendeesPanel
				attendees={ props.attendees }
				overflows={ props.overflows }
				onGoTo={ props.onGoTo }
			/>
			<DesignPanel
				design={ props.design }
				updateDesign={ props.updateDesign }
			/>
		</>
	);
}

const TABS = [
	{ name: 'document', title: 'Document' },
	{ name: 'element', title: 'Element' },
];

export function Sidebar( props ) {
	const { tab, onTab } = props;
	return (
		<aside className="ctbd-sidebar" aria-label="Settings">
			<div className="ctbd-sidebar__tabs" role="tablist">
				{ TABS.map( ( item ) => (
					<button
						key={ item.name }
						type="button"
						role="tab"
						id={ 'ctbd-tab-' + item.name }
						aria-selected={ tab === item.name }
						aria-controls={ 'ctbd-tabpanel-' + item.name }
						className={
							'ctbd-sidebar__tab' +
							( tab === item.name ? ' is-active' : '' )
						}
						onClick={ () => onTab( item.name ) }
					>
						{ item.title }
					</button>
				) ) }
			</div>
			<div
				role="tabpanel"
				id={ 'ctbd-tabpanel-' + tab }
				aria-labelledby={ 'ctbd-tab-' + tab }
			>
				{ tab === 'document' ? (
					<DocumentTab { ...props } />
				) : (
					<ElementPanel
						element={ props.selectedElement }
						layout={
							props.selectedElement
								? props.layouts[ props.selectedElement.id ]
								: null
						}
						questions={ props.attendees.questions }
						images={ props.images }
						onPickImage={ props.onPickImage }
						onChange={ props.onChangeElement }
						onDelete={ () =>
							props.onDelete( props.selectedElement.id )
						}
					/>
				) }
			</div>
		</aside>
	);
}
