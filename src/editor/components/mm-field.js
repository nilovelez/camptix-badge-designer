/**
 * Number field, in millimeters or points (the label says which). The
 * organizer can type freely; the design only changes when the value is a
 * number within limits, and leaving the field puts back the last valid
 * value.
 */
import { useEffect, useState } from '@wordpress/element';
import { TextControl } from '@wordpress/components';

export function MmField( {
	label,
	value,
	min,
	max,
	onChange,
	help,
	step = 0.5,
} ) {
	const [ text, setText ] = useState( String( value ) );
	const [ focused, setFocused ] = useState( false );

	useEffect( () => {
		if ( ! focused ) {
			setText( String( value ) );
		}
	}, [ value, focused ] );

	function handleChange( next ) {
		setText( next );
		const number = parseFloat( String( next ).replace( ',', '.' ) );
		if ( ! Number.isNaN( number ) && number >= min && number <= max ) {
			onChange( Math.round( number * 10 ) / 10 );
		}
	}

	return (
		<div
			onFocus={ () => setFocused( true ) }
			onBlur={ () => setFocused( false ) }
		>
			<TextControl
				__next40pxDefaultSize
				__nextHasNoMarginBottom
				label={ label }
				type="number"
				min={ min }
				max={ max }
				step={ step }
				value={ text }
				help={ help }
				onChange={ handleChange }
			/>
		</div>
	);
}
