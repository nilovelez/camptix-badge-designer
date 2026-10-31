/**
 * PDF.js, to read the page size of a PDF background and draw it on the
 * canvas. Each PDF is loaded once.
 */
import * as pdfjs from 'pdfjs-dist';
import { round1 } from './geometry';

pdfjs.GlobalWorkerOptions.workerSrc = window.ctbdSettings.pdfWorkerUrl;

const documents = new Map();

/**
 * @param {string} url PDF URL.
 * @return {Promise<Object>} PDF.js document.
 */
export function loadPdf( url ) {
	if ( ! documents.has( url ) ) {
		const promise = pdfjs.getDocument( { url } ).promise;
		// Do not keep a failed load: a retry should try again.
		promise.catch( () => documents.delete( url ) );
		documents.set( url, promise );
	}
	return documents.get( url );
}

/**
 * Size of the first page, in millimeters.
 *
 * @param {string} url PDF URL.
 * @return {Promise<{pageWidth: number, pageHeight: number}>} Page size.
 */
export async function readPdfPageSize( url ) {
	const pdf = await loadPdf( url );
	const page = await pdf.getPage( 1 );
	const viewport = page.getViewport( { scale: 1 } );
	return {
		pageWidth: round1( ( viewport.width * 25.4 ) / 72 ),
		pageHeight: round1( ( viewport.height * 25.4 ) / 72 ),
	};
}
