/**
 * Links to the Font Library screen, where the fonts the badges need are
 * installed (milestone 13). Without it (the user cannot manage fonts, or the
 * site turns the Font Library off), the text stays plain.
 */
import { createInterpolateElement } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { ExternalLink } from '@wordpress/components';
import { fontLibraryUrl } from '../fonts';

/**
 * A font name, linked to the Font Library screen when there is one.
 *
 * @param {Object} props      Props.
 * @param {string} props.name Font name.
 * @return {Element|string} Link or text.
 */
export function FontLink( { name } ) {
	const url = fontLibraryUrl();
	return url ? <ExternalLink href={ url }>{ name }</ExternalLink> : name;
}

/**
 * How to install a missing font, with a link to the Font Library screen and
 * the reminder to reload the editor, which only reads the fonts on load.
 *
 * @return {Element|string} Text.
 */
export function InstallFontsHelp() {
	const url = fontLibraryUrl();
	if ( ! url ) {
		return __(
			'Install a font that has them from Appearance › Fonts, to be used as a fallback for those attendees. It can stay inactive on the site.',
			'camptix-badge-designer'
		);
	}
	return createInterpolateElement(
		__(
			'Install a font that has them from <a>Appearance › Fonts</a>, to be used as a fallback for those attendees. It can stay inactive on the site. Reload this page after installing it.',
			'camptix-badge-designer'
		),
		{ a: <ExternalLink href={ url } /> }
	);
}
