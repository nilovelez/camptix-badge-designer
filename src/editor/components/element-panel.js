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
import { isSquare } from '../elements';

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

const palette = window.ctbgSettings.palette || [];

const DESCRIPTIONS = {
	text: [ 'Text box', 'Text with attendee variables, on one line.' ],
	gravatar: [
		'Gravatar',
		"The attendee's Gravatar. Nothing is printed when there is none.",
	],
	qr: [
		'QR code',
		"Links to the attendee's WordPress.org profile. Black on white.",
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
				className="ctbg-content-field"
				label="Text"
				value={ element.content }
				onChange={ ( content ) => change( { content }, 'content' ) }
			/>
			<div className="ctbg-gap" />
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
			<div className="ctbg-two-columns">
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
			<p className="ctbg-label">Alignment</p>
			<div className="ctbg-segmented" role="group" aria-label="Alignment">
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
			<p className="ctbg-label">Color</p>
			{ palette.length ? (
				<ColorPalette
					colors={ palette }
					value={ element.color }
					onChange={ ( color ) => color && change( { color } ) }
					disableCustomColors
					clearable={ false }
				/>
			) : (
				<p className="ctbg-help">This site has no color palette.</p>
			) }
		</PanelBody>
	);
}

function FitPanel( { element, change, layout } ) {
	let status = null;
	if ( layout && layout.overflow ) {
		status = (
			<Notice status="warning" isDismissible={ false }>
				For this attendee the text does not fit
				{ element.shrink ? ' even at ' + layout.size + ' pt' : '' }: it
				is cut.
			</Notice>
		);
	} else if ( layout && layout.size < layout.originalSize ) {
		status = (
			<p className="ctbg-help">
				For this attendee, reduced from { layout.originalSize } to{ ' ' }
				{ layout.size } pt.
			</p>
		);
	}
	return (
		<PanelBody title="Fit">
			<ToggleControl
				__nextHasNoMarginBottom
				label="Shrink text to fit the box"
				checked={ element.shrink }
				onChange={ ( shrink ) => change( { shrink } ) }
			/>
			{ element.shrink && (
				<>
					<div className="ctbg-gap" />
					<MmField
						label="Minimum size (pt)"
						value={ element.minSize }
						min={ 4 }
						max={ 200 }
						step={ 1 }
						onChange={ ( minSize ) =>
							change( { minSize }, 'minSize' )
						}
					/>
				</>
			) }
			{ status }
		</PanelBody>
	);
}

function PositionPanel( { element, change } ) {
	const square = isSquare( element );
	return (
		<PanelBody title="Position and size" initialOpen={ false }>
			<div className="ctbg-two-columns">
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
					min={ 3 }
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
					min={ 3 }
					max={ 1000 }
					onChange={ ( height ) =>
						change(
							square ? { width: height, height } : { height },
							'height'
						)
					}
				/>
			</div>
			<p className="ctbg-help">
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
	onChange,
	onDelete,
} ) {
	if ( ! element ) {
		return (
			<p className="ctbg-sidebar__empty">
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
			<div className="ctbg-element-card">
				<strong>{ title }</strong>
				<span>{ description }</span>
			</div>
			{ element.type === 'text' && (
				<>
					<ContentPanel
						element={ element }
						change={ change }
						questions={ questions }
					/>
					<TypographyPanel element={ element } change={ change } />
					<FitPanel
						element={ element }
						change={ change }
						layout={ layout }
					/>
				</>
			) }
			<PositionPanel element={ element } change={ change } />
			<div className="ctbg-sidebar__footer">
				<Button variant="tertiary" isDestructive onClick={ onDelete }>
					Delete element
				</Button>
			</div>
		</>
	);
}
