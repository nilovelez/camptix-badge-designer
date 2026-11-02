<?php
/**
 * WordCamp sandbox: makes a plain WordPress site with CampTix look like a
 * WordCamp.org site, and fills it with invented tickets, questions and
 * attendees, plus a sample badge design.
 *
 * It is loaded as a must-use plugin by sandbox/blueprint.json (local) and
 * sandbox/demo-blueprint.json (public demo). It is a development file, not
 * part of the plugin.
 *
 * Every name, email address and username here is invented, except the first
 * attendee: Matt Mullenweg, with the email address and username he publishes
 * himself, so the demo opens on a badge with a real Gravatar and QR code
 * (decided by Nilo). The data is the same on every run: it comes from a fixed
 * random seed.
 *
 * @package CampTix_Badge_Designer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// mt_rand() with a fixed seed is what makes the data the same on every run.
// phpcs:disable WordPress.WP.AlternativeFunctions.rand_mt_rand, WordPress.WP.AlternativeFunctions.rand_seeding_mt_srand

/**
 * Version of the sandbox data. Raising it makes the next request delete the
 * sandbox attendees, tickets and questions and create them again.
 */
const CTBD_SANDBOX_VERSION = 4;

/*
 * Stand-ins for the WordCamp.org functions CampTix calls. On WordCamp.org
 * they come from its own plugins.
 */
// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- These must have WordCamp.org's names.
if ( ! function_exists( 'get_wordcamp_post' ) ) {
	/**
	 * WordCamp.org returns the event's WordCamp post. The sandbox has none,
	 * which CampTix handles.
	 *
	 * @return false No WordCamp post.
	 */
	function get_wordcamp_post() {
		return false;
	}
}

if ( ! function_exists( 'get_wordcamp_name' ) ) {
	/**
	 * The event's name.
	 *
	 * @return string Name.
	 */
	function get_wordcamp_name() {
		return 'WordCamp Sandbox';
	}
}

if ( ! function_exists( 'wcorg_get_countries' ) ) {
	/**
	 * Countries for the Country question type. WordCamp.org lists them all;
	 * a few are enough here.
	 *
	 * @return array[] Countries, each with a name.
	 */
	function wcorg_get_countries() {
		$countries = array();
		foreach ( ctbd_sandbox_countries() as $name ) {
			$countries[] = array( 'name' => $name );
		}
		return $countries;
	}
}
// phpcs:enable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound

/*
 * WordCamp.org is a multisite network, and the CampTix export names its file
 * after the current site with WP_Site::get_instance(). On a single site the
 * class is not loaded and there is no site to find, so the export would
 * print warnings into the CSV. WP_Site looks in the object cache first:
 * this site is put there, as it would be on the network.
 */
if ( ! class_exists( 'WP_Site' ) ) {
	require_once ABSPATH . WPINC . '/class-wp-site.php';
}

/**
 * Adds this site to the object cache as a network site.
 */
function ctbd_sandbox_cache_site() {
	if ( is_multisite() ) {
		return;
	}
	wp_cache_set(
		get_current_blog_id(),
		(object) array(
			'blog_id' => (string) get_current_blog_id(),
			'site_id' => '1',
			'domain'  => (string) wp_parse_url( home_url(), PHP_URL_HOST ),
			'path'    => '/',
			'public'  => '1',
		),
		'sites'
	);
}
add_action( 'init', 'ctbd_sandbox_cache_site', 1 );

/**
 * CampTix add-ons. WordCamp.org turns on the one that asks every attendee
 * for their WordPress.org username, which is where `tix_username` comes from.
 *
 * @param string[] $addons Add-on files.
 * @return string[] Add-on files.
 */
function ctbd_sandbox_addons( $addons ) {
	global $camptix;
	$addons['require-login'] = $camptix->get_default_addon_path( 'require-login.php' );

	// Its cron job adds up T-shirt sizes across every site of the network
	// with get_sites(), which only exists on multisite.
	unset( $addons['field-tshirt'] );

	return $addons;
}
add_filter( 'camptix_default_addons', 'ctbd_sandbox_addons' );

/**
 * Countries used by the sandbox.
 *
 * @return string[] Names.
 */
function ctbd_sandbox_countries() {
	return array( 'Spain', 'Portugal', 'France', 'Italy', 'Germany', 'United Kingdom', 'Mexico', 'Argentina', 'Brazil', 'United States' );
}

/**
 * Creates the sandbox data the first time, or again when its version changes.
 */
function ctbd_sandbox_maybe_seed() {
	if ( ! post_type_exists( 'tix_attendee' ) ) {
		return;
	}
	if ( (int) get_option( 'ctbd_sandbox_version' ) === CTBD_SANDBOX_VERSION ) {
		return;
	}

	// The first page load fires several requests at once. add_option() only
	// succeeds for one of them, so only that one creates the data.
	$lock = get_option( 'ctbd_sandbox_lock' );
	if ( $lock && time() - (int) $lock > 300 ) {
		delete_option( 'ctbd_sandbox_lock' );
	}
	if ( ! add_option( 'ctbd_sandbox_lock', time(), '', false ) ) {
		return;
	}

	ctbd_sandbox_delete();
	ctbd_sandbox_seed();
	ctbd_sandbox_design();
	update_option( 'ctbd_sandbox_version', CTBD_SANDBOX_VERSION );
	delete_option( 'ctbd_sandbox_lock' );
}
add_action( 'init', 'ctbd_sandbox_maybe_seed', 100 );

/**
 * Deletes every ticket, question and attendee.
 */
function ctbd_sandbox_delete() {
	$posts = get_posts(
		array(
			'post_type'      => array( 'tix_ticket', 'tix_question', 'tix_attendee' ),
			'post_status'    => 'any',
			'posts_per_page' => -1,
			'fields'         => 'ids',
		)
	);
	foreach ( $posts as $post_id ) {
		wp_delete_post( $post_id, true );
	}
}

/**
 * Creates a published post with its meta.
 *
 * @param string $post_type Post type.
 * @param string $title     Title.
 * @param array  $meta      Meta keys and values. A list value under a key
 *                          ending in [] is stored as several rows.
 * @param array  $post      More wp_insert_post() fields.
 * @return int Post ID.
 */
function ctbd_sandbox_insert( $post_type, $title, $meta, $post = array() ) {
	$post_id = wp_insert_post(
		array_merge(
			array(
				'post_type'   => $post_type,
				'post_title'  => $title,
				'post_status' => 'publish',
			),
			$post
		)
	);

	foreach ( $meta as $key => $value ) {
		if ( str_ends_with( $key, '[]' ) ) {
			foreach ( $value as $item ) {
				add_post_meta( $post_id, substr( $key, 0, -2 ), $item );
			}
		} else {
			update_post_meta( $post_id, $key, $value );
		}
	}

	return $post_id;
}

/**
 * Creates the tickets, the questions and the attendees.
 */
function ctbd_sandbox_seed() {
	// The same data on every run.
	mt_srand( 2026 );

	update_option(
		'camptix_options',
		array_merge(
			(array) get_option( 'camptix_options', array() ),
			array(
				'event_name' => 'WordCamp Sandbox',
				'currency'   => 'EUR',
			)
		)
	);

	// Questions, as organizers create them in Tickets > Edit ticket.
	$questions = array(
		'country' => ctbd_sandbox_insert(
			'tix_question',
			'Country',
			array(
				'tix_type'     => 'country',
				'tix_required' => 1,
				'tix_values'   => array(),
			)
		),
		'job'     => ctbd_sandbox_insert(
			'tix_question',
			'Job title',
			array(
				'tix_type'     => 'text',
				'tix_required' => 0,
				'tix_values'   => array(),
			)
		),
		'city'    => ctbd_sandbox_insert(
			'tix_question',
			'Hometown',
			array(
				'tix_type'     => 'text',
				'tix_required' => 0,
				'tix_values'   => array(),
			)
		),
		'website' => ctbd_sandbox_insert(
			'tix_question',
			'Website',
			array(
				'tix_type'     => 'url',
				'tix_required' => 0,
				'tix_values'   => array(),
			)
		),
		'tshirt'  => ctbd_sandbox_insert(
			'tix_question',
			'T-shirt size',
			array(
				'tix_type'     => 'select',
				'tix_required' => 1,
				'tix_values'   => array( 'XS', 'S', 'M', 'L', 'XL', 'XXL' ),
			)
		),
	);

	$tickets = array();
	foreach ( array(
		'General'   => 25,
		'Speaker'   => 0,
		'Sponsor'   => 0,
		'Volunteer' => 0,
	) as $name => $price ) {
		$tickets[ $name ] = ctbd_sandbox_insert(
			'tix_ticket',
			$name,
			array(
				'tix_price'           => $price,
				'tix_quantity'        => 300,
				'tix_start'           => '2026-09-01',
				'tix_end'             => '2026-11-30',
				'tix_question_id[]'   => array_values( $questions ),
				'tix_questions_order' => array_values( $questions ),
			)
		);
	}

	foreach ( ctbd_sandbox_attendees( $questions, $tickets ) as $attendee ) {
		$attendee_id = ctbd_sandbox_insert( 'tix_attendee', $attendee['title'], $attendee['meta'], $attendee['post'] );

		// Like CampTix at checkout: saving the post again, now that the meta
		// is there, lets CampTix build the title and the search content.
		wp_update_post( array( 'ID' => $attendee_id ) );
	}
}

/**
 * Builds the invented attendees, grouped in orders as CampTix stores them:
 * every attendee of an order shares its access token, and the buyer comes
 * first.
 *
 * @param int[] $questions Question IDs by key.
 * @param int[] $tickets   Ticket IDs by name.
 * @return array[] Attendees, each with title, meta and post fields.
 */
function ctbd_sandbox_attendees( $questions, $tickets ) {
	$first_names = array( 'María', 'José', 'Lucía', 'Javier', 'Carmen', 'Andrés', 'Begoña', 'Íñigo', 'Nuria', 'Álvaro', 'Rocío', 'Sergio', 'Aitana', 'Óscar', 'Elena', 'Raúl', 'Inés', 'Tomás', 'Paula', 'Joaquín', 'Ana Belén', 'Juan Carlos', 'María José', 'Francesc', 'Montserrat', 'Xabier', 'Uxue', 'Joana', 'Gonçalo', 'Leonor', 'Amélie', 'Étienne', 'Giulia', 'Matteo', 'Jürgen', 'Zoë', 'Siobhán', 'Kateřina', 'Bjørn', 'Chloé' );
	$last_names  = array( 'García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Ruiz', 'Díaz', 'Muñoz', 'Álvarez', 'Romero', 'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Serrano', 'Ortega', 'de la Fuente', 'del Olmo', 'Puig i Soler', 'Etxeberria', 'Iñiguez de Heredia', 'dos Santos', 'Fontaine', 'Rossi', 'Müller', 'O\'Connor', 'Novák', 'Andersen', 'Fernández-Villaverde', 'Rodríguez de Castro y Montenegro' );
	$jobs        = array( 'Developer', 'Designer', 'Content writer', 'Project manager', 'Student', 'Freelancer', 'Agency owner', 'Accessibility specialist', 'Marketing lead', 'Teacher', 'Photographer', 'Head of Engineering and Developer Experience', '' );
	$cities      = array( 'Madrid', 'Barcelona', 'Sevilla', 'Valencia', 'Bilbao', 'Zaragoza', 'A Coruña', 'Las Palmas de Gran Canaria', 'Lisboa', 'Porto', 'Lyon', 'Milano', 'Berlin', 'Dublin', '' );
	$countries   = ctbd_sandbox_countries();
	$sizes       = array( 'XS', 'S', 'M', 'L', 'XL', 'XXL' );
	$ticket_mix  = array( 'General', 'General', 'General', 'General', 'General', 'General', 'Speaker', 'Sponsor', 'Volunteer' );

	// The first attendee, and so the first badge: a real person with a public
	// Gravatar and WordPress.org profile. The ticket and the T-shirt size are
	// invented. Built before the loop, so the invented attendees stay the same.
	$attendees = array(
		array(
			'title' => 'Matt Mullenweg',
			'post'  => array(
				'post_status' => 'publish',
				'post_date'   => '2026-08-01 09:00:00',
			),
			'meta'  => array(
				'tix_first_name'     => 'Matt',
				'tix_last_name'      => 'Mullenweg',
				'tix_email'          => 'matt@mullenweg.com',
				'tix_receipt_email'  => 'matt@mullenweg.com',
				'tix_ticket_id'      => $tickets['Speaker'],
				'tix_timestamp'      => strtotime( '2026-08-01 09:00:00' ),
				'tix_access_token'   => md5( 'ctbd-sandbox-order-matt' ),
				'tix_edit_token'     => md5( 'ctbd-sandbox-edit-matt' ),
				'tix_payment_method' => 'none',
				'tix_username'       => 'matt',
				'tix_questions'      => array(
					$questions['country'] => 'United States',
					$questions['job']     => 'Co-founder of WordPress',
					$questions['city']    => 'Houston',
					$questions['website'] => 'https://ma.tt',
					$questions['tshirt']  => 'M',
				),
			),
		),
	);
	$count     = 150;
	$order     = 0;
	// Purchases between August and early September 2026: dates in the past,
	// or WordPress would schedule the posts instead of publishing them.
	$timestamp = strtotime( '2026-08-01 10:00:00' );
	$index     = 0;

	while ( $index < $count ) {
		++$order;
		// Most orders are one ticket; some buy for two or three people.
		$roll         = mt_rand( 1, 10 );
		$size         = ( $roll > 8 ) ? 3 : ( ( $roll > 6 ) ? 2 : 1 );
		$access_token = md5( 'ctbd-sandbox-order-' . $order );
		$status       = ctbd_sandbox_order_status( $order );

		for ( $seat = 0; $seat < $size && $index < $count; $seat++ ) {
			++$index;
			$timestamp += mt_rand( 600, 43200 );

			$first = $first_names[ mt_rand( 0, count( $first_names ) - 1 ) ];
			$last  = $last_names[ mt_rand( 0, count( $last_names ) - 1 ) ];
			if ( mt_rand( 1, 4 ) === 1 ) {
				$last .= ' ' . $last_names[ mt_rand( 0, 19 ) ];
			}
			// Some attendees type their name in capitals or in lowercase.
			$case = mt_rand( 1, 15 );
			if ( 1 === $case ) {
				$first = mb_strtoupper( $first, 'UTF-8' );
				$last  = mb_strtoupper( $last, 'UTF-8' );
			} elseif ( 2 === $case ) {
				$first = mb_strtolower( $first, 'UTF-8' );
				$last  = mb_strtolower( $last, 'UTF-8' );
			}

			$email    = sanitize_title( remove_accents( $first . '.' . $last ) ) . '.' . $index . '@example.org';
			$username = '';
			$roll     = mt_rand( 1, 10 );
			if ( $seat > 0 && $roll <= 3 ) {
				// Bought by someone else, not claimed yet.
				$username = '[[ unconfirmed ]]';
			} elseif ( $roll <= 7 ) {
				$username = str_replace( '-', '', sanitize_title( remove_accents( $first ) ) ) . substr( str_replace( '-', '', sanitize_title( remove_accents( $last ) ) ), 0, 6 ) . ( mt_rand( 1, 3 ) === 1 ? mt_rand( 10, 99 ) : '' );
			}

			$website = '';
			if ( mt_rand( 1, 3 ) === 1 ) {
				$website = 'https://' . sanitize_title( remove_accents( $last ) ) . '.example';
			}

			$ticket = $ticket_mix[ mt_rand( 0, count( $ticket_mix ) - 1 ) ];

			$attendees[] = array(
				'title' => $first . ' ' . $last,
				'post'  => array(
					'post_status' => $status,
					'post_date'   => gmdate( 'Y-m-d H:i:s', $timestamp ),
				),
				'meta'  => array(
					'tix_first_name'     => $first,
					'tix_last_name'      => $last,
					'tix_email'          => $email,
					'tix_receipt_email'  => $email,
					'tix_ticket_id'      => $tickets[ $ticket ],
					'tix_timestamp'      => $timestamp,
					'tix_access_token'   => $access_token,
					'tix_edit_token'     => md5( 'ctbd-sandbox-edit-' . $index ),
					'tix_payment_method' => 'General' === $ticket ? 'stripe' : 'none',
					'tix_username'       => $username,
					'tix_questions'      => array(
						$questions['country'] => $countries[ mt_rand( 0, count( $countries ) - 1 ) ],
						$questions['job']     => $jobs[ mt_rand( 0, count( $jobs ) - 1 ) ],
						$questions['city']    => $cities[ mt_rand( 0, count( $cities ) - 1 ) ],
						$questions['website'] => $website,
						$questions['tshirt']  => $sizes[ mt_rand( 0, count( $sizes ) - 1 ) ],
					),
				),
			);
		}
	}

	// Two tickets bought for "unknown attendees", which CampTix stores with
	// placeholder data until someone claims them. They get no badge.
	foreach ( array( 1, 2 ) as $unknown ) {
		$timestamp  += 3600;
		$attendees[] = array(
			'title' => 'Unknown Attendee',
			'post'  => array(
				'post_status' => 'publish',
				'post_date'   => gmdate( 'Y-m-d H:i:s', $timestamp ),
			),
			'meta'  => array(
				'tix_first_name'   => 'Unknown',
				'tix_last_name'    => 'Attendee',
				'tix_email'        => 'unknown.attendee@example.org',
				'tix_ticket_id'    => $tickets['General'],
				'tix_timestamp'    => $timestamp,
				'tix_access_token' => md5( 'ctbd-sandbox-unknown-' . $unknown ),
				'tix_username'     => '[[ unconfirmed ]]',
				'tix_questions'    => array(),
			),
		);
	}

	return $attendees;
}

/**
 * Creates a sample badge design, so the editor opens with a badge ready to
 * print: the background in demo-background.pdf, next to this file, and the
 * Gravatar, the name, the job title and country, and the QR code. A design
 * the organizer already saved is left alone.
 */
function ctbd_sandbox_design() {
	if ( false !== get_option( 'ctbd_design' ) ) {
		return;
	}

	$file = __DIR__ . '/demo-background.pdf';
	if ( ! is_readable( $file ) ) {
		return;
	}

	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- A local file.
	$upload = wp_upload_bits( 'demo-background.pdf', null, file_get_contents( $file ) );
	if ( ! empty( $upload['error'] ) ) {
		return;
	}

	$background_id = wp_insert_attachment(
		array(
			'post_title'     => 'Sample badge background',
			'post_mime_type' => 'application/pdf',
			'post_status'    => 'inherit',
		),
		$upload['file']
	);
	if ( ! $background_id ) {
		return;
	}

	// The WordCamp Europe 2025 badge, provided by Nilo for the demo: 102.5 × 149.2 mm with
	// 5 mm bleed, so the background page is 112.5 × 159.2 mm. Laid out by Nilo.
	$design = array(
		'version'    => 2,
		'size'       => array(
			'width'  => 102.5,
			'height' => 149.2,
			'bleed'  => 5,
			'safe'   => 8.5,
		),
		'cropMarks'  => true,
		'guides'     => true,
		'background' => array(
			'id'         => $background_id,
			'type'       => 'pdf',
			'pageWidth'  => 112.5,
			'pageHeight' => 159.2,
		),
		'elements'   => array(
			array(
				'id'            => 'sample-gravatar',
				'type'          => 'gravatar',
				'x'             => 51.2,
				'y'             => 21.4,
				'width'         => 42.7,
				'height'        => 42.7,
				'shape'         => 'square',
				'fallback'      => 'robohash',
				'fallbackImage' => 0,
			),
			array(
				'id'        => 'sample-first-name',
				'type'      => 'text',
				'content'   => '{first_name}',
				'x'         => 9,
				'y'         => 68.1,
				'width'     => 84.6,
				'height'    => 12.5,
				'weight'    => '700',
				'size'      => 26,
				'font'      => 'Inter',
				'color'     => '#1e1e1e',
				'align'     => 'center',
				'uppercase' => false,
			),
			array(
				'id'        => 'sample-last-name',
				'type'      => 'text',
				'content'   => '{last_name}',
				'x'         => 9,
				'y'         => 81.1,
				'width'     => 84.6,
				'height'    => 9,
				'weight'    => '600',
				'size'      => 16,
				'font'      => 'Inter',
				'color'     => '#1e1e1e',
				'align'     => 'center',
				'uppercase' => false,
			),
			array(
				'id'        => 'sample-job-country',
				'type'      => 'text',
				'content'   => '{question:job-title} · {question:country}',
				'x'         => 9.3,
				'y'         => 99,
				'width'     => 84.3,
				'height'    => 7,
				'weight'    => '400',
				'size'      => 10,
				'font'      => 'Inter',
				'color'     => '#1e1e1e',
				'align'     => 'center',
				'uppercase' => false,
			),
			array(
				'id'     => 'sample-qr',
				'type'   => 'qr',
				'x'      => 65.5,
				'y'      => 109.7,
				'width'  => 26,
				'height' => 26,
			),
		),
	);

	// The plugin may not be active yet while Playground sets the site up, so
	// the design above is already complete, as the plugin would store it.
	if ( function_exists( 'ctbd_sanitize_design' ) ) {
		$design = ctbd_sanitize_design( $design );
		if ( is_wp_error( $design ) ) {
			return;
		}
	}
	update_option( 'ctbd_design', $design, false );
}

/**
 * The status of an order: almost all are paid, a few are not.
 *
 * @param int $order Order number.
 * @return string Post status.
 */
function ctbd_sandbox_order_status( $order ) {
	$statuses = array(
		7  => 'pending',
		19 => 'refund',
		33 => 'cancel',
		48 => 'pending',
		61 => 'failed',
		77 => 'timeout',
		90 => 'refund',
	);
	return isset( $statuses[ $order ] ) ? $statuses[ $order ] : 'publish';
}
