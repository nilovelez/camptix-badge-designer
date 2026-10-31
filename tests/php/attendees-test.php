<?php
/**
 * Tests for includes/attendees.php that run without WordPress:
 * php tests/php/attendees-test.php
 *
 * All names and data are invented.
 *
 * @package Camptix_Badge_Generator
 */

// phpcs:disable WordPress.WP.AlternativeFunctions, WordPress.Security.EscapeOutput, WordPress.NamingConventions.PrefixAllGlobals

define( 'ABSPATH', __DIR__ . '/' );
define( 'CTBG_PLUGIN_DIR', dirname( __DIR__, 2 ) . '/' );

// Minimal stand-ins for the WordPress functions the file uses.
function apply_filters( $hook, $value ) {
	return $value;
}
function add_action() {}
function __( $text ) {
	return $text;
}
function absint( $value ) {
	return abs( (int) $value );
}
function is_email( $email ) {
	return (bool) filter_var( $email, FILTER_VALIDATE_EMAIL );
}
function sanitize_title( $title ) {
	// Like WordPress's remove_accents(): decompose and drop the accent marks.
	$title = strtolower( preg_replace( '/\p{Mn}+/u', '', Normalizer::normalize( $title, Normalizer::FORM_D ) ) );
	return trim( preg_replace( '/[^a-z0-9]+/', '-', $title ), '-' );
}
class WP_Error {
	public $message;
	public function __construct( $code, $message ) {
		$this->message = $message;
	}
}
function is_wp_error( $thing ) {
	return $thing instanceof WP_Error;
}

require CTBG_PLUGIN_DIR . 'includes/attendees.php';

$failures = 0;
function check( $label, $actual, $expected ) {
	global $failures;
	if ( $actual === $expected ) {
		echo "ok   $label\n";
		return;
	}
	++$failures;
	echo "FAIL $label\n     expected: " . var_export( $expected, true ) . "\n     actual:   " . var_export( $actual, true ) . "\n";
}

// Names.
check( 'lowercase first name', ctbg_normalize_name( 'maría josé' ), 'María José' );
check( 'uppercase last name', ctbg_normalize_name( 'GARCÍA PÉREZ' ), 'García Pérez' );
check( 'mixed case is kept', ctbg_normalize_name( 'McDonald' ), 'McDonald' );
check( 'only the all-caps word changes', ctbg_normalize_name( 'maría José' ), 'María José' );
check( 'particles in lowercase', ctbg_normalize_name( 'DE LA FUENTE ORTIZ' ), 'de la Fuente Ortiz' );
check( 'particles typed with capitals are kept', ctbg_normalize_name( 'De la Fuente' ), 'De la Fuente' );
check( 'a lone particle-like name', ctbg_normalize_name( 'del' ), 'Del' );
check( 'hyphenated', ctbg_normalize_name( 'fernández-villaverde' ), 'Fernández-Villaverde' );
check( 'ñ and accents', ctbg_normalize_name( 'ÍÑIGO NÚÑEZ' ), 'Íñigo Núñez' );
check( 'extra spaces', ctbg_normalize_name( '  ana   ruiz ' ), 'Ana Ruiz' );
check( 'empty', ctbg_normalize_name( '' ), '' );

// Usernames.
check( 'valid username', ctbg_sanitize_wporg_username( 'janedoe42' ), 'janedoe42' );
check( 'username with dot and dash', ctbg_sanitize_wporg_username( ' jane.doe-x ' ), 'jane.doe-x' );
check( 'placeholder', ctbg_sanitize_wporg_username( 'Awaiting attendee ([[ unconfirmed ]])' ), '' );
check( 'empty username', ctbg_sanitize_wporg_username( '' ), '' );
check( 'URL is not a username', ctbg_sanitize_wporg_username( 'https://wordpress.org/@jane' ), '' );

// A whole export.
$csv    = array(
	'header'    => array( 'Attendee ID', 'Ticket Type', 'First Name', 'Last Name', 'E-mail Address', 'Status', 'Username', 'Severe allergy', 'First Time Attending', '¿Vendrás el domingo?' ),
	'rows'      => array(
		array( '12', 'General', 'luis', 'PEÑA', 'Luis@Example.com ', 'Publish', 'luispena', 'No', 'Yes', 'Sí' ),
		array( '3', 'General', 'Ana', 'Ruiz', 'ana@example.com', 'Publish', 'Awaiting attendee ([[ unconfirmed ]])', 'Yes (we will contact you)', 'No', 'No' ),
		array( '7', 'General', 'Eva', 'Vidal', 'not-an-email', 'Refund', 'eva', 'No', 'No', 'No' ),
	),
	'malformed' => 1,
);
$result = ctbg_parse_attendees( $csv );
check( 'sorted by Attendee ID', array_column( $result['attendees'], 'attendeeId' ), array( 3, 12 ) );
check( 'numbered from 1', array_column( $result['attendees'], 'number' ), array( 1, 2 ) );
check( 'only Publish tickets', $result['stats']['skippedByStatus'], array( 'Refund' => 1 ) );
check( 'normalized last name', $result['attendees'][1]['lastName'], 'Peña' );
check( 'Gravatar hash of trimmed lowercase email', $result['attendees'][1]['gravatarHash'], hash( 'sha256', 'luis@example.com' ) );
check( 'no email in the output', false !== strpos( json_encode( $result ), 'example.com' ), false );
check( 'placeholder username removed', $result['attendees'][0]['username'], '' );
check( 'questions: event ones and first time, never allergies', array_column( $result['questions'], 'label' ), array( 'First Time Attending', '¿Vendrás el domingo?' ) );
check( 'answers keyed by question', $result['attendees'][1]['answers'], array( 'first-time-attending' => 'Yes', 'vendras-el-domingo' => 'Sí' ) );
check( 'stats', array( $result['stats']['rows'], $result['stats']['malformed'], $result['stats']['withoutUsername'] ), array( 4, 1, 1 ) );

echo $failures ? "\n$failures failed\n" : "\nAll passed\n";
exit( $failures ? 1 : 0 );
