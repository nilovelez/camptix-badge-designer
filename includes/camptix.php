<?php
/**
 * Attendees read live from CampTix, on sites where it is active, such as
 * WordCamp sites.
 *
 * The attendees are turned into the same table CampTix's own CSV export
 * produces (Tickets > Tools > Export), with the same columns, values and
 * hooks, so ctbd_parse_attendees() treats both sources the same way and a
 * design made with one works with the other.
 *
 * @package CampTix_Badge_Designer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Whether CampTix is active on this site.
 *
 * @return bool Whether it is.
 */
function ctbd_camptix_is_active() {
	return isset( $GLOBALS['camptix'] ) && $GLOBALS['camptix'] instanceof CampTix_Plugin && post_type_exists( 'tix_attendee' );
}

/**
 * Email address CampTix stores for tickets bought for an "unknown attendee"
 * until someone claims them. Those tickets get no badge.
 *
 * @return string Email address.
 */
function ctbd_unknown_attendee_email() {
	if ( class_exists( 'CampTix_Require_Login' ) && defined( 'CampTix_Require_Login::UNKNOWN_ATTENDEE_EMAIL' ) ) {
		return CampTix_Require_Login::UNKNOWN_ATTENDEE_EMAIL;
	}
	return 'unknown.attendee@example.org';
}

/**
 * English names of the export columns that CampTix and the WordCamp.org
 * plugins add, by their internal key.
 *
 * @return string[] Column names by key.
 */
function ctbd_camptix_column_labels() {
	return array(
		'username'                      => 'Username',
		'attended'                      => 'Attended the event',
		'wporg_profile_url'             => 'WordPress.org Profile URL',
		'allergy'                       => 'Severe allergy',
		'accommodations'                => 'Accessibility needs',
		'first_time_attending_wp_event' => 'First Time Attending',
	);
}

/**
 * Reads the CampTix attendees as the table of its CSV export.
 *
 * Like the export (CampTix_Plugin::generate_attendee_report()), it covers
 * published and pending tickets, in Attendee ID order. Only the columns a
 * badge can use are filled: the ticket, the name, the email address, the
 * status, the answers to the event's questions and the columns added by
 * CampTix add-ons, such as the WordPress.org username.
 *
 * @return array {header: string[], rows: string[][], malformed: int}, like ctbd_read_csv(),
 *               plus question_columns (the event's questions) and
 *               flag_columns (admin flag labels by flag key).
 */
function ctbd_read_camptix() {
	global $camptix;

	$questions = $camptix->get_all_questions();

	$columns = array(
		'id'         => 'Attendee ID',
		'ticket'     => 'Ticket Type',
		'first_name' => 'First Name',
		'last_name'  => 'Last Name',
		'email'      => 'E-mail Address',
		'status'     => 'Status',
	);
	foreach ( $questions as $question ) {
		// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Core hook, applied as CampTix does.
		$columns[ 'tix_q_' . $question->ID ] = apply_filters( 'the_title', $question->post_title, $question->ID );
	}

	// Columns added by CampTix add-ons, such as Username.
	// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- CampTix hook.
	$extra_columns = apply_filters( 'camptix_attendee_report_extra_columns', array() );

	// The export translates its headers into the user's language. The known
	// columns get the English names ctbd_camptix_standard_columns() expects,
	// so "Username" is found and "Severe allergy" is never offered as a
	// variable, whatever the language.
	$labels = ctbd_camptix_column_labels();
	foreach ( $extra_columns as $key => $label ) {
		if ( isset( $labels[ $key ] ) ) {
			$extra_columns[ $key ] = $labels[ $key ];
		}
	}
	$columns = array_merge( $columns, $extra_columns );

	$rows  = array();
	$paged = 1;
	do {
		$attendees = get_posts(
			array(
				'post_type'      => 'tix_attendee',
				'post_status'    => array( 'publish', 'pending' ),
				'posts_per_page' => 500, // phpcs:ignore WordPress.WP.PostsPerPage.posts_per_page_posts_per_page -- Pages of 500, as the CampTix export reads them.
				'paged'          => $paged,
				'orderby'        => 'ID',
				'order'          => 'ASC',
			)
		);
		++$paged;

		foreach ( $attendees as $attendee ) {
			$line = array(
				'id'         => $attendee->ID,
				'ticket'     => $camptix->get_ticket_title( intval( get_post_meta( $attendee->ID, 'tix_ticket_id', true ) ) ),
				'first_name' => get_post_meta( $attendee->ID, 'tix_first_name', true ),
				'last_name'  => get_post_meta( $attendee->ID, 'tix_last_name', true ),
				'email'      => get_post_meta( $attendee->ID, 'tix_email', true ),
				'status'     => ucfirst( $attendee->post_status ),
			);

			$answers = $camptix->get_attendee_answers( $attendee->ID );
			foreach ( $questions as $question ) {
				$answer = isset( $answers[ $question->ID ] ) ? $answers[ $question->ID ] : '';
				// Several checkboxes are joined, as in the export.
				if ( is_array( $answer ) ) {
					$answer = implode( ', ', $answer );
				}
				$line[ 'tix_q_' . $question->ID ] = $answer;
			}

			foreach ( array_keys( $extra_columns ) as $key ) {
				// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.DynamicHooknameFound, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- CampTix hooks.
				$value = apply_filters( 'camptix_attendee_report_column_value_' . $key, '', $attendee );
				$value = apply_filters( 'camptix_attendee_report_column_value', $value, $key, $attendee );
				// phpcs:enable
				$line[ $key ] = $value;
			}

			$row = array();
			foreach ( array_keys( $columns ) as $key ) {
				$row[] = isset( $line[ $key ] ) ? (string) $line[ $key ] : '';
			}
			$rows[] = $row;
		}
	} while ( ! empty( $attendees ) );

	// Which columns are the event's questions, and which are admin flags, so
	// that no other add-on column (a phone number from a payment add-on, for
	// example) is ever offered as a variable.
	$question_columns = array();
	foreach ( $questions as $question ) {
		$question_columns[] = (string) $columns[ 'tix_q_' . $question->ID ];
	}
	$flag_columns = array();
	foreach ( $extra_columns as $key => $label ) {
		if ( 0 === strpos( $key, 'camptix-admin-flags-' ) ) {
			$flag_columns[ substr( $key, strlen( 'camptix-admin-flags-' ) ) ] = (string) $label;
		}
	}

	return array(
		'header'           => array_values( array_map( 'strval', $columns ) ),
		'rows'             => $rows,
		'malformed'        => 0,
		'question_columns' => $question_columns,
		'flag_columns'     => $flag_columns,
	);
}
