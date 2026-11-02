/**
 * Size helpers. Every size in the design is in millimeters.
 */

// Same limits as the server (includes/design.php).
export const LIMITS = {
	width: { min: 20, max: 500 },
	height: { min: 20, max: 500 },
	bleed: { min: 0, max: 10 },
	safe: { min: 0, max: 30 },
};

export const RECOMMENDED_DPI = 300;

export function round1( value ) {
	return Math.round( value * 10 ) / 10;
}

/**
 * Page size including the bleed on every side.
 *
 * @param {Object} size {width, height, bleed}.
 * @return {{width: number, height: number}} Page size in mm.
 */
export function pageSize( size ) {
	return {
		width: round1( size.width + 2 * size.bleed ),
		height: round1( size.height + 2 * size.bleed ),
	};
}

/**
 * Size of each printed page, without crop marks. A folded badge prints
 * the face twice, one above the other, joined at the fold without bleed
 * between them: twice the trim height, plus the bleed at the top and the
 * bottom.
 *
 * @param {Object}  size   {width, height, bleed}.
 * @param {boolean} folded Whether the badge is folded.
 * @return {{width: number, height: number}} Page size in mm.
 */
export function printedPageSize( size, folded ) {
	return {
		width: round1( size.width + 2 * size.bleed ),
		height: round1( ( folded ? 2 : 1 ) * size.height + 2 * size.bleed ),
	};
}

/**
 * Resolution of a bitmap background printed on the page with bleed.
 *
 * @param {Object} background Background from the design.
 * @param {Object} size       Print size.
 * @return {number|null} Dots per inch (the lower of both axes), or null for a PDF.
 */
export function effectiveDpi( background, size ) {
	if (
		! background ||
		background.type === 'pdf' ||
		! background.pixelWidth
	) {
		return null;
	}
	const page = pageSize( size );
	return Math.floor(
		Math.min(
			background.pixelWidth / ( page.width / 25.4 ),
			background.pixelHeight / ( page.height / 25.4 )
		)
	);
}

/**
 * Pixels needed for the page at the recommended resolution.
 *
 * @param {Object} size Print size.
 * @return {{width: number, height: number}} Pixels.
 */
export function recommendedPixels( size ) {
	const page = pageSize( size );
	return {
		width: Math.ceil( ( page.width / 25.4 ) * RECOMMENDED_DPI ),
		height: Math.ceil( ( page.height / 25.4 ) * RECOMMENDED_DPI ),
	};
}

/**
 * Whether the background matches the page with bleed: a PDF page must have
 * the same size (within half a millimeter), an image the same proportions
 * (within 1%).
 *
 * @param {Object} background Background from the design.
 * @param {Object} size       Print size.
 * @return {boolean} True when it fits without stretching.
 */
export function backgroundFits( background, size ) {
	if ( ! background ) {
		return true;
	}
	const page = pageSize( size );
	if ( background.type === 'pdf' ) {
		return (
			Math.abs( background.pageWidth - page.width ) <= 0.5 &&
			Math.abs( background.pageHeight - page.height ) <= 0.5
		);
	}
	if ( ! background.pixelWidth || ! background.pixelHeight ) {
		return true;
	}
	const imageRatio = background.pixelWidth / background.pixelHeight;
	const pageRatio = page.width / page.height;
	return Math.abs( imageRatio / pageRatio - 1 ) <= 0.01;
}

/**
 * Print size for a PDF background, given how much of it is bleed.
 *
 * @param {Object} background PDF background with pageWidth and pageHeight.
 * @param {number} bleed      Bleed in mm.
 * @return {{width: number, height: number}} Trim size.
 */
export function sizeFromPdf( background, bleed ) {
	return {
		width: round1( background.pageWidth - 2 * bleed ),
		height: round1( background.pageHeight - 2 * bleed ),
	};
}

/**
 * Trim height that keeps an image's proportions, given the trim width and
 * the bleed.
 *
 * @param {Object} background Image background with pixelWidth and pixelHeight.
 * @param {number} width      Trim width in mm.
 * @param {number} bleed      Bleed in mm.
 * @return {number} Trim height in mm.
 */
export function heightFromImage( background, width, bleed ) {
	const pageHeight =
		( ( width + 2 * bleed ) * background.pixelHeight ) /
		background.pixelWidth;
	return round1( pageHeight - 2 * bleed );
}
