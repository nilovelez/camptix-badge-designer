/**
 * The Element tab: properties of the selected element.
 */
import { useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import {
	Button,
	ColorPalette,
	Notice,
	PanelBody,
	SelectControl,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { alignCenter, alignLeft, alignRight } from '@wordpress/icons';
import { MmField } from './mm-field';
import { textVariables } from '../../shared/text-layout';
import { familyWeights, fontFamilies } from '../fonts';
import { scriptById } from '../../shared/scripts';
import { isSquare, QR_MIN_SIZE } from '../elements';

const WEIGHT_NAMES = {
	100: __( 'Thin', 'camptix-badge-designer' ),
	200: __( 'Extra light', 'camptix-badge-designer' ),
	300: __( 'Light', 'camptix-badge-designer' ),
	400: __( 'Regular', 'camptix-badge-designer' ),
	500: __( 'Medium', 'camptix-badge-designer' ),
	600: __( 'Semibold', 'camptix-badge-designer' ),
	700: __( 'Bold', 'camptix-badge-designer' ),
	800: __( 'Extra bold', 'camptix-badge-designer' ),
	900: __( 'Black', 'camptix-badge-designer' ),
};

const ALIGNMENTS = [
	{
		value: 'left',
		label: __( 'Align left', 'camptix-badge-designer' ),
		icon: alignLeft,
	},
	{
		value: 'center',
		label: __( 'Align center', 'camptix-badge-designer' ),
		icon: alignCenter,
	},
	{
		value: 'right',
		label: __( 'Align right', 'camptix-badge-designer' ),
		icon: alignRight,
	},
];

const palette = window.ctbdSettings.palette || [];

const DESCRIPTIONS = {
	text: [
		__( 'Text box', 'camptix-badge-designer' ),
		__(
			'Text with attendee variables, on one line.',
			'camptix-badge-designer'
		),
	],
	gravatar: [
		__( 'Gravatar', 'camptix-badge-designer' ),
		__(
			"The attendee's Gravatar, from their email address.",
			'camptix-badge-designer'
		),
	],
	qr: [
		__( 'QR code', 'camptix-badge-designer' ),
		sprintf(
			/* translators: 1: minimum size of the QR code, in millimeters. */
			__(
				"Links to the attendee's WordPress.org profile. Black, at least %1$d × %1$d mm. Nothing is printed for attendees without a username.",
				'camptix-badge-designer'
			),
			QR_MIN_SIZE
		),
	],
};

function ContentPanel( { element, change, questions } ) {
	const [ variable, setVariable ] = useState( '' );
	const variables = textVariables( questions );
	return (
		<PanelBody title={ __( 'Content', 'camptix-badge-designer' ) }>
			<TextControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				className="ctbd-content-field"
				label={ __( 'Text', 'camptix-badge-designer' ) }
				value={ element.content }
				onChange={ ( content ) => change( { content }, 'content' ) }
			/>
			<div className="ctbd-gap" />
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Insert variable', 'camptix-badge-designer' ) }
				value={ variable }
				options={ [
					{
						label: __(
							'Choose a variable…',
							'camptix-badge-designer'
						),
						value: '',
					},
					...variables.map( ( v ) => ( {
						label: v.label,
						value: v.token,
					} ) ),
				] }
				onChange={ ( token ) => {
					if ( token ) {
						const separator =
							element.content && ! element.content.endsWith( ' ' )
								? ' '
								: '';
						change( {
							content: element.content + separator + token,
						} );
					}
					setVariable( '' );
				} }
			/>
		</PanelBody>
	);
}

/**
 * What the font of a text box cannot print, for all attendees: those printed
 * in Inter instead, and, by script, those no font here can print, with the
 * font to install (milestone 13).
 *
 * @param {Object} props       Props.
 * @param {Object} props.stats {fallback, missing, scripts} from the editor.
 * @return {Element|null} Notices.
 */
function FontNotice( { stats } ) {
	if ( ! stats || ( ! stats.fallback && ! stats.missing ) ) {
		return null;
	}
	const lines = Object.entries( stats.scripts ).map( ( [ id, count ] ) => {
		const script = scriptById( id );
		if ( ! script.font ) {
			return sprintf(
				/* translators: %d: number of attendees. */
				_n(
					'%d attendee has emoji, symbols or other characters this font cannot print.',
					'%d attendees have emoji, symbols or other characters this font cannot print.',
					count,
					'camptix-badge-designer'
				),
				count
			);
		}
		if ( script.font === 'Inter' ) {
			// Only when the text mixes it with a script Inter lacks.
			return sprintf(
				/* translators: 1: number of attendees, 2: a script, such as Latin. */
				_n(
					'%1$d attendee mixes %2$s with another script, and no font here has both: a text box prints in one font.',
					'%1$d attendees mix %2$s with another script, and no font here has both: a text box prints in one font.',
					count,
					'camptix-badge-designer'
				),
				count,
				script.label
			);
		}
		return sprintf(
			/* translators: 1: number of attendees, 2: a script, such as Japanese, 3: font names. */
			_n(
				'%1$d attendee uses %2$s characters this font cannot print. Install a font that has them, such as %3$s, from Appearance › Fonts; it can stay inactive.',
				'%1$d attendees use %2$s characters this font cannot print. Install a font that has them, such as %3$s, from Appearance › Fonts; it can stay inactive.',
				count,
				'camptix-badge-designer'
			),
			count,
			script.label,
			script.font
		);
	} );
	return (
		<div className="ctbd-font-notice">
			{ lines.length > 0 && (
				<Notice status="warning" isDismissible={ false }>
					{ lines.map( ( line ) => (
						<p key={ line }>{ line }</p>
					) ) }
				</Notice>
			) }
			{ stats.fallback > 0 && (
				<p className="ctbd-help">
					{ sprintf(
						/* translators: %d: number of attendees. */
						_n(
							'%d attendee prints in Inter, because this font lacks some of the letters.',
							'%d attendees print in Inter, because this font lacks some of their letters.',
							stats.fallback,
							'camptix-badge-designer'
						),
						stats.fallback
					) }
				</p>
			) }
		</div>
	);
}

function TypographyPanel( { element, change, stats } ) {
	const families = fontFamilies();
	const weights = familyWeights( element.font );
	return (
		<PanelBody title={ __( 'Typography', 'camptix-badge-designer' ) }>
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __( 'Font', 'camptix-badge-designer' ) }
				value={ element.font }
				options={ families.map( ( f ) => ( {
					label:
						f.source === 'library'
							? sprintf(
									/* translators: %s: font family name. */
									__(
										'%s (Font Library)',
										'camptix-badge-designer'
									),
									f.family
								)
							: f.family,
					value: f.family,
				} ) ) }
				onChange={ ( font ) => {
					// Keep the weight if the new family has it, or take the closest one.
					const available = familyWeights( font );
					let weight = available[ 0 ];
					for ( const w of available ) {
						if (
							Math.abs( w - element.weight ) <
							Math.abs( weight - element.weight )
						) {
							weight = w;
						}
					}
					change( { font, weight } );
				} }
			/>
			<FontNotice stats={ stats } />
			<div className="ctbd-two-columns">
				<MmField
					label={ __( 'Size (pt)', 'camptix-badge-designer' ) }
					value={ element.size }
					min={ 4 }
					max={ 200 }
					step={ 1 }
					onChange={ ( size ) => change( { size }, 'size' ) }
				/>
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label={ __( 'Weight', 'camptix-badge-designer' ) }
					value={ String( element.weight ) }
					options={ weights.map( ( w ) => ( {
						label: WEIGHT_NAMES[ w ] || w,
						value: w,
					} ) ) }
					onChange={ ( weight ) => change( { weight } ) }
				/>
			</div>
			<p className="ctbd-label">
				{ __( 'Alignment', 'camptix-badge-designer' ) }
			</p>
			<div
				className="ctbd-segmented"
				role="group"
				aria-label={ __( 'Alignment', 'camptix-badge-designer' ) }
			>
				{ ALIGNMENTS.map( ( a ) => (
					<Button
						key={ a.value }
						icon={ a.icon }
						label={ a.label }
						isPressed={ element.align === a.value }
						onClick={ () => change( { align: a.value } ) }
					/>
				) ) }
			</div>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Uppercase', 'camptix-badge-designer' ) }
				checked={ element.uppercase }
				onChange={ ( uppercase ) => change( { uppercase } ) }
			/>
			<p className="ctbd-label">
				{ __( 'Color', 'camptix-badge-designer' ) }
			</p>
			{ /* The site palette plus a custom color, solid: the PDF draws
			     text without transparency. */ }
			<ColorPalette
				colors={ palette }
				value={ element.color }
				onChange={ ( color ) => color && change( { color } ) }
				enableAlpha={ false }
				clearable={ false }
			/>
		</PanelBody>
	);
}

// Text that does not fit shrinks a little; when it still does not fit, it is
// cut and the editor warns.
function OverflowNotice( { layout } ) {
	if ( ! layout || ! layout.overflow ) {
		return null;
	}
	return (
		<div className="ctbd-element-notice">
			<Notice status="warning" isDismissible={ false }>
				{ __(
					'For this attendee the text does not fit the box, even made smaller: it is cut. Make the box wider or the text smaller.',
					'camptix-badge-designer'
				) }
			</Notice>
		</div>
	);
}

const SHAPES = [
	{ value: 'round', label: __( 'Round', 'camptix-badge-designer' ) },
	{ value: 'square', label: __( 'Square', 'camptix-badge-designer' ) },
];

const FALLBACKS = [
	{
		value: '404',
		label: __( 'None: print nothing', 'camptix-badge-designer' ),
	},
	{
		value: 'identicon',
		label: __( 'Identicon (generated)', 'camptix-badge-designer' ),
	},
	{
		value: 'monsterid',
		label: __( 'Monster (generated)', 'camptix-badge-designer' ),
	},
	{
		value: 'wavatar',
		label: __( 'Wavatar (generated)', 'camptix-badge-designer' ),
	},
	{
		value: 'retro',
		label: __( 'Retro (generated)', 'camptix-badge-designer' ),
	},
	{
		value: 'robohash',
		label: __( 'Robot (generated)', 'camptix-badge-designer' ),
	},
	{
		value: 'image',
		label: __(
			'An image from the Media Library',
			'camptix-badge-designer'
		),
	},
];

function GravatarPanel( { element, change, images, onPickImage } ) {
	const imageUrl = element.fallbackImage && images[ element.fallbackImage ];
	const pickImage = () =>
		onPickImage( ( id ) =>
			change( { fallback: 'image', fallbackImage: id } )
		);

	return (
		<PanelBody title={ __( 'Gravatar', 'camptix-badge-designer' ) }>
			<p className="ctbd-label">
				{ __( 'Shape', 'camptix-badge-designer' ) }
			</p>
			<div
				className="ctbd-segmented"
				role="group"
				aria-label={ __( 'Shape', 'camptix-badge-designer' ) }
			>
				{ SHAPES.map( ( shape ) => (
					<Button
						key={ shape.value }
						isPressed={ element.shape === shape.value }
						onClick={ () => change( { shape: shape.value } ) }
					>
						{ shape.label }
					</Button>
				) ) }
			</div>
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ __(
					'When there is no Gravatar',
					'camptix-badge-designer'
				) }
				value={ element.fallback }
				options={ FALLBACKS }
				onChange={ ( fallback ) => {
					// The image option needs an image first.
					if ( fallback === 'image' && ! element.fallbackImage ) {
						pickImage();
						return;
					}
					change( { fallback } );
				} }
			/>
			{ element.fallback === 'image' && (
				<div className="ctbd-fallback-image">
					{ imageUrl ? (
						<img
							className={
								element.shape === 'round' ? 'is-round' : ''
							}
							src={ imageUrl }
							alt=""
						/>
					) : (
						<span className="ctbd-help">
							{ __(
								'Image not found.',
								'camptix-badge-designer'
							) }
						</span>
					) }
					<Button variant="secondary" onClick={ pickImage }>
						{ __( 'Replace image', 'camptix-badge-designer' ) }
					</Button>
				</div>
			) }
			<p className="ctbd-help">
				{ __(
					'Generated images are made by Gravatar from each email address, so every attendee gets a different one.',
					'camptix-badge-designer'
				) }
			</p>
		</PanelBody>
	);
}

function QrPanel( { element, change } ) {
	return (
		<PanelBody title={ __( 'Settings', 'camptix-badge-designer' ) }>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __(
					'Transparent background',
					'camptix-badge-designer'
				) }
				help={
					element.transparent
						? __(
								'No white square behind the code. Phones only read it on a light, plain background: test a printed badge before printing them all.',
								'camptix-badge-designer'
							)
						: __(
								'The code is printed on a white square, which phones read on any background.',
								'camptix-badge-designer'
							)
				}
				checked={ !! element.transparent }
				onChange={ ( transparent ) => change( { transparent } ) }
			/>
		</PanelBody>
	);
}

function PositionPanel( { element, change } ) {
	const square = isSquare( element );
	const minSize = element.type === 'qr' ? QR_MIN_SIZE : 3;
	return (
		<PanelBody
			title={ __( 'Position and size', 'camptix-badge-designer' ) }
			initialOpen={ false }
		>
			<div className="ctbd-two-columns">
				<MmField
					label={ __( 'X (mm)', 'camptix-badge-designer' ) }
					value={ element.x }
					min={ -500 }
					max={ 1000 }
					onChange={ ( x ) => change( { x }, 'x' ) }
				/>
				<MmField
					label={ __( 'Y (mm)', 'camptix-badge-designer' ) }
					value={ element.y }
					min={ -500 }
					max={ 1000 }
					onChange={ ( y ) => change( { y }, 'y' ) }
				/>
				<MmField
					label={ __( 'Width (mm)', 'camptix-badge-designer' ) }
					value={ element.width }
					min={ minSize }
					max={ 1000 }
					onChange={ ( width ) =>
						change(
							square ? { width, height: width } : { width },
							'width'
						)
					}
				/>
				<MmField
					label={ __( 'Height (mm)', 'camptix-badge-designer' ) }
					value={ element.height }
					min={ minSize }
					max={ 1000 }
					onChange={ ( height ) =>
						change(
							square ? { width: height, height } : { height },
							'height'
						)
					}
				/>
			</div>
			<p className="ctbd-help">
				{ square
					? __(
							'From the top-left corner of the trim. Width and height stay equal.',
							'camptix-badge-designer'
						)
					: __(
							'From the top-left corner of the trim.',
							'camptix-badge-designer'
						) }
			</p>
		</PanelBody>
	);
}

export function ElementPanel( {
	element,
	layout,
	textStats,
	questions,
	images,
	onPickImage,
	onChange,
	onDelete,
} ) {
	if ( ! element ) {
		return (
			<p className="ctbd-sidebar__empty">
				{ __(
					'Select an element on the badge to edit it.',
					'camptix-badge-designer'
				) }
			</p>
		);
	}
	const change = ( props, field ) =>
		onChange(
			{ ...element, ...props },
			field ? 'field-' + element.id + '-' + field : undefined
		);
	const [ title, description ] = DESCRIPTIONS[ element.type ];

	return (
		<>
			<div className="ctbd-element-card">
				<strong>{ title }</strong>
				<span>{ description }</span>
			</div>
			{ element.type === 'text' && (
				<>
					<OverflowNotice layout={ layout } />
					<ContentPanel
						element={ element }
						change={ change }
						questions={ questions }
					/>
					<TypographyPanel
						element={ element }
						change={ change }
						stats={ textStats }
					/>
				</>
			) }
			{ element.type === 'gravatar' && (
				<GravatarPanel
					element={ element }
					change={ change }
					images={ images }
					onPickImage={ onPickImage }
				/>
			) }
			{ element.type === 'qr' && (
				<QrPanel element={ element } change={ change } />
			) }
			<PositionPanel element={ element } change={ change } />
			<div className="ctbd-sidebar__footer">
				<Button variant="tertiary" isDestructive onClick={ onDelete }>
					{ __( 'Delete element', 'camptix-badge-designer' ) }
				</Button>
			</div>
		</>
	);
}
