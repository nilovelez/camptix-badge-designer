<?php
/**
 * Attendee data.
 *
 * The attendees come from CampTix when it is active (includes/camptix.php),
 * and otherwise, on test sites, from a CampTix CSV export in test-data/.
 * Only the fields a badge may show leave this file: email addresses are
 * turned into Gravatar hashes here and never reach the browser.
 *
 * @package CampTix_Badge_Designer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Columns CampTix always exports, plus the questions every WordCamp site
 * asks in English. Every other column is a question defined by the event.
 *
 * @return string[] Column headers.
 */
function ctbd_camptix_standard_columns() {
	return array(
		'Attendee ID',
		'Ticket Type',
		'First Name',
		'Last Name',
		'E-mail Address',
		'Purchase date',
		'Last Modified date',
		'Status',
		'Transaction ID',
		'Coupon',
		'Ticket Buyer Name',
		'Ticket Buyer E-mail Address',
		'Payment Method',
		'WordPress.org Profile URL',
		'Username',
		'Attended the event',
		'Severe allergy',
		'Accessibility needs',
		'First Time Attending',
	);
}

/**
 * Standard questions that may be shown on a badge as variables.
 *
 * @return string[] Column headers.
 */
function ctbd_allowed_standard_questions() {
	return array( 'First Time Attending' );
}

/**
 * Event questions that must never be offered as variables, because their
 * answers are sensitive. Event questions have free names, so sites can add
 * theirs with the `ctbd_excluded_questions` filter.
 *
 * @return string[] Column headers.
 */
function ctbd_excluded_questions() {
	return apply_filters( 'ctbd_excluded_questions', array() );
}

/**
 * Path of the test CSV: the newest .csv file in test-data/.
 *
 * @return string Path, or an empty string if there is none.
 */
function ctbd_get_test_csv_path() {
	$path  = '';
	$files = glob( CTBD_PLUGIN_DIR . 'test-data/*.csv' );

	if ( ! empty( $files ) ) {
		usort(
			$files,
			function ( $a, $b ) {
				return filemtime( $b ) - filemtime( $a );
			}
		);
		$path = $files[0];
	}

	return apply_filters( 'ctbd_test_csv_path', $path );
}

/**
 * Reads a CSV file into a header and rows of the same length.
 *
 * @param string $path File path.
 * @return array|WP_Error {header: string[], rows: string[][], malformed: int}.
 */
function ctbd_read_csv( $path ) {
	if ( '' === $path || ! is_readable( $path ) ) {
		return new WP_Error( 'ctbd_no_csv', __( 'No CSV file found in test-data/.', 'camptix-badge-designer' ) );
	}

	$file = new SplFileObject( $path, 'r' );
	$file->setFlags( SplFileObject::READ_CSV | SplFileObject::SKIP_EMPTY | SplFileObject::READ_AHEAD );
	$file->setCsvControl( ',', '"', '' );

	$header    = null;
	$rows      = array();
	$malformed = 0;

	foreach ( $file as $row ) {
		if ( ! is_array( $row ) || array( null ) === $row ) {
			continue;
		}

		if ( null === $header ) {
			// Drop a UTF-8 byte order mark from the first header.
			$row[0] = preg_replace( '/^\xEF\xBB\xBF/', '', $row[0] );
			$header = array_map( 'trim', $row );
			continue;
		}

		if ( count( $row ) !== count( $header ) ) {
			++$malformed;
			continue;
		}

		$rows[] = $row;
	}

	if ( null === $header ) {
		return new WP_Error( 'ctbd_empty_csv', __( 'The CSV file is empty.', 'camptix-badge-designer' ) );
	}

	return array(
		'header'    => $header,
		'rows'      => $rows,
		'malformed' => $malformed,
	);
}

/**
 * Words kept in lowercase inside a name, such as "de" in "de la Fuente".
 *
 * @return string[] Particles.
 */
function ctbd_name_particles() {
	return array( 'de', 'del', 'la', 'las', 'los', 'y', 'i', 'e', 'da', 'das', 'do', 'dos', 'di', 'du', 'van', 'von', 'der', 'den', 'le' );
}

/**
 * Capitalizes one word of a name, given in lowercase.
 *
 * Every part after a hyphen or an apostrophe starts with a capital
 * ("Fernández-Villaverde", "O'Brien", "D'Angelo"), and so does the letter
 * after "Mc" ("McDonald"). "Mac" is left alone: Macías or Mackay are not
 * Mac-names.
 *
 * @param string $word Word in lowercase.
 * @return string Capitalized word.
 */
function ctbd_capitalize_name_word( $word ) {
	$parts = preg_split( "/([-'’])/u", $word, -1, PREG_SPLIT_DELIM_CAPTURE );
	foreach ( $parts as $index => $part ) {
		if ( '' === $part || in_array( $part, array( '-', "'", '’' ), true ) ) {
			continue;
		}
		$part = mb_strtoupper( mb_substr( $part, 0, 1, 'UTF-8' ), 'UTF-8' ) . mb_substr( $part, 1, null, 'UTF-8' );
		if ( preg_match( '/^Mc(\p{Ll})(.+)$/u', $part, $match ) ) {
			$part = 'Mc' . mb_strtoupper( $match[1], 'UTF-8' ) . $match[2];
		}
		$parts[ $index ] = $part;
	}
	return implode( '', $parts );
}

/**
 * Normalizes the case of a name.
 *
 * Only words written all in uppercase or all in lowercase are changed:
 * "maría" becomes "María" and "GARCÍA" becomes "García", while a word with
 * mixed case ("McDonald", "DeLuca") is kept as the attendee wrote it.
 * Words are capitalized by ctbd_capitalize_name_word() (O'BRIEN becomes
 * O'Brien, MCDONALD becomes McDonald). A particle ("de", "van", "le") stays
 * in lowercase only when a word that is not a particle comes after it, as
 * in "de la Fuente"; otherwise it is part of the name ("Le Van").
 *
 * @param string $name Name as typed.
 * @return string Normalized name.
 */
function ctbd_normalize_name( $name ) {
	$name = trim( preg_replace( '/\s+/u', ' ', (string) $name ) );
	if ( '' === $name ) {
		return '';
	}

	$words     = explode( ' ', $name );
	$particles = ctbd_name_particles();

	// Whether a word that is not a particle comes after each position.
	$name_follows = array();
	$seen_name    = false;
	for ( $index = count( $words ) - 1; $index >= 0; $index-- ) {
		$name_follows[ $index ] = $seen_name;
		if ( ! in_array( mb_strtolower( $words[ $index ], 'UTF-8' ), $particles, true ) ) {
			$seen_name = true;
		}
	}

	foreach ( $words as $index => $word ) {
		$lower = mb_strtolower( $word, 'UTF-8' );
		$upper = mb_strtoupper( $word, 'UTF-8' );

		if ( $word !== $lower && $word !== $upper ) {
			continue;
		}

		if ( $name_follows[ $index ] && in_array( $lower, $particles, true ) ) {
			$words[ $index ] = $lower;
		} else {
			$words[ $index ] = ctbd_capitalize_name_word( $lower );
		}
	}

	return implode( ' ', $words );
}

/**
 * Returns the WordPress.org username if it is valid, or an empty string.
 *
 * Tickets bought for someone else hold a placeholder such as
 * "Awaiting attendee ([[ unconfirmed ]])" until the attendee confirms.
 *
 * @param string $username Username as exported.
 * @return string Username, or '' when it is missing or not valid.
 */
function ctbd_sanitize_wporg_username( $username ) {
	$username = trim( (string) $username );
	if ( ! preg_match( '/^[A-Za-z0-9._@-]+$/', $username ) ) {
		return '';
	}
	return $username;
}

/**
 * The WordPress.org account of a username, on WordCamp.org.
 *
 * WordCamp.org shares its users with WordPress.org, and its
 * wcorg_get_user_by_canonical_names() finds an account by its login or its
 * nicename. Elsewhere that function does not exist, and there is no account.
 *
 * @param string $username Valid WordPress.org username, or ''.
 * @return WP_User|false The account, or false.
 */
function ctbd_wporg_account( $username ) {
	if ( '' === $username || ! function_exists( 'wcorg_get_user_by_canonical_names' ) ) {
		return false;
	}
	$user = wcorg_get_user_by_canonical_names( $username );
	return $user instanceof WP_User ? $user : false;
}

/**
 * The WordPress.org profile URL for the QR code.
 *
 * Profile URLs are keyed on the nicename, not the login, which can differ
 * (a login with a dot or an @). In order: the export's "WordPress.org
 * Profile URL" column, which WordCamp.org fills in; the account's nicename,
 * when the account is known; the login, which is right for most people.
 *
 * @param string        $column   Value of the "WordPress.org Profile URL" column.
 * @param WP_User|false $account  WordPress.org account, or false.
 * @param string        $username Valid WordPress.org username, or ''.
 * @return string Profile URL, or '' when there is no username.
 */
function ctbd_profile_url( $column, $account, $username ) {
	$column = trim( (string) $column );
	// phpcs:ignore WordPress.WP.CapitalPDangit.MisspelledInText -- A domain name.
	if ( preg_match( '#^https://(profiles\.)?wordpress\.org/[A-Za-z0-9._@%-]+/?$#', $column ) ) {
		return $column;
	}
	if ( $account && '' !== $account->user_nicename ) {
		return 'https://wordpress.org/@' . strtolower( $account->user_nicename );
	}
	if ( '' !== $username ) {
		return 'https://profiles.wordpress.org/' . rawurlencode( $username ) . '/';
	}
	return '';
}

/**
 * Turns a CampTix export into the attendee list for badges.
 *
 * @param array $csv Result of ctbd_read_csv().
 * @return array|WP_Error {attendees, questions, flags, stats}.
 */
function ctbd_parse_attendees( $csv ) {
	$header = $csv['header'];

	foreach ( array( 'Attendee ID', 'First Name', 'Last Name' ) as $required ) {
		if ( ! in_array( $required, $header, true ) ) {
			return new WP_Error(
				'ctbd_missing_column',
				/* translators: %s: column name. */
				sprintf( __( 'The CSV file has no "%s" column. Is it a CampTix attendees export?', 'camptix-badge-designer' ), $required )
			);
		}
	}

	// Question columns that may become variables. Live from CampTix, the
	// event's questions are known; a CSV export does not say which columns
	// are questions, so there every column CampTix does not always export
	// counts as one (test sites only).
	$standard  = ctbd_camptix_standard_columns();
	$allowed   = ctbd_allowed_standard_questions();
	$excluded  = ctbd_excluded_questions();
	$questions = array();
	foreach ( $header as $column ) {
		if ( isset( $csv['question_columns'] ) ) {
			$is_event_question = in_array( $column, $csv['question_columns'], true );
		} else {
			$is_event_question = ! in_array( $column, $standard, true );
		}
		if ( ( $is_event_question || in_array( $column, $allowed, true ) ) && ! in_array( $column, $excluded, true ) && '' !== $column ) {
			$questions[] = array(
				'key'   => sanitize_title( $column ),
				'label' => $column,
			);
		}
	}

	$stats         = array(
		'rows'            => count( $csv['rows'] ) + $csv['malformed'],
		'malformed'       => $csv['malformed'],
		'skippedByStatus' => array(),
		'withoutUsername' => 0,
		'withoutEmail'    => 0,
		'namesNormalized' => 0,
		'placeholders'    => 0,
		'activitySeats'   => isset( $csv['companions'] ) ? (int) $csv['companions'] : 0,
	);
	$unknown_email = ctbd_unknown_attendee_email();

	// CampTix admin flags (camptix-admin-flags), only known live from CampTix.
	$flag_columns = isset( $csv['flag_columns'] ) ? $csv['flag_columns'] : array();
	$flags        = array();
	foreach ( $flag_columns as $flag_key => $flag_label ) {
		$flags[] = array(
			'key'   => (string) $flag_key,
			'label' => $flag_label,
		);
	}

	$attendees = array();
	foreach ( $csv['rows'] as $row ) {
		$data = array_combine( $header, $row );

		// Only confirmed tickets get a badge.
		$status = isset( $data['Status'] ) ? trim( $data['Status'] ) : 'Publish';
		if ( 'Publish' !== $status ) {
			if ( ! isset( $stats['skippedByStatus'][ $status ] ) ) {
				$stats['skippedByStatus'][ $status ] = 0;
			}
			++$stats['skippedByStatus'][ $status ];
			continue;
		}

		// Tickets bought for an unknown attendee have no name to print yet.
		$email = isset( $data['E-mail Address'] ) ? strtolower( trim( $data['E-mail Address'] ) ) : '';
		if ( $unknown_email === $email ) {
			++$stats['placeholders'];
			continue;
		}

		// Names with their case fixed; the editor uses the names as typed
		// when the design's "Fix names" option is off.
		$first_typed = trim( preg_replace( '/\s+/u', ' ', $data['First Name'] ) );
		$last_typed  = trim( preg_replace( '/\s+/u', ' ', $data['Last Name'] ) );
		$first_name  = ctbd_normalize_name( $first_typed );
		$last_name   = ctbd_normalize_name( $last_typed );
		if ( $first_typed !== $first_name || $last_typed !== $last_name ) {
			++$stats['namesNormalized'];
		}

		$username = ctbd_sanitize_wporg_username( isset( $data['Username'] ) ? $data['Username'] : '' );
		if ( '' === $username ) {
			++$stats['withoutUsername'];
		}

		// Gravatar addresses images by the SHA-256 of the trimmed, lowercase email.
		$gravatar_hash = '';
		if ( is_email( $email ) ) {
			$gravatar_hash = hash( 'sha256', $email );
		} else {
			++$stats['withoutEmail'];
		}

		// On WordCamp.org, the attendee's WordPress.org account.
		$account = ctbd_wporg_account( $username );

		// The account's Gravatar, used when the ticket email has none.
		$account_hash = '';
		if ( $account && is_email( $account->user_email ) ) {
			$account_hash = hash( 'sha256', strtolower( trim( $account->user_email ) ) );
			if ( $account_hash === $gravatar_hash ) {
				$account_hash = '';
			}
		}

		$profile_url = ctbd_profile_url( isset( $data['WordPress.org Profile URL'] ) ? $data['WordPress.org Profile URL'] : '', $account, $username );

		$answers = array();
		foreach ( $questions as $question ) {
			$answers[ $question['key'] ] = trim( $data[ $question['label'] ] );
		}

		// Admin flags the attendee has: the export writes "Yes" or "No".
		$attendee_flags = array();
		foreach ( $flag_columns as $flag_key => $flag_label ) {
			if ( isset( $data[ $flag_label ] ) && 'Yes' === trim( $data[ $flag_label ] ) ) {
				$attendee_flags[] = $flag_key;
			}
		}

		$attendee = array(
			'attendeeId'   => absint( $data['Attendee ID'] ),
			'firstName'    => $first_name,
			'lastName'     => $last_name,
			'username'     => $username,
			'profileUrl'   => $profile_url,
			'gravatarHash' => $gravatar_hash,
			'answers'      => $answers,
			'flags'        => $attendee_flags,
		);
		if ( $first_typed !== $first_name ) {
			$attendee['firstNameAsTyped'] = $first_typed;
		}
		if ( $last_typed !== $last_name ) {
			$attendee['lastNameAsTyped'] = $last_typed;
		}
		if ( '' !== $account_hash ) {
			$attendee['accountGravatarHash'] = $account_hash;
		}
		$attendees[] = $attendee;
	}

	// Purchase order: Attendee ID grows with every ticket sold, so new
	// tickets never shift the page numbers of badges already printed.
	usort(
		$attendees,
		function ( $a, $b ) {
			return $a['attendeeId'] - $b['attendeeId'];
		}
	);

	foreach ( $attendees as $index => $attendee ) {
		$attendees[ $index ]['number'] = $index + 1;
	}

	return array(
		'attendees' => $attendees,
		'questions' => $questions,
		'flags'     => $flags,
		'stats'     => $stats,
	);
}

/**
 * The attendee list for badges, from the current source: CampTix when it
 * is active on the site, otherwise the CSV export in test-data/.
 *
 * @return array|WP_Error {source, attendees, questions, stats}.
 */
function ctbd_get_attendees() {
	if ( ctbd_camptix_is_active() ) {
		$result = ctbd_parse_attendees( ctbd_read_camptix() );
		if ( ! is_wp_error( $result ) ) {
			$result['source'] = 'CampTix';
		}
		return $result;
	}

	$path = ctbd_get_test_csv_path();
	$csv  = ctbd_read_csv( $path );
	if ( is_wp_error( $csv ) ) {
		return $csv;
	}

	$result = ctbd_parse_attendees( $csv );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	$result['source'] = 'test-data/' . basename( $path );
	return $result;
}

/**
 * Registers GET /wp-json/ctbd/v1/attendees.
 */
function ctbd_register_attendees_route() {
	register_rest_route(
		'ctbd/v1',
		'/attendees',
		array(
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'ctbd_rest_get_attendees',
			'permission_callback' => 'ctbd_can_edit_badges',
		)
	);
}
add_action( 'rest_api_init', 'ctbd_register_attendees_route' );

/**
 * REST callback for the attendee list.
 *
 * @return WP_REST_Response|WP_Error The attendees.
 */
function ctbd_rest_get_attendees() {
	$result = ctbd_get_attendees();
	if ( is_wp_error( $result ) ) {
		$result->add_data( array( 'status' => 404 ) );
		return $result;
	}

	$response = rest_ensure_response( $result );
	$response->header( 'Cache-Control', 'no-store' );
	return $response;
}
