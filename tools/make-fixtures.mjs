// Builds the invented test backgrounds in tests/fixtures/:
// - background-106x156.pdf: vector PDF, 100 × 150 mm plus 3 mm bleed.
// - background-110x160.pdf: vector PDF of another size (5 mm bleed on 100 × 150).
// The PNG fixtures (300 dpi, low resolution, and a wide one of another shape)
// were rendered from background-106x156.pdf with PDF.js in a browser.
// Usage: node tools/make-fixtures.mjs
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const root = join( dirname( fileURLToPath( import.meta.url ) ), '..' );
const PT_PER_MM = 72 / 25.4;

async function makePdf( widthMm, heightMm, label ) {
	const doc = await PDFDocument.create();
	const width = widthMm * PT_PER_MM;
	const height = heightMm * PT_PER_MM;
	const page = doc.addPage( [ width, height ] );
	const font = await doc.embedFont( StandardFonts.HelveticaBold );

	page.drawRectangle( { x: 0, y: 0, width, height, color: rgb( 0.98, 0.97, 0.94 ) } );
	page.drawRectangle( { x: 0, y: height - 47 * PT_PER_MM, width, height: 47 * PT_PER_MM, color: rgb( 0.07, 0.23, 0.35 ) } );
	page.drawRectangle( { x: 0, y: 0, width, height: 15 * PT_PER_MM, color: rgb( 0.07, 0.23, 0.35 ) } );
	page.drawCircle( { x: width - 12 * PT_PER_MM, y: height - 8 * PT_PER_MM, size: 30 * PT_PER_MM, color: rgb( 0.95, 0.55, 0.16 ) } );
	page.drawCircle( { x: 2 * PT_PER_MM, y: height - 58 * PT_PER_MM, size: 19 * PT_PER_MM, color: rgb( 0.23, 0.65, 0.63 ) } );
	page.drawText( 'WordCamp', { x: 12 * PT_PER_MM, y: height - 17 * PT_PER_MM, size: 17, font, color: rgb( 1, 1, 1 ) } );
	page.drawText( 'Example 2027', { x: 12 * PT_PER_MM, y: height - 24 * PT_PER_MM, size: 17, font, color: rgb( 1, 1, 1 ) } );
	page.drawText( label, { x: 12 * PT_PER_MM, y: 6 * PT_PER_MM, size: 8, font, color: rgb( 1, 1, 1 ) } );
	return doc.save();
}

writeFileSync( join( root, 'tests/fixtures/background-106x156.pdf' ), await makePdf( 106, 156, 'Test background: PDF, 106 × 156 mm' ) );
writeFileSync( join( root, 'tests/fixtures/background-110x160.pdf' ), await makePdf( 110, 160, 'Test background: PDF, 110 × 160 mm' ) );
console.log( 'PDF fixtures written.' );
