/**
 * Invented attendees for the spike. No real data: the names are made up to
 * cover the hard cases seen in real exports (accents, ñ, compound names,
 * long last names, missing usernames).
 */

const FIRST_NAMES = [
	'María José', 'Álvaro', 'Begoña', 'Íñigo', 'Lucía', 'Jesús', 'Zoë', 'Óscar', 'Ana',
	'Juan Carlos', 'Noemí', 'Raúl', 'Inés', 'José Ángel', 'Ainhoa', 'Martín', 'Sofía', 'Joan',
	'Maximiliano', 'Pilar', 'Ömer', 'Chloé', 'Nuño', 'Eva',
];

const LAST_NAMES = [
	'Fernández-Villaverde', 'Muñoz', 'de la Fuente Ortiz', 'García Pérez', 'Iñiguez', 'Sánchez',
	'Castañeda Villalobos', 'Ruiz', 'Peña', 'del Río Bañuelos', 'Domínguez', 'Ølstad',
	'Rodríguez de Castro y Montes', 'López', 'Núñez', 'Aguirre', 'Echeverría Zubizarreta', 'Vidal',
];

function toUsername( first, last ) {
	return ( first.split( ' ' )[ 0 ] + last.split( ' ' )[ 0 ] )
		.normalize( 'NFD' )
		.replace( /[̀-ͯ]/g, '' )
		.replace( /[^A-Za-z0-9]/g, '' )
		.toLowerCase();
}

/**
 * @param {number} count Number of attendees.
 * @return {Array<{id: number, firstName: string, lastName: string, email: string, username: string}>} Attendees in purchase order.
 */
export function makeAttendees( count ) {
	const attendees = [];
	for ( let i = 0; i < count; i++ ) {
		const firstName = FIRST_NAMES[ i % FIRST_NAMES.length ];
		const lastName = LAST_NAMES[ ( i * 7 ) % LAST_NAMES.length ];
		const base = toUsername( firstName, lastName ) + ( i + 1 );
		// About four in ten tickets have no username, as in real exports.
		const hasUsername = i % 5 !== 1 && i % 5 !== 3;
		attendees.push( {
			id: 1000 + i,
			firstName,
			lastName,
			email: base + '@example.com',
			username: hasUsername ? base : '',
		} );
	}
	return attendees;
}
