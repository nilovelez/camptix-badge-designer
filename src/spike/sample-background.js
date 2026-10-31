/**
 * Builds a vector PDF background (106 × 156 mm, trim plus 3 mm bleed) so
 * the spike can test embedding a PDF background without any real artwork.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const PT_PER_MM = 72 / 25.4;

export async function makeSampleBackground() {
	const doc = await PDFDocument.create();
	const width = 106 * PT_PER_MM;
	const height = 156 * PT_PER_MM;
	const page = doc.addPage( [ width, height ] );
	const font = await doc.embedFont( StandardFonts.HelveticaBold );

	// Light paper with a blue band at the top and a pale one at the bottom.
	page.drawRectangle( { x: 0, y: 0, width, height, color: rgb( 0.98, 0.97, 0.94 ) } );
	page.drawRectangle( { x: 0, y: height - 16 * PT_PER_MM, width, height: 16 * PT_PER_MM, color: rgb( 0.22, 0.35, 0.91 ) } );
	page.drawRectangle( { x: 0, y: 0, width, height: 46 * PT_PER_MM, color: rgb( 0.9, 0.93, 1 ) } );

	// Decorative vector circles: they must stay sharp at any zoom.
	const circles = [
		[ 12, 140, 9, rgb( 1, 0.76, 0.03 ) ],
		[ 96, 128, 14, rgb( 0.95, 0.38, 0.33 ) ],
		[ 8, 60, 6, rgb( 0.14, 0.73, 0.58 ) ],
		[ 100, 52, 8, rgb( 1, 0.76, 0.03 ) ],
	];
	for ( const [ x, y, r, color ] of circles ) {
		page.drawCircle( { x: x * PT_PER_MM, y: y * PT_PER_MM, size: r * PT_PER_MM, color, opacity: 0.8 } );
	}

	const title = 'WORDCAMP EXAMPLE 2027';
	const size = 11;
	const titleWidth = font.widthOfTextAtSize( title, size );
	page.drawText( title, {
		x: ( width - titleWidth ) / 2,
		y: height - 11 * PT_PER_MM,
		size,
		font,
		color: rgb( 1, 1, 1 ),
	} );

	return doc.save();
}
