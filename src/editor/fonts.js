/**
 * Loads font files for the editor: fontkit reads them to measure text
 * exactly as the PDF will, and the browser gets the same file to draw it.
 * Each face is loaded once.
 */
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import fontkit from '@pdf-lib/fontkit';
import { layoutWithFallbacks } from '../shared/text-layout';
import { scriptById, scriptsOf } from '../shared/scripts';

const families = window.ctbdSettings.fontFamilies || [];
const faces = new Map();

export function fontFamilies() {
	return families;
}

/**
 * Weights a family has, as strings.
 *
 * @param {string} family Family name.
 * @return {string[]} Weights.
 */
export function familyWeights( family ) {
	const found =
		families.find( ( f ) => f.family === family ) || families[ 0 ];
	return found ? found.faces.map( ( face ) => face.weight ) : [];
}

/**
 * The face used for a family and weight: the exact weight, or the closest
 * one the family has. Unknown families fall back to Inter.
 *
 * @param {string} family Family name.
 * @param {string} weight Weight.
 * @return {{family: string, weight: string, url: string}|null} Face.
 */
export function resolveFace( family, weight ) {
	const found =
		families.find( ( f ) => f.family === family ) || families[ 0 ];
	if ( ! found || ! found.faces.length ) {
		return null;
	}
	let best = found.faces[ 0 ];
	for ( const face of found.faces ) {
		if (
			Math.abs( face.weight - weight ) < Math.abs( best.weight - weight )
		) {
			best = face;
		}
	}
	return { family: found.family, weight: best.weight, url: best.url };
}

export function faceKey( face ) {
	return face.family + '|' + face.weight;
}

// The font shipped with the plugin: the first fallback, for Latin, Greek
// and Cyrillic letters a box's font lacks.
const FALLBACK_FAMILY = 'Inter';

/**
 * The face of an installed family at the closest weight, or null when the
 * family is not installed (no fallback to Inter, unlike resolveFace()).
 *
 * @param {string} family Family name.
 * @param {string} weight Weight.
 * @return {Object|null} Face.
 */
function installedFace( family, weight ) {
	if ( ! families.some( ( f ) => f.family === family ) ) {
		return null;
	}
	return resolveFace( family, weight );
}

/**
 * Whether a font family is installed: shipped, or in the Font Library.
 *
 * @param {string} family Family name.
 * @return {boolean} Installed.
 */
export function isInstalled( family ) {
	return families.some( ( f ) => f.family === family );
}

/**
 * The faces a text box always needs: its own, and Inter at the closest
 * weight when its own is another family.
 *
 * @param {Object} element Text element.
 * @return {{primary: Object|null, fallback: Object|null}} Faces.
 */
export function textFaces( element ) {
	const primary = resolveFace( element.font, element.weight );
	let fallback = resolveFace( FALLBACK_FAMILY, element.weight );
	if ( ! primary || ! fallback || primary.family === fallback.family ) {
		fallback = null;
	}
	return { primary, fallback };
}

/**
 * Lays out a text box for one attendee with the faces loaded so far. The
 * text uses the first font that has all its characters, in a fixed order
 * (decided by Nilo, milestone 13): the box's font, then Inter, then the Noto
 * font of each script it still lacks when that font is installed in the
 * Font Library, active or not. See layoutWithFallbacks().
 *
 * @param {Object} element  Text element.
 * @param {Object} attendee Attendee.
 * @param {Object} loaded   Loaded faces by key ({font, ...}).
 * @return {Object|null} Layout, null until the box's own face has loaded,
 *   plus: faceKey, the face it uses; fallbackFamily, the fallback family it
 *   uses, or null; scripts, the scripts of the characters the box's font
 *   lacks; wanted, installed fallback faces not loaded yet.
 */
export function layoutTextBox( element, attendee, loaded ) {
	const { primary, fallback } = textFaces( element );
	const own = primary && loaded[ faceKey( primary ) ];
	if ( ! own ) {
		return null;
	}
	const chain = [ { face: primary, font: own.font } ];
	const inter = fallback && loaded[ faceKey( fallback ) ];
	if ( inter ) {
		chain.push( { face: fallback, font: inter.font } );
	}

	let layout = layoutWithFallbacks(
		chain.map( ( link ) => link.font ),
		element,
		attendee
	);
	const lacking = layout.missing;
	const wanted = [];
	const tried = chain.length;
	if ( lacking.length ) {
		// The Noto fonts of the scripts Inter lacks too, when installed.
		const hard = inter
			? lacking.filter(
					( char ) =>
						! inter.font.hasGlyphForCodePoint(
							char.codePointAt( 0 )
						)
				)
			: lacking;
		for ( const id of scriptsOf( hard.length ? hard : lacking ) ) {
			for ( const family of scriptById( id ).fallbacks ) {
				const face = installedFace( family, element.weight );
				if (
					! face ||
					chain.some( ( link ) => link.face.family === family )
				) {
					continue;
				}
				const found = loaded[ faceKey( face ) ];
				if ( found ) {
					chain.push( { face, font: found.font } );
				} else {
					wanted.push( face );
				}
			}
		}
		if ( chain.length > tried ) {
			layout = layoutWithFallbacks(
				chain.map( ( link ) => link.font ),
				element,
				attendee
			);
		}
	}

	const used = chain[ layout.fontIndex ];
	return {
		...layout,
		faceKey: faceKey( used.face ),
		fallbackFamily: layout.fontIndex > 0 ? used.face.family : null,
		scripts: lacking.length ? scriptsOf( lacking ) : [],
		wanted,
	};
}
async function toTtf( bytes ) {
	const isWoff2 =
		bytes[ 0 ] === 0x77 &&
		bytes[ 1 ] === 0x4f &&
		bytes[ 2 ] === 0x46 &&
		bytes[ 3 ] === 0x32;
	if ( ! isWoff2 ) {
		return bytes;
	}
	// @pdf-lib/fontkit cannot subset WOFF2, so the PDF will need TTF; measuring
	// the same TTF here keeps both identical. See docs/decisions.md.
	const { default: decompress } = await import(
		/* webpackChunkName: "woff2" */ 'woff2-encoder/decompress'
	);
	return decompress( bytes );
}

/**
 * Loads a face: fontkit font, a CSS family registered with the browser,
 * and the TTF bytes the PDF embeds.
 *
 * @param {Object} face From resolveFace().
 * @return {Promise<{font: Object, css: string, bytes: Uint8Array}>} Loaded face.
 */
export function loadFace( face ) {
	const key = faceKey( face );
	if ( ! faces.has( key ) ) {
		const promise = ( async () => {
			const response = await fetch( face.url );
			if ( ! response.ok ) {
				throw new Error(
					sprintf(
						/* translators: %s: URL of the font file. */
						__( 'Font not found: %s', 'camptix-badge-designer' ),
						face.url
					)
				);
			}
			const bytes = await toTtf(
				new Uint8Array( await response.arrayBuffer() )
			);
			const font = fontkit.create( bytes );
			// One CSS family per face, so the browser never synthesizes a weight.
			const css = 'ctbd-' + key.replace( /[^A-Za-z0-9]+/g, '-' );
			// A copy, so the bytes kept for the PDF are never detached.
			const fontFace = new window.FontFace( css, bytes.slice() );
			await fontFace.load();
			document.fonts.add( fontFace );
			return { font, css, bytes };
		} )();
		promise.catch( () => faces.delete( key ) );
		faces.set( key, promise );
	}
	return faces.get( key );
}

/**
 * The faces the text elements may use, their fallbacks included, each once.
 *
 * @param {Array} elements Design elements.
 * @return {Object[]} Faces.
 */
export function neededFaces( elements ) {
	const needed = [];
	for ( const element of elements || [] ) {
		if ( element.type !== 'text' ) {
			continue;
		}
		const { primary, fallback } = textFaces( element );
		for ( const face of [ primary, fallback ] ) {
			if (
				face &&
				! needed.some( ( f ) => faceKey( f ) === faceKey( face ) )
			) {
				needed.push( face );
			}
		}
	}
	return needed;
}

/**
 * Loads the faces the text elements use, Inter as their fallback, and the
 * fallback faces some attendee turned out to need (loaded only then).
 *
 * @param {Array}    elements Design elements.
 * @param {Object[]} extra    More faces to load: Noto fallbacks.
 * @return {Object} Loaded faces by key ({font, css}); missing until loaded.
 */
export function useFonts( elements, extra = [] ) {
	const [ loaded, setLoaded ] = useState( {} );
	const needed = neededFaces( elements );
	for ( const face of extra ) {
		if ( ! needed.some( ( f ) => faceKey( f ) === faceKey( face ) ) ) {
			needed.push( face );
		}
	}
	const neededKeys = needed.map( faceKey ).sort().join( ',' );

	useEffect( () => {
		let cancelled = false;
		for ( const face of needed ) {
			const key = faceKey( face );
			if ( loaded[ key ] ) {
				continue;
			}
			loadFace( face )
				.then( ( result ) => {
					if ( ! cancelled ) {
						setLoaded( ( current ) => ( {
							...current,
							[ key ]: result,
						} ) );
					}
				} )
				.catch( () => {} );
		}
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ neededKeys ] );

	return loaded;
}
