<?php
/**
 * The badge design: one per site, stored in an option and edited through
 * the REST route ctbg/v1/design.
 *
 * All sizes are in millimeters.
 *
 * @package Camptix_Badge_Generator
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Version of the design format.
 *
 * 1: milestone 3, no elements. 2: elements. The editor adds the default
 * elements (Gravatar, first name, last name, QR code) when it opens a
 * design older than version 2, or one whose elements are null.
 */
const CTBG_DESIGN_VERSION = 2;

/**
 * Design used before the organizer saves anything. Its elements are null:
 * the editor fills in the default ones, sized for the print size.
 *
 * @return array Design.
 */
function ctbg_default_design() {
	return array(
		'version'    => CTBG_DESIGN_VERSION,
		'size'       => array(
			'width'  => 100,
			'height' => 150,
			'bleed'  => 3,
			'safe'   => 5,
		),
		'cropMarks'  => true,
		'guides'     => true,
		'background' => null,
		'elements'   => null,
	);
}

/**
 * Background file types accepted, by MIME type.
 *
 * @return array MIME type => short type.
 */
function ctbg_background_types() {
	return array(
		'application/pdf' => 'pdf',
		'image/png'       => 'png',
		'image/jpeg'      => 'jpg',
	);
}

/**
 * Keeps a number within limits, rounded to a tenth of a millimeter.
 *
 * @param mixed $value   Value sent by the editor.
 * @param float $min     Minimum.
 * @param float $max     Maximum.
 * @param float $fallback Used when the value is not a number.
 * @return float Number.
 */
function ctbg_clamp_mm( $value, $min, $max, $fallback ) {
	if ( ! is_numeric( $value ) ) {
		return $fallback;
	}
	return round( min( $max, max( $min, (float) $value ) ), 1 );
}

/**
 * Checks and cleans a design sent by the editor.
 *
 * @param mixed $input Design as decoded from JSON.
 * @return array|WP_Error Clean design.
 */
function ctbg_sanitize_design( $input ) {
	if ( ! is_array( $input ) ) {
		return new WP_Error( 'ctbg_invalid_design', __( 'The design is not valid.', 'camptix-badge-generator' ), array( 'status' => 400 ) );
	}

	$default = ctbg_default_design();
	$size    = isset( $input['size'] ) && is_array( $input['size'] ) ? $input['size'] : array();

	$design = array(
		'version'    => CTBG_DESIGN_VERSION,
		'size'       => array(
			'width'  => ctbg_clamp_mm( $size['width'] ?? null, 20, 500, $default['size']['width'] ),
			'height' => ctbg_clamp_mm( $size['height'] ?? null, 20, 500, $default['size']['height'] ),
			'bleed'  => ctbg_clamp_mm( $size['bleed'] ?? null, 0, 10, $default['size']['bleed'] ),
			'safe'   => ctbg_clamp_mm( $size['safe'] ?? null, 0, 30, $default['size']['safe'] ),
		),
		'cropMarks'  => ! empty( $input['cropMarks'] ),
		'guides'     => ! empty( $input['guides'] ),
		'background' => null,
		'elements'   => array(),
	);

	if ( ! empty( $input['background'] ) && is_array( $input['background'] ) ) {
		$background = ctbg_sanitize_background( $input['background'] );
		if ( is_wp_error( $background ) ) {
			return $background;
		}
		$design['background'] = $background;
	}

	if ( array_key_exists( 'elements', $input ) && null === $input['elements'] ) {
		// No elements yet: the editor adds the default ones.
		$design['elements'] = null;
	} elseif ( isset( $input['elements'] ) && is_array( $input['elements'] ) ) {
		// A badge never needs many elements; the limit keeps the option small.
		foreach ( array_slice( $input['elements'], 0, 50 ) as $element ) {
			$clean = ctbg_sanitize_element( $element );
			if ( null !== $clean ) {
				$design['elements'][] = $clean;
			}
		}
	}

	return $design;
}

/**
 * Checks and cleans one element. Unknown types and fields are dropped.
 * Positions and sizes are in millimeters from the top-left corner of the
 * trim box; text sizes are in points.
 *
 * @param mixed $input Element sent by the editor.
 * @return array|null Clean element, or null if it is not valid.
 */
function ctbg_sanitize_element( $input ) {
	if ( ! is_array( $input ) || empty( $input['type'] ) || ! in_array( $input['type'], array( 'text', 'qr', 'gravatar' ), true ) ) {
		return null;
	}

	$id = sanitize_key( $input['id'] ?? '' );
	if ( '' === $id ) {
		return null;
	}

	$element = array(
		'id'     => $id,
		'type'   => $input['type'],
		'x'      => ctbg_clamp_mm( $input['x'] ?? null, -500, 1000, 0 ),
		'y'      => ctbg_clamp_mm( $input['y'] ?? null, -500, 1000, 0 ),
		'width'  => ctbg_clamp_mm( $input['width'] ?? null, 1, 1000, 20 ),
		'height' => ctbg_clamp_mm( $input['height'] ?? null, 1, 1000, 10 ),
	);

	if ( 'text' === $input['type'] ) {
		$align = $input['align'] ?? 'center';
		$color = sanitize_hex_color( $input['color'] ?? '' );

		$element['content']   = mb_substr( sanitize_text_field( $input['content'] ?? '' ), 0, 500 );
		$element['font']      = mb_substr( sanitize_text_field( $input['font'] ?? 'Inter' ), 0, 100 );
		$element['weight']    = (string) min( 900, max( 100, absint( $input['weight'] ?? 400 ) ) );
		$element['size']      = ctbg_clamp_mm( $input['size'] ?? null, 4, 200, 16 );
		$element['minSize']   = ctbg_clamp_mm( $input['minSize'] ?? null, 4, 200, 10 );
		$element['color']     = $color ? $color : '#1e1e1e';
		$element['align']     = in_array( $align, array( 'left', 'center', 'right' ), true ) ? $align : 'center';
		$element['uppercase'] = ! empty( $input['uppercase'] );
		$element['shrink']    = ! empty( $input['shrink'] );
	}

	if ( 'gravatar' === $input['type'] ) {
		$shape    = $input['shape'] ?? 'round';
		$fallback = $input['fallback'] ?? '404';

		$element['shape']    = 'square' === $shape ? 'square' : 'round';
		$element['fallback'] = in_array( $fallback, array( '404', 'identicon', 'monsterid', 'wavatar', 'retro', 'robohash', 'image' ), true ) ? $fallback : '404';
	}

	return $element;
}

/**
 * Checks the background: an attachment of an accepted type. The pixel size
 * of images comes from WordPress; the page size of a PDF comes from the
 * editor, which reads it with PDF.js.
 *
 * @param array $input Background sent by the editor.
 * @return array|WP_Error Clean background.
 */
function ctbg_sanitize_background( $input ) {
	$id    = absint( $input['id'] ?? 0 );
	$mime  = $id ? get_post_mime_type( $id ) : '';
	$types = ctbg_background_types();

	if ( ! $mime || ! isset( $types[ $mime ] ) ) {
		return new WP_Error( 'ctbg_invalid_background', __( 'The background must be a PDF, PNG or JPG file from the Media Library.', 'camptix-badge-generator' ), array( 'status' => 400 ) );
	}

	$background = array(
		'id'   => $id,
		'type' => $types[ $mime ],
	);

	if ( 'pdf' === $background['type'] ) {
		$background['pageWidth']  = ctbg_clamp_mm( $input['pageWidth'] ?? null, 1, 2000, 0 );
		$background['pageHeight'] = ctbg_clamp_mm( $input['pageHeight'] ?? null, 1, 2000, 0 );
	} else {
		$meta                      = wp_get_attachment_metadata( $id );
		$background['pixelWidth']  = absint( $meta['width'] ?? ( $input['pixelWidth'] ?? 0 ) );
		$background['pixelHeight'] = absint( $meta['height'] ?? ( $input['pixelHeight'] ?? 0 ) );
	}

	return $background;
}

/**
 * The saved design, or the default one.
 *
 * @return array Design.
 */
function ctbg_get_design() {
	$design = get_option( 'ctbg_design' );
	if ( ! is_array( $design ) ) {
		return ctbg_default_design();
	}
	return $design;
}

/**
 * What the editor receives: the design plus data that is not stored in it,
 * such as the current URL of the background.
 *
 * @param array $design Design.
 * @return array Response.
 */
function ctbg_design_response( $design ) {
	$background = null;
	if ( ! empty( $design['background']['id'] ) ) {
		$id  = $design['background']['id'];
		$url = wp_get_attachment_url( $id );
		if ( $url ) {
			$background = array(
				'url'      => $url,
				'filename' => wp_basename( get_attached_file( $id ) ),
			);
		}
	}

	return array(
		'design'     => $design,
		'background' => $background,
	);
}

/**
 * Registers GET and POST /wp-json/ctbg/v1/design.
 */
function ctbg_register_design_route() {
	register_rest_route(
		'ctbg/v1',
		'/design',
		array(
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => 'ctbg_rest_get_design',
				'permission_callback' => 'ctbg_can_edit_badges',
			),
			array(
				'methods'             => WP_REST_Server::EDITABLE,
				'callback'            => 'ctbg_rest_save_design',
				'permission_callback' => 'ctbg_can_edit_badges',
			),
		)
	);
}
add_action( 'rest_api_init', 'ctbg_register_design_route' );

/**
 * Who can edit badges.
 *
 * @return bool Whether the current user can.
 */
function ctbg_can_edit_badges() {
	return current_user_can( 'manage_options' );
}

/**
 * REST callback: the saved design.
 *
 * @return WP_REST_Response The design.
 */
function ctbg_rest_get_design() {
	return rest_ensure_response( ctbg_design_response( ctbg_get_design() ) );
}

/**
 * REST callback: saves the design.
 *
 * @param WP_REST_Request $request Request whose JSON body is {design}.
 * @return WP_REST_Response|WP_Error The saved design.
 */
function ctbg_rest_save_design( $request ) {
	$params = $request->get_json_params();
	$design = ctbg_sanitize_design( $params['design'] ?? null );
	if ( is_wp_error( $design ) ) {
		return $design;
	}

	update_option( 'ctbg_design', $design, false );
	return rest_ensure_response( ctbg_design_response( $design ) );
}
