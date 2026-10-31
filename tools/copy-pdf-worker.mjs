// Copies the PDF.js worker next to the build. It is loaded by URL, as a
// module worker, so it is not bundled. Saved with a .js extension so every
// server sends it with a JavaScript MIME type.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join( dirname( fileURLToPath( import.meta.url ) ), '..' );
const source = join( root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs' );
const target = join( root, 'build', 'pdf.worker.min.js' );

mkdirSync( join( root, 'build' ), { recursive: true } );
copyFileSync( source, target );
console.log( 'Copied the PDF.js worker to build/pdf.worker.min.js' );
