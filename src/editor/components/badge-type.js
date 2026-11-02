/**
 * The badge type: single (one face per page) or folded (the face printed
 * twice on a taller page, folded in half). Asked when a background is
 * chosen, and changed later in the Print size panel.
 */
import { __, sprintf } from '@wordpress/i18n';
import { RadioControl } from '@wordpress/components';
import { printedPageSize } from '../geometry';

/**
 * @param {Object}                    props
 * @param {boolean}                   props.folded   Whether the badge is folded.
 * @param {Object}                    props.size     Print size of one face.
 * @param {(folded: boolean) => void} props.onChange Called with the new value.
 */
export function BadgeTypeControl( { folded, size, onChange } ) {
	const page = printedPageSize( size, true );
	return (
		<RadioControl
			className="ctbd-badge-type"
			label={ __( 'Badge type', 'camptix-badge-designer' ) }
			selected={ folded ? 'folded' : 'single' }
			options={ [
				{
					label: __( 'Single', 'camptix-badge-designer' ),
					value: 'single',
					description: __(
						'One badge per page, printed on one side or both.',
						'camptix-badge-designer'
					),
				},
				{
					label: __( 'Folded', 'camptix-badge-designer' ),
					value: 'folded',
					description: sprintf(
						/* translators: 1: width, 2: height of the page, in millimeters. */
						__(
							'The badge twice on a %1$s × %2$s mm page, the top one upside down, to fold in half. Only one side is designed.',
							'camptix-badge-designer'
						),
						page.width,
						page.height
					),
				},
			] }
			onChange={ ( value ) => onChange( value === 'folded' ) }
		/>
	);
}
