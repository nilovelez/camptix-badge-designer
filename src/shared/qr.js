/**
 * QR codes for the WordPress.org profile, shared by the editor and the PDF
 * generator.
 */
import { encode } from '../vendor/ladyqr/qr.js';

// Light modules around the code, as a share of the element. Two modules
// are enough on a badge printed in black on white.
export const QR_QUIET_ZONE = 2;

/**
 * @param {string} username WordPress.org username.
 * @return {string} Profile URL.
 */
export function profileUrl( username ) {
	return (
		'https://profiles.wordpress.org/' + encodeURIComponent( username ) + '/'
	);
}

/**
 * The QR code of a profile as one SVG path in module units, including the
 * quiet zone, so it is filled in a single operation with no hairlines
 * between modules.
 *
 * @param {string} username WordPress.org username.
 * @return {{size: number, path: string}} Total size in modules and path data.
 */
export function profileQr( username ) {
	const { modules } = encode( profileUrl( username ), 'M' );
	let path = '';
	for ( let y = 0; y < modules.length; y++ ) {
		let x = 0;
		while ( x < modules.length ) {
			if ( ! modules[ y ][ x ] ) {
				x++;
				continue;
			}
			let run = 1;
			while ( x + run < modules.length && modules[ y ][ x + run ] ) {
				run++;
			}
			path +=
				'M' +
				( x + QR_QUIET_ZONE ) +
				' ' +
				( y + QR_QUIET_ZONE ) +
				'h' +
				run +
				'v1h-' +
				run +
				'z';
			x += run;
		}
	}
	return { size: modules.length + 2 * QR_QUIET_ZONE, path };
}
