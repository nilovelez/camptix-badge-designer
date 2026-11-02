/**
 * The fixed right sidebar, with the Document and Element tabs.
 */
import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
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
import { BadgeTypeControl } from './badge-type';
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
			<PanelBody title={ __( 'Background', 'camptix-badge-designer' ) }>
				<p>
					{ __(
						'A PDF, PNG or JPG file with the badge artwork, including the bleed.',
						'camptix-badge-designer'
					) }
				</p>
				<Button variant="secondary" onClick={ onSelectBackground }>
					{ __( 'Select background', 'camptix-badge-designer' ) }
				</Button>
			</PanelBody>
		);
	}

	const dpi = effectiveDpi( background, size );
	const fits = backgroundFits( background, size );
	let detail;
	if ( background.type === 'pdf' ) {
		detail = sprintf(
			/* translators: 1: width, 2: height of the PDF page, in millimeters. */
			__( 'PDF, vector · %1$s × %2$s mm', 'camptix-badge-designer' ),
			background.pageWidth,
			background.pageHeight
		);
	} else {
		detail = sprintf(
			/* translators: 1: file type (PNG or JPG), 2: width, 3: height, in pixels; 4: resolution, in dpi. */
			__( '%1$s · %2$d × %3$d px · %4$d dpi', 'camptix-badge-designer' ),
			TYPE_NAMES[ background.type ],
			background.pixelWidth,
			background.pixelHeight,
			dpi
		);
	}

	return (
		<PanelBody title={ __( 'Background', 'camptix-badge-designer' ) }>
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
							: __( 'Missing file', 'camptix-badge-designer' ) }
					</strong>
					<span>{ detail }</span>
				</span>
			</div>
			{ ! backgroundFile && (
				<Notice status="error" isDismissible={ false }>
					{ __(
						'The background file is no longer in the Media Library. Select it again.',
						'camptix-badge-designer'
					) }
				</Notice>
			) }
			{ dpi !== null && dpi < RECOMMENDED_DPI && (
				<Notice status="warning" isDismissible={ false }>
					{ sprintf(
						/* translators: 1: recommended resolution, in dpi; 2: width, 3: height, in pixels. */
						__(
							'Low resolution for print. At this size, %1$d dpi needs %2$d × %3$d px.',
							'camptix-badge-designer'
						),
						RECOMMENDED_DPI,
						recommendedPixels( size ).width,
						recommendedPixels( size ).height
					) }
				</Notice>
			) }
			{ ! fits && (
				<Notice
					status="warning"
					isDismissible={ false }
					spokenMessage={ __(
						'The background does not match the page with bleed, so it is stretched.',
						'camptix-badge-designer'
					) }
				>
					{ sprintf(
						/* translators: 1: width, 2: height of the page with bleed, in millimeters. */
						__(
							'The background does not match the page with bleed (%1$s × %2$s mm), so it is stretched.',
							'camptix-badge-designer'
						),
						pageSize( size ).width,
						pageSize( size ).height
					) }{ ' ' }
					<Button variant="link" onClick={ onFixSize }>
						{ __(
							'Adjust the print size',
							'camptix-badge-designer'
						) }
					</Button>
				</Notice>
			) }
			<div className="ctbd-button-row">
				<Button variant="secondary" onClick={ onSelectBackground }>
					{ __( 'Replace', 'camptix-badge-designer' ) }
				</Button>
				<Button variant="tertiary" isDestructive onClick={ onRemove }>
					{ __( 'Remove', 'camptix-badge-designer' ) }
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
		<PanelBody title={ __( 'Print size', 'camptix-badge-designer' ) }>
			<div className="ctbd-size-grid">
				<MmField
					label={ __( 'Width', 'camptix-badge-designer' ) }
					value={ size.width }
					{ ...LIMITS.width }
					onChange={ setSize( 'width' ) }
				/>
				<MmField
					label={ __( 'Height', 'camptix-badge-designer' ) }
					value={ size.height }
					{ ...LIMITS.height }
					onChange={ setSize( 'height' ) }
				/>
				<MmField
					label={ __( 'Bleed', 'camptix-badge-designer' ) }
					value={ size.bleed }
					{ ...LIMITS.bleed }
					onChange={ setSize( 'bleed' ) }
				/>
			</div>
			<p className="ctbd-help">
				{ sprintf(
					/* translators: 1: width, 2: height of the page with bleed, in millimeters. */
					__(
						'Millimeters. Page with bleed: %1$s × %2$s mm.',
						'camptix-badge-designer'
					),
					page.width,
					page.height
				) }
			</p>
			<BadgeTypeControl
				folded={ !! design.folded }
				size={ size }
				onChange={ setFlag( 'folded' ) }
			/>
			<MmField
				label={ __( 'Safe area', 'camptix-badge-designer' ) }
				value={ size.safe }
				{ ...LIMITS.safe }
				onChange={ setSize( 'safe' ) }
				help={ __(
					'Margin inside the trim for text and images.',
					'camptix-badge-designer'
				) }
			/>
			<div className="ctbd-toggles">
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __(
						'Crop marks in the PDF',
						'camptix-badge-designer'
					) }
					checked={ design.cropMarks }
					onChange={ setFlag( 'cropMarks' ) }
				/>
				<ToggleControl
					__nextHasNoMarginBottom
					label={ __(
						'Show trim and safe area',
						'camptix-badge-designer'
					) }
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
			<PanelBody title={ __( 'Elements', 'camptix-badge-designer' ) }>
				<p className="ctbd-help">
					{ __(
						'No elements. Add one with the + button.',
						'camptix-badge-designer'
					) }
				</p>
			</PanelBody>
		);
	}
	// Top layer first, as in layer lists.
	const rows = [ ...elements ].reverse();
	return (
		<PanelBody title={ __( 'Elements', 'camptix-badge-designer' ) }>
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
								label={ __(
									'Bring forward',
									'camptix-badge-designer'
								) }
								disabled={ index === elements.length - 1 }
								onClick={ () => onReorder( element.id, 1 ) }
							/>
							<Button
								size="small"
								icon={ chevronDown }
								label={ __(
									'Send backward',
									'camptix-badge-designer'
								) }
								disabled={ index === 0 }
								onClick={ () => onReorder( element.id, -1 ) }
							/>
							<Button
								size="small"
								icon={ trash }
								label={ __(
									'Delete',
									'camptix-badge-designer'
								) }
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
	const summary = sprintf(
		/* translators: %d: number of attendees. */
		_n(
			'%d attendee has text that does not fit and is cut',
			'%d attendees have text that does not fit and is cut',
			overflows.length,
			'camptix-badge-designer'
		),
		overflows.length
	);
	// A plain-text spokenMessage: without it, Notice serializes its children
	// for screen readers, which renders the Buttons outside React and breaks
	// the editor when the list changes.
	return (
		<Notice
			status="warning"
			isDismissible={ false }
			spokenMessage={ summary + '.' }
		>
			{ summary }:
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
				<span>
					{ sprintf(
						/* translators: %d: number of attendees not listed. */
						__( '…and %d more.', 'camptix-badge-designer' ),
						overflows.length - 50
					) }
				</span>
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
				<p>
					{ sprintf(
						/* translators: %d: number of attendees. */
						_n(
							'%d attendee, in purchase order.',
							'%d attendees, in purchase order.',
							data.attendees.length,
							'camptix-badge-designer'
						),
						data.attendees.length
					) }
				</p>
				<p className="ctbd-help">
					{ sprintf(
						/* translators: %d: number of attendees. */
						__(
							'%d without a WordPress.org username (no QR code).',
							'camptix-badge-designer'
						),
						data.stats.withoutUsername
					) }
					<br />
					{ sprintf(
						/* translators: %s: where the attendees come from, CampTix or a CSV file. */
						__( 'Source: %s', 'camptix-badge-designer' ),
						data.source
					) }
				</p>
				<OverflowList overflows={ overflows } onGoTo={ onGoTo } />
				<Button variant="secondary" onClick={ () => setOpen( true ) }>
					{ __( 'View list', 'camptix-badge-designer' ) }
				</Button>
				{ open && (
					<Modal
						title={ __( 'Attendees', 'camptix-badge-designer' ) }
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
		<PanelBody
			title={ __( 'Attendees', 'camptix-badge-designer' ) }
			initialOpen={ true }
		>
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

function tabs() {
	return [
		{ name: 'document', title: __( 'Document', 'camptix-badge-designer' ) },
		{ name: 'element', title: __( 'Element', 'camptix-badge-designer' ) },
	];
}

export function Sidebar( props ) {
	const { tab, onTab } = props;
	return (
		<aside
			className="ctbd-sidebar"
			aria-label={ __( 'Settings', 'camptix-badge-designer' ) }
		>
			<div className="ctbd-sidebar__tabs" role="tablist">
				{ tabs().map( ( item ) => (
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
