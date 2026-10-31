/**
 * Asks for the print size when a new background does not match the
 * current page: for a PDF, how much of its page is bleed; for an image,
 * the trim width and the bleed (the height follows its proportions).
 */
import { useState } from '@wordpress/element';
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
			title="Background size"
			onRequestClose={ onCancel }
			className="ctbg-size-dialog"
		>
			{ isPdf ? (
				<p>
					This PDF page is { background.pageWidth } ×{ ' ' }
					{ background.pageHeight } mm, and the current page with
					bleed is { pageSize( size ).width } ×{ ' ' }
					{ pageSize( size ).height } mm. How much of the PDF page is
					bleed?
				</p>
			) : (
				<p>
					This image is { background.pixelWidth } ×{ ' ' }
					{ background.pixelHeight } px, a different shape from the
					current page with bleed ({ pageSize( size ).width } ×{ ' ' }
					{ pageSize( size ).height } mm). At what size will it be
					printed?
				</p>
			) }

			<div className="ctbg-size-dialog__fields">
				{ ! isPdf && (
					<MmField
						label="Width (mm)"
						value={ width }
						min={ LIMITS.width.min }
						max={ LIMITS.width.max }
						onChange={ setWidth }
					/>
				) }
				<MmField
					label="Bleed (mm)"
					value={ bleed }
					min={ LIMITS.bleed.min }
					max={ LIMITS.bleed.max }
					onChange={ setBleed }
				/>
			</div>

			<p>
				Print size:{ ' ' }
				<strong>
					{ newSize.width } × { newSize.height } mm
				</strong>
				. Page with bleed: { page.width } × { page.height } mm.
			</p>
			{ dpi !== null && (
				<Notice
					status={ dpi >= RECOMMENDED_DPI ? 'info' : 'warning' }
					isDismissible={ false }
				>
					{ dpi } dpi at this size
					{ dpi < RECOMMENDED_DPI
						? ': too low for print. ' +
							RECOMMENDED_DPI +
							' dpi are recommended.'
						: '.' }
				</Notice>
			) }
			{ ! valid && (
				<Notice status="error" isDismissible={ false }>
					The print size must be between { LIMITS.width.min } and{ ' ' }
					{ LIMITS.width.max } mm on each side.
				</Notice>
			) }

			<div className="ctbg-size-dialog__actions">
				<Button variant="tertiary" onClick={ onCancel }>
					Cancel
				</Button>
				<Button
					variant="primary"
					disabled={ ! valid }
					onClick={ () => onApply( newSize ) }
				>
					Use this size
				</Button>
			</div>
		</Modal>
	);
}
