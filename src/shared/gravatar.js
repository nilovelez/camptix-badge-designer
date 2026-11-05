/**
 * Gravatar URLs, shared by the editor and the PDF generator.
 *
 * Gravatar's own fallbacks (identicon, monster…) are asked from Gravatar
 * with `d`. "None" and the fixed image both ask with `d=404`: an attendee
 * without a Gravatar gets a 404, and the plugin draws nothing or its own
 * fixed image.
 *
 * On WordCamp.org an attendee may also have the Gravatar of their
 * WordPress.org account (accountGravatarHash), used only when the ticket
 * email has none: the ticket's is then asked with d=404, and the
 * element's fallback goes to the account's.
 */

const GENERATED = [ 'identicon', 'monsterid', 'wavatar', 'retro', 'robohash' ];

/**
 * @param {string} hash     SHA-256 of the attendee's email address.
 * @param {number} pixels   Size in pixels (Gravatar serves up to 2048).
 * @param {string} fallback Element fallback: '404', 'image' or a generated one.
 * @return {string} URL, or an empty string when there is no hash.
 */
export function gravatarUrl( hash, pixels, fallback ) {
	if ( ! hash ) {
		return '';
	}
	const d = GENERATED.includes( fallback ) ? fallback : '404';
	return (
		'https://gravatar.com/avatar/' +
		hash +
		'?s=' +
		Math.min( 2048, Math.max( 1, Math.round( pixels ) ) ) +
		'&d=' +
		d +
		'&r=g'
	);
}

/**
 * Gravatar URLs to try for an attendee, in order: the first one that loads
 * is used.
 *
 * @param {Object} attendee Attendee, with gravatarHash and, sometimes, accountGravatarHash.
 * @param {number} pixels   Size in pixels.
 * @param {string} fallback Element fallback: '404', 'image' or a generated one.
 * @return {string[]} URLs, maybe none.
 */
export function gravatarUrls( attendee, pixels, fallback ) {
	if ( ! attendee.accountGravatarHash ) {
		const url = gravatarUrl( attendee.gravatarHash, pixels, fallback );
		return url ? [ url ] : [];
	}
	const urls = [];
	if ( attendee.gravatarHash ) {
		urls.push( gravatarUrl( attendee.gravatarHash, pixels, '404' ) );
	}
	urls.push( gravatarUrl( attendee.accountGravatarHash, pixels, fallback ) );
	return urls;
}
