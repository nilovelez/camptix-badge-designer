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
import { familyWeights, fontFamilies, isInstalled } from '../fonts';
import { scriptById, sortScripts } from '../../shared/scripts';
import { FontLink, InstallFontsHelp } from './font-link';
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
 * What the font of a text box cannot print, as a checklist of the fonts to
 * install (milestone 13). Attendees whose text the box's font lacks print in
 * a fallback font: Inter, then the Noto font of the script when it is
 * installed. The warning lists, by script, the font to install for those no
 * font can print yet, and in green the scripts already printed with an
 * installed fallback. With nothing left to install, only a note remains.
 *
 * @param {Object} props       Props.
 * @param {Object} props.stats {fallback, families, missing, unresolved,
 *                             resolved} from the editor.
 * @return {Element|null} Notices.
 */
function FontNotice( { stats } ) {
	if ( ! stats || ( ! stats.fallback && ! stats.missing ) ) {
		return null;
	}
	if ( ! stats.missing ) {
		return (
			<p className="ctbd-help ctbd-font-notice">
				{ sprintf(
					/* translators: 1: number of attendees, 2: font names. */
					_n(
						'%1$d attendee prints in a fallback font, because this font lacks some of the letters: %2$s.',
						'%1$d attendees print in a fallback font, because this font lacks some of their letters: %2$s.',
						stats.fallback,
						'camptix-badge-designer'
					),
					stats.fallback,
					stats.families.join( ', ' )
				) }
			</p>
		);
	}

	const pending = sortScripts( Object.keys( stats.unresolved ) ).map(
		( id ) => {
			const script = scriptById( id );
			const count = stats.unresolved[ id ];
			if ( ! script.font ) {
				return sprintf(
					/* translators: %d: number of attendees. */
					__(
						'Emoji, symbols or other characters (%d)',
						'camptix-badge-designer'
					),
					count
				);
			}
			// Inter, or the suggested font, is there: the text mixes scripts
			// no single font has.
			if ( script.font === 'Inter' || isInstalled( script.font ) ) {
				return sprintf(
					/* translators: 1: a script, such as Latin, 2: number of attendees. */
					__(
						'%1$s mixed with another script (%2$d): no single font has both; split the box in two',
						'camptix-badge-designer'
					),
					script.label,
					count
				);
			}
			// The font to install, linked to the Font Library screen.
			return (
				<>
					{ sprintf(
						/* translators: 1: a script, such as Japanese, 2: number of attendees. */
						__( '%1$s (%2$d):', 'camptix-badge-designer' ),
						script.label,
						count
					) }{ ' ' }
					<FontLink name={ script.font } />
				</>
			);
		}
	);
	const done = sortScripts( Object.keys( stats.resolved ) )
		.filter( ( id ) => ! stats.unresolved[ id ] )
		.map( ( id ) =>
			sprintf(
				/* translators: 1: a script, such as Japanese, 2: number of attendees, 3: a font name. */
				__( '%1$s (%2$d): %3$s', 'camptix-badge-designer' ),
				scriptById( id ).label,
				stats.resolved[ id ].count,
				stats.resolved[ id ].family
			)
		);

	return (
		<div className="ctbd-font-notice">
			<Notice status="warning" isDismissible={ false }>
				<strong>
					{ sprintf(
						/* translators: %d: number of attendees. */
						_n(
							'The font of this box cannot print the characters of %d attendee.',
							'The font of this box cannot print the characters of %d attendees.',
							stats.missing,
							'camptix-badge-designer'
						),
						stats.missing
					) }
				</strong>
				<p>
					<InstallFontsHelp />
				</p>
				<ul className="ctbd-font-notice__scripts">
					{ pending.map( ( line, index ) => (
						<li key={ index }>{ line }</li>
					) ) }
					{ done.map( ( line ) => (
						<li key={ line } className="is-done">
							<span aria-hidden="true">✓ </span>
							<span className="screen-reader-text">
								{ __( 'Installed:', 'camptix-badge-designer' ) }
							</span>
							{ line }
						</li>
					) ) }
				</ul>
			</Notice>
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
// cut and the editor warns. The same for characters the font cannot print.
function OverflowNotice( { layout } ) {
	if ( ! layout ) {
		return null;
	}
	const missing = layout.missing && layout.missing.length > 0;
	if ( ! layout.overflow && ! missing ) {
		return null;
	}
	return (
		<div className="ctbd-element-notice">
			{ missing && (
				<Notice status="warning" isDismissible={ false }>
					{ __(
						'For this attendee the font cannot print some characters: they print as empty boxes, as shown. Pick a font that has them (see Typography).',
						'camptix-badge-designer'
					) }
				</Notice>
			) }
			{ layout.overflow && (
				<Notice status="warning" isDismissible={ false }>
					{ __(
						'For this attendee the text does not fit the box, even made smaller: it is cut. Make the box wider or the text smaller.',
						'camptix-badge-designer'
					) }
				</Notice>
			) }
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
