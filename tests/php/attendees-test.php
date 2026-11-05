<?php
/**
 * Tests for includes/attendees.php that run without WordPress:
 * php tests/php/attendees-test.php
 *
 * All names and data are invented.
 *
 * @package CampTix_Badge_Designer
 */

// phpcs:disable WordPress.WP.AlternativeFunctions, WordPress.Security.EscapeOutput, WordPress.NamingConventions.PrefixAllGlobals

define( 'ABSPATH', __DIR__ . '/' );
define( 'CTBD_PLUGIN_DIR', dirname( __DIR__, 2 ) . '/' );

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

require CTBD_PLUGIN_DIR . 'includes/camptix.php';
require CTBD_PLUGIN_DIR . 'includes/attendees.php';

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
check( 'lowercase first name', ctbd_normalize_name( 'maría josé' ), 'María José' );
check( 'uppercase last name', ctbd_normalize_name( 'GARCÍA PÉREZ' ), 'García Pérez' );
check( 'mixed case is kept', ctbd_normalize_name( 'McDonald' ), 'McDonald' );
check( 'only the all-caps word changes', ctbd_normalize_name( 'maría José' ), 'María José' );
check( 'particles in lowercase', ctbd_normalize_name( 'DE LA FUENTE ORTIZ' ), 'de la Fuente Ortiz' );
check( 'particles typed with capitals are kept', ctbd_normalize_name( 'De la Fuente' ), 'De la Fuente' );
check( 'a lone particle-like name', ctbd_normalize_name( 'del' ), 'Del' );
check( 'hyphenated', ctbd_normalize_name( 'fernández-villaverde' ), 'Fernández-Villaverde' );
check( 'ñ and accents', ctbd_normalize_name( 'ÍÑIGO NÚÑEZ' ), 'Íñigo Núñez' );
check( 'extra spaces', ctbd_normalize_name( '  ana   ruiz ' ), 'Ana Ruiz' );
check( 'empty', ctbd_normalize_name( '' ), '' );
check( 'apostrophe', ctbd_normalize_name( "O'BRIEN" ), "O'Brien" );
check( 'typographic apostrophe', ctbd_normalize_name( 'd’angelo' ), 'D’Angelo' );
check( 'Mc', ctbd_normalize_name( 'MCDONALD' ), 'McDonald' );
check( 'Mac is left alone', ctbd_normalize_name( 'MACÍAS' ), 'Macías' );
check( 'particles with no name after them', ctbd_normalize_name( 'LE VAN' ), 'Le Van' );
check( 'particle before a name', ctbd_normalize_name( 'VAN DER BERG' ), 'van der Berg' );
check( 'particle at the end', ctbd_normalize_name( 'JUAN DE' ), 'Juan De' );
check( 'apostrophe after a particle', ctbd_normalize_name( "jeanne d'arc" ), "Jeanne D'Arc" );

// Usernames.
check( 'valid username', ctbd_sanitize_wporg_username( 'janedoe42' ), 'janedoe42' );
check( 'username with dot and dash', ctbd_sanitize_wporg_username( ' jane.doe-x ' ), 'jane.doe-x' );
check( 'placeholder', ctbd_sanitize_wporg_username( 'Awaiting attendee ([[ unconfirmed ]])' ), '' );
check( 'empty username', ctbd_sanitize_wporg_username( '' ), '' );
check( 'URL is not a username', ctbd_sanitize_wporg_username( 'https://wordpress.org/@jane' ), '' );

// A whole export.
$csv    = array(
	'header'    => array( 'Attendee ID', 'Ticket Type', 'First Name', 'Last Name', 'E-mail Address', 'Status', 'Username', 'Severe allergy', 'First Time Attending', '¿Vendrás el domingo?' ),
	'rows'      => array(
		array( '12', 'General', 'luis', 'PEÑA', 'Luis@Example.com ', 'Publish', 'luispena', 'No', 'Yes', 'Sí' ),
		array( '3', 'General', 'Ana', 'Ruiz', 'ana@example.com', 'Publish', 'Awaiting attendee ([[ unconfirmed ]])', 'Yes (we will contact you)', 'No', 'No' ),
		array( '7', 'General', 'Eva', 'Vidal', 'not-an-email', 'Refund', 'eva', 'No', 'No', 'No' ),
		array( '15', 'General', 'Unknown', 'Attendee', 'unknown.attendee@example.org', 'Publish', 'Awaiting attendee ([[ unconfirmed ]])', '', '', '' ),
	),
	'malformed' => 1,
);
$result = ctbd_parse_attendees( $csv );
check( 'sorted by Attendee ID', array_column( $result['attendees'], 'attendeeId' ), array( 3, 12 ) );
check( 'numbered from 1', array_column( $result['attendees'], 'number' ), array( 1, 2 ) );
check( 'only Publish tickets', $result['stats']['skippedByStatus'], array( 'Refund' => 1 ) );
check( 'normalized last name', $result['attendees'][1]['lastName'], 'Peña' );
check( 'Gravatar hash of trimmed lowercase email', $result['attendees'][1]['gravatarHash'], hash( 'sha256', 'luis@example.com' ) );
check( 'no email in the output', false !== strpos( json_encode( $result ), 'example.com' ), false );
check( 'placeholder username removed', $result['attendees'][0]['username'], '' );
check( 'questions: event ones and first time, never allergies', array_column( $result['questions'], 'label' ), array( 'First Time Attending', '¿Vendrás el domingo?' ) );
check( 'answers keyed by question', $result['attendees'][1]['answers'], array( 'first-time-attending' => 'Yes', 'vendras-el-domingo' => 'Sí' ) );
check( 'stats', array( $result['stats']['rows'], $result['stats']['malformed'], $result['stats']['withoutUsername'] ), array( 5, 1, 1 ) );
check( 'unknown attendee placeholder left out', $result['stats']['placeholders'], 1 );
check( 'no flags from a CSV', array( $result['flags'], $result['attendees'][1]['flags'] ), array( array(), array() ) );

// Live from CampTix: only the event's questions become variables, and the
// admin flags are read from their columns.
$live   = array(
	'header'           => array( 'Attendee ID', 'Ticket Type', 'First Name', 'Last Name', 'E-mail Address', 'Status', 'Country', 'Phone Number', 'Volunteer', 'Username', 'First Time Attending' ),
	'rows'             => array(
		array( '4', 'General', 'Eva', 'Vidal', 'eva@example.com', 'Publish', 'Spain', '+34 600 000 000', 'Yes', 'eva', 'No' ),
		array( '5', 'General', 'Jon', 'Sanz', 'jon@example.com', 'Publish', 'Italy', '', 'No', 'jon', 'Yes' ),
	),
	'malformed'        => 0,
	'question_columns' => array( 'Country' ),
	'flag_columns'     => array( 'volunteer' => 'Volunteer' ),
);
$result = ctbd_parse_attendees( $live );
check( 'live: only questions and allowed columns', array_column( $result['questions'], 'label' ), array( 'Country', 'First Time Attending' ) );
check( 'live: flags listed', $result['flags'], array( array( 'key' => 'volunteer', 'label' => 'Volunteer' ) ) );
check( 'live: attendee flags', array_column( $result['attendees'], 'flags' ), array( array( 'volunteer' ), array() ) );

// Names as typed, sent only when fixing them changed them.
$typed = ctbd_parse_attendees(
	array(
		'header'    => array( 'Attendee ID', 'First Name', 'Last Name', 'Status' ),
		'rows'      => array(
			array( '1', 'bell', 'hooks', 'Publish' ),
			array( '2', 'Ana', 'DI  MARIA', 'Publish' ),
			array( '3', 'Eva', 'Vidal', 'Publish' ),
		),
		'malformed' => 0,
	)
)['attendees'];
check( 'names as typed: both', array( $typed[0]['firstName'], $typed[0]['firstNameAsTyped'], $typed[0]['lastNameAsTyped'] ), array( 'Bell', 'bell', 'hooks' ) );
check( 'names as typed: spaces collapsed, first name unchanged', array( isset( $typed[1]['firstNameAsTyped'] ), $typed[1]['lastNameAsTyped'] ), array( false, 'DI MARIA' ) );
check( 'names as typed: none when unchanged', isset( $typed[2]['firstNameAsTyped'] ) || isset( $typed[2]['lastNameAsTyped'] ), false );

// Activity ticket seats left out by ctbd_read_camptix() are counted.
check( 'activity seats counted', ctbd_parse_attendees( array_merge( $live, array( 'companions' => 2 ) ) )['stats']['activitySeats'], 2 );

// Profile URLs for the QR code, without WordCamp.org.
check( 'profile URL from the login', $result['attendees'][0]['profileUrl'], 'https://profiles.wordpress.org/eva/' );
check( 'profile URL from the export column', ctbd_profile_url( 'https://wordpress.org/@jane-doe', false, 'jane.doe' ), 'https://wordpress.org/@jane-doe' );
check( 'profile URL column that is not a profile', ctbd_profile_url( 'https://example.com/@jane', false, 'jane' ), 'https://profiles.wordpress.org/jane/' );
check( 'no profile URL without a username', ctbd_profile_url( '', false, '' ), '' );
check( 'no account without WordCamp.org', ctbd_wporg_account( 'eva' ), false );

// On WordCamp.org: wcorg_get_user_by_canonical_names() finds the account.
// Declared here, inside a block, so the tests above run without it.
class WP_User {
	public $user_email;
	public $user_nicename;
	public function __construct( $email, $nicename ) {
		$this->user_email    = $email;
		$this->user_nicename = $nicename;
	}
}
if ( true ) {
	function wcorg_get_user_by_canonical_names( $name ) {
		$users = array(
			'jane.doe' => new WP_User( 'Jane@Example.net', 'jane-doe' ),
			'eva'      => new WP_User( 'eva@example.com', 'eva' ),
		);
		return isset( $users[ $name ] ) ? $users[ $name ] : false;
	}
}
$wcorg = ctbd_parse_attendees(
	array(
		'header'    => array( 'Attendee ID', 'First Name', 'Last Name', 'E-mail Address', 'Status', 'Username' ),
		'rows'      => array(
			array( '1', 'Jane', 'Doe', 'jane@example.com', 'Publish', 'jane.doe' ),
			array( '2', 'Eva', 'Vidal', 'eva@example.com', 'Publish', 'eva' ),
			array( '3', 'Jon', 'Sanz', 'jon@example.com', 'Publish', 'jon' ),
		),
		'malformed' => 0,
	)
)['attendees'];
check( 'wcorg: account Gravatar hash', $wcorg[0]['accountGravatarHash'], hash( 'sha256', 'jane@example.net' ) );
check( 'wcorg: profile URL from the nicename', $wcorg[0]['profileUrl'], 'https://wordpress.org/@jane-doe' );
check( 'wcorg: no account hash when it is the ticket email', isset( $wcorg[1]['accountGravatarHash'] ), false );
check( 'wcorg: unknown account falls back to the login', array( isset( $wcorg[2]['accountGravatarHash'] ), $wcorg[2]['profileUrl'] ), array( false, 'https://profiles.wordpress.org/jon/' ) );
check( 'wcorg: no email in the output', false !== strpos( json_encode( $wcorg ), 'example' ), false );

echo $failures ? "\n$failures failed\n" : "\nAll passed\n";
exit( $failures ? 1 : 0 );
