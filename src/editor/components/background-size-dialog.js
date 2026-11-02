/**
 * Asks for the print size when a new background does not match the
 * current page: for a PDF, how much of its page is bleed; for an image,
 * the trim width and the bleed (the height follows its proportions).
 */
import { useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { Button, Modal, Notice } from '@wordpress/components';
import { MmField } from './mm-field';
import {
	LIMITS,
	RECOMMENDED_DPI,
	effectiveDpi,
	heightFromImage,
	pageSize,
	sizeFromPdf,
} from '../geometry';

export function BackgroundSizeDialog( {
	background,
	size,
	onApply,
	onCancel,
} ) {
	const isPdf = background.type === 'pdf';
	const [ bleed, setBleed ] = useState( size.bleed );
	const [ width, setWidth ] = useState(
		isPdf ? sizeFromPdf( background, size.bleed ).width : size.width
	);

	let newSize;
	if ( isPdf ) {
		newSize = { ...size, ...sizeFromPdf( background, bleed ), bleed };
	} else {
		newSize = {
			...size,
			width,
			height: heightFromImage( background, width, bleed ),
			bleed,
		};
	}
	const page = pageSize( newSize );
	const valid =
		newSize.width >= LIMITS.width.min &&
		newSize.width <= LIMITS.width.max &&
		newSize.height >= LIMITS.height.min &&
		newSize.height <= LIMITS.height.max;
	const dpi = effectiveDpi( background, newSize );

	return (
		<Modal
			title={ __( 'Background size', 'camptix-badge-designer' ) }
			onRequestClose={ onCancel }
			className="ctbd-size-dialog"
		>
			{ isPdf ? (
				<p>
					{ sprintf(
						/* translators: 1: PDF page width, 2: PDF page height, 3: page width with bleed, 4: page height with bleed, all in millimeters. */
						__(
							'This PDF page is %1$s × %2$s mm, and the current page with bleed is %3$s × %4$s mm. How much of the PDF page is bleed?',
							'camptix-badge-designer'
						),
						background.pageWidth,
						background.pageHeight,
						pageSize( size ).width,
						pageSize( size ).height
					) }
				</p>
			) : (
				<p>
					{ sprintf(
						/* translators: 1: image width, 2: image height, in pixels; 3: page width with bleed, 4: page height with bleed, in millimeters. */
						__(
							'This image is %1$s × %2$s px, a different shape from the current page with bleed (%3$s × %4$s mm). At what size will it be printed?',
							'camptix-badge-designer'
						),
						background.pixelWidth,
						background.pixelHeight,
						pageSize( size ).width,
						pageSize( size ).height
					) }
				</p>
			) }

			<div className="ctbd-size-dialog__fields">
				{ ! isPdf && (
					<MmField
						label={ __( 'Width (mm)', 'camptix-badge-designer' ) }
						value={ width }
						min={ LIMITS.width.min }
						max={ LIMITS.width.max }
						onChange={ setWidth }
					/>
				) }
				<MmField
					label={ __( 'Bleed (mm)', 'camptix-badge-designer' ) }
					value={ bleed }
					min={ LIMITS.bleed.min }
					max={ LIMITS.bleed.max }
					onChange={ setBleed }
				/>
			</div>

			<p>
				{ sprintf(
					/* translators: 1: width, 2: height, 3: width with bleed, 4: height with bleed, all in millimeters. */
					__(
						'Print size: %1$s × %2$s mm. Page with bleed: %3$s × %4$s mm.',
						'camptix-badge-designer'
					),
					newSize.width,
					newSize.height,
					page.width,
					page.height
				) }
			</p>
			{ dpi !== null && (
				<Notice
					status={ dpi >= RECOMMENDED_DPI ? 'info' : 'warning' }
					isDismissible={ false }
				>
					{ dpi < RECOMMENDED_DPI
						? sprintf(
								/* translators: 1: resolution of the image, 2: recommended resolution, in dpi. */
								__(
									'%1$d dpi at this size: too low for print. %2$d dpi are recommended.',
									'camptix-badge-designer'
								),
								dpi,
								RECOMMENDED_DPI
							)
						: sprintf(
								/* translators: %d: resolution of the image, in dpi. */
								__(
									'%d dpi at this size.',
									'camptix-badge-designer'
								),
								dpi
							) }
				</Notice>
			) }
			{ ! valid && (
				<Notice status="error" isDismissible={ false }>
					{ sprintf(
						/* translators: 1: minimum, 2: maximum size, in millimeters. */
						__(
							'The print size must be between %1$d and %2$d mm on each side.',
							'camptix-badge-designer'
						),
						LIMITS.width.min,
						LIMITS.width.max
					) }
				</Notice>
			) }

			<div className="ctbd-size-dialog__actions">
				<Button variant="tertiary" onClick={ onCancel }>
					{ __( 'Cancel', 'camptix-badge-designer' ) }
				</Button>
				<Button
					variant="primary"
					disabled={ ! valid }
					onClick={ () => onApply( newSize ) }
				>
					{ __( 'Use this size', 'camptix-badge-designer' ) }
				</Button>
			</div>
		</Modal>
	);
}
