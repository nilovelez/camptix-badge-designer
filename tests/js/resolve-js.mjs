/**
 * Node resolve hook for the tests: the editor sources import local files
 * without the .js extension, as webpack allows, so add it.
 */
export async function resolve( specifier, context, next ) {
	if ( specifier.startsWith( '.' ) && ! /\.[cm]?js$/.test( specifier ) ) {
		try {
			return await next( specifier + '.js', context );
		} catch ( error ) {
			// Not a file without its extension: resolve it as written.
		}
	}
	return next( specifier, context );
}
