/**
 * The Element tab: properties of the selected element.
 */
import { useState } from '@wordpress/element';
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
import { isSquare, QR_MIN_SIZE } from '../elements';

const WEIGHT_NAMES = {
	100: 'Thin',
	200: 'Extra light',
	300: 'Light',
	400: 'Regular',
	500: 'Medium',
	600: 'Semibold',
	700: 'Bold',
	800: 'Extra bold',
	900: 'Black',
};

const ALIGNMENTS = [
	{ value: 'left', label: 'Align left', icon: alignLeft },
	{ value: 'center', label: 'Align center', icon: alignCenter },
	{ value: 'right', label: 'Align right', icon: alignRight },
];

const palette = window.ctbdSettings.palette || [];

const DESCRIPTIONS = {
	text: [ 'Text box', 'Text with attendee variables, on one line.' ],
	gravatar: [
		'Gravatar',
		"The attendee's Gravatar, from their email address.",
	],
	qr: [
		'QR code',
		"Links to the attendee's WordPress.org profile. Black on white, at least " +
			QR_MIN_SIZE +
			' × ' +
			QR_MIN_SIZE +
			' mm. Nothing is printed for attendees without a username.',
	],
};

function ContentPanel( { element, change, questions } ) {
	const [ variable, setVariable ] = useState( '' );
	const variables = textVariables( questions );
	return (
		<PanelBody title="Content">
			<TextControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				className="ctbd-content-field"
				label="Text"
				value={ element.content }
				onChange={ ( content ) => change( { content }, 'content' ) }
			/>
			<div className="ctbd-gap" />
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label="Insert variable"
				value={ variable }
				options={ [
					{ label: 'Choose a variable…', value: '' },
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

function TypographyPanel( { element, change } ) {
	const families = fontFamilies();
	const weights = familyWeights( element.font );
	return (
		<PanelBody title="Typography">
			<SelectControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label="Font"
				value={ element.font }
				options={ families.map( ( f ) => ( {
					label:
						f.source === 'library'
							? f.family + ' (Font Library)'
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
			<div className="ctbd-two-columns">
				<MmField
					label="Size (pt)"
					value={ element.size }
					min={ 4 }
					max={ 200 }
					step={ 1 }
					onChange={ ( size ) => change( { size }, 'size' ) }
				/>
				<SelectControl
					__next40pxDefaultSize
					__nextHasNoMarginBottom
					label="Weight"
					value={ String( element.weight ) }
					options={ weights.map( ( w ) => ( {
						label: WEIGHT_NAMES[ w ] || w,
						value: w,
					} ) ) }
					onChange={ ( weight ) => change( { weight } ) }
				/>
			</div>
			<p className="ctbd-label">Alignment</p>
			<div className="ctbd-segmented" role="group" aria-label="Alignment">
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
				label="Uppercase"
				checked={ element.uppercase }
				onChange={ ( uppercase ) => change( { uppercase } ) }
			/>
			<p className="ctbd-label">Color</p>
			{ palette.length ? (
				<ColorPalette
					colors={ palette }
					value={ element.color }
					onChange={ ( color ) => color && change( { color } ) }
					disableCustomColors
					clearable={ false }
				/>
			) : (
				<p className="ctbd-help">This site has no color palette.</p>
			) }
		</PanelBody>
	);
}

// Text is never resized: when it does not fit the box, it is cut and the
// editor warns.
function OverflowNotice( { layout } ) {
	if ( ! layout || ! layout.overflow ) {
		return null;
	}
	return (
		<div className="ctbd-element-notice">
			<Notice status="warning" isDismissible={ false }>
				For this attendee the text does not fit the box: it is cut. Make
				the box wider or the text smaller.
			</Notice>
		</div>
	);
}

const SHAPES = [
	{ value: 'round', label: 'Round' },
	{ value: 'square', label: 'Square' },
];

const FALLBACKS = [
	{ value: '404', label: 'None: print nothing' },
	{ value: 'identicon', label: 'Identicon (generated)' },
	{ value: 'monsterid', label: 'Monster (generated)' },
	{ value: 'wavatar', label: 'Wavatar (generated)' },
	{ value: 'retro', label: 'Retro (generated)' },
	{ value: 'robohash', label: 'Robot (generated)' },
	{ value: 'image', label: 'An image from the Media Library' },
];

function GravatarPanel( { element, change, images, onPickImage } ) {
	const imageUrl = element.fallbackImage && images[ element.fallbackImage ];
	const pickImage = () =>
		onPickImage( ( id ) =>
			change( { fallback: 'image', fallbackImage: id } )
		);

	return (
		<PanelBody title="Gravatar">
			<p className="ctbd-label">Shape</p>
			<div className="ctbd-segmented" role="group" aria-label="Shape">
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
				label="When there is no Gravatar"
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
						<span className="ctbd-help">Image not found.</span>
					) }
					<Button variant="secondary" onClick={ pickImage }>
						Replace image
					</Button>
				</div>
			) }
			<p className="ctbd-help">
				Generated images are made by Gravatar from each email address,
				so every attendee gets a different one.
			</p>
		</PanelBody>
	);
}

function PositionPanel( { element, change } ) {
	const square = isSquare( element );
	const minSize = element.type === 'qr' ? QR_MIN_SIZE : 3;
	return (
		<PanelBody title="Position and size" initialOpen={ false }>
			<div className="ctbd-two-columns">
				<MmField
					label="X (mm)"
					value={ element.x }
					min={ -500 }
					max={ 1000 }
					onChange={ ( x ) => change( { x }, 'x' ) }
				/>
				<MmField
					label="Y (mm)"
					value={ element.y }
					min={ -500 }
					max={ 1000 }
					onChange={ ( y ) => change( { y }, 'y' ) }
				/>
				<MmField
					label="Width (mm)"
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
					label="Height (mm)"
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
				From the top-left corner of the trim.
				{ square ? ' Width and height stay equal.' : '' }
			</p>
		</PanelBody>
	);
}

export function ElementPanel( {
	element,
	layout,
	questions,
	images,
	onPickImage,
	onChange,
	onDelete,
} ) {
	if ( ! element ) {
		return (
			<p className="ctbd-sidebar__empty">
				Select an element on the badge to edit it.
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
					<TypographyPanel element={ element } change={ change } />
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
			<PositionPanel element={ element } change={ change } />
			<div className="ctbd-sidebar__footer">
				<Button variant="tertiary" isDestructive onClick={ onDelete }>
					Delete element
				</Button>
			</div>
		</>
	);
}
