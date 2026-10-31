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
 * Normalizes the case of a name.
 *
 * Only words written all in uppercase or all in lowercase are changed:
 * "maría" becomes "María" and "GARCÍA" becomes "García", while a word with
 * mixed case ("McDonald", "DeLuca") is kept as the attendee wrote it.
 * Particles stay in lowercase when the name has more than one word.
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

	foreach ( $words as $index => $word ) {
		$lower = mb_strtolower( $word, 'UTF-8' );
		$upper = mb_strtoupper( $word, 'UTF-8' );

		if ( $word !== $lower && $word !== $upper ) {
			continue;
		}

		if ( count( $words ) > 1 && in_array( $lower, $particles, true ) ) {
			$words[ $index ] = $lower;
		} else {
			$words[ $index ] = mb_convert_case( $lower, MB_CASE_TITLE, 'UTF-8' );
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
 * Turns a CampTix export into the attendee list for badges.
 *
 * @param array $csv Result of ctbd_read_csv().
 * @return array|WP_Error {attendees, questions, stats}.
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

	// Question columns that may become variables.
	$standard  = ctbd_camptix_standard_columns();
	$allowed   = ctbd_allowed_standard_questions();
	$excluded  = ctbd_excluded_questions();
	$questions = array();
	foreach ( $header as $column ) {
		$is_event_question = ! in_array( $column, $standard, true );
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
	);
	$unknown_email = ctbd_unknown_attendee_email();

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

		$first_name = ctbd_normalize_name( $data['First Name'] );
		$last_name  = ctbd_normalize_name( $data['Last Name'] );
		if ( trim( preg_replace( '/\s+/u', ' ', $data['First Name'] ) ) !== $first_name || trim( preg_replace( '/\s+/u', ' ', $data['Last Name'] ) ) !== $last_name ) {
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

		$answers = array();
		foreach ( $questions as $question ) {
			$answers[ $question['key'] ] = trim( $data[ $question['label'] ] );
		}

		$attendees[] = array(
			'attendeeId'   => absint( $data['Attendee ID'] ),
			'firstName'    => $first_name,
			'lastName'     => $last_name,
			'username'     => $username,
			'gravatarHash' => $gravatar_hash,
			'answers'      => $answers,
		);
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
