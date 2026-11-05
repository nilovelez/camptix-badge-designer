/**
 * QR codes for the WordPress.org profile, shared by the editor and the PDF
 * generator.
 */
import { encode } from '../vendor/ladyqr/qr.js';

// Light modules around the code, as a share of the element. Two modules
// are enough on a badge printed in black on white.
export const QR_QUIET_ZONE = 2;

/**
 * The WordPress.org profile URL of an attendee. The server sends the right
 * one (profileUrl); the login is the fallback, for the sample attendee.
 *
 * @param {Object} attendee Attendee.
 * @return {string} Profile URL, or '' without a username.
 */
export function profileUrl( attendee ) {
	if ( attendee.profileUrl ) {
		return attendee.profileUrl;
	}
	if ( ! attendee.username ) {
		return '';
	}
	return (
		'https://profiles.wordpress.org/' +
		encodeURIComponent( attendee.username ) +
		'/'
	);
}

/**
 * The QR code of a profile as one SVG path in module units, including the
 * quiet zone, so it is filled in a single operation with no hairlines
 * between modules.
 *
 * @param {string} url Profile URL.
 * @return {{size: number, path: string}} Total size in modules and path data.
 */
export function profileQr( url ) {
	const { modules } = encode( url, 'M' );
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
