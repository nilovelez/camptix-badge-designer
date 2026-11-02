/**
 * Loads font files for the editor: fontkit reads them to measure text
 * exactly as the PDF will, and the browser gets the same file to draw it.
 * Each face is loaded once.
 */
import { useEffect, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import fontkit from '@pdf-lib/fontkit';

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
 * Loads the faces the text elements use.
 *
 * @param {Array} elements Design elements.
 * @return {Object} Loaded faces by key ({font, css}); missing until loaded.
 */
export function useFonts( elements ) {
	const [ loaded, setLoaded ] = useState( {} );
	const needed = [];
	for ( const element of elements || [] ) {
		if ( element.type === 'text' ) {
			const face = resolveFace( element.font, element.weight );
			if (
				face &&
				! needed.some( ( f ) => faceKey( f ) === faceKey( face ) )
			) {
				needed.push( face );
			}
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
