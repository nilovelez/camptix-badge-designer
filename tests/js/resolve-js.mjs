/**
 * Node resolve hook for the tests: the editor sources import local files
 * without the .js extension, as webpack allows, so add it.
 *
 * @param {string}   specifier What is imported.
 * @param {Object}   context   Resolve context.
 * @param {Function} next      The next resolve hook.
 * @return {Promise<Object>} Resolved module.
 */
export async function resolve( specifier, context, next ) {
	if ( specifier.startsWith( '.' ) && ! /\.[cm]?js$/.test( specifier ) ) {
		try {
			return await next( specifier + '.js', context );
		} catch {
			// Not a file without its extension: resolve it as written.
		}
	}
	return next( specifier, context );
}
