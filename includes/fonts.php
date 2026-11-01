<?php
/**
 * Fonts and colors offered by the editor.
 *
 * @package CampTix_Badge_Designer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Font families the editor offers: Inter, shipped with the plugin, and the
 * fonts installed through the WordPress Font Library. Only upright faces
 * with a single weight are listed: italics are not needed on a badge, and
 * variable fonts do not subset reliably in a PDF.
 *
 * @return array[] Families: {family, source, faces: [{weight, url}]}.
 */
function ctbd_get_fonts() {
	$fonts = array(
		array(
			'family' => 'Inter',
			'source' => 'plugin',
			'faces'  => array(
				array(
					'weight' => '400',
					'url'    => CTBD_PLUGIN_URL . 'fonts/inter/Inter-Regular.ttf',
				),
				array(
					'weight' => '600',
					'url'    => CTBD_PLUGIN_URL . 'fonts/inter/Inter-SemiBold.ttf',
				),
				array(
					'weight' => '700',
					'url'    => CTBD_PLUGIN_URL . 'fonts/inter/Inter-Bold.ttf',
				),
			),
		),
	);

	if ( ! function_exists( 'wp_get_font_dir' ) ) {
		return $fonts;
	}

	$font_dir = wp_get_font_dir();
	$families = get_posts(
		array(
			'post_type'      => 'wp_font_family',
			'post_status'    => 'publish',
			'posts_per_page' => 100,
			'orderby'        => 'title',
			'order'          => 'ASC',
		)
	);

	foreach ( $families as $family ) {
		$faces = get_posts(
			array(
				'post_type'      => 'wp_font_face',
				'post_status'    => 'publish',
				'post_parent'    => $family->ID,
				'posts_per_page' => 100,
			)
		);

		$list = array();
		foreach ( $faces as $face ) {
			$settings = json_decode( $face->post_content, true );
			$style    = $settings['fontStyle'] ?? 'normal';
			$weight   = (string) ( $settings['fontWeight'] ?? '400' );
			if ( 'normal' !== $style || ! preg_match( '/^\d{3}$/', $weight ) ) {
				continue;
			}

			$file = get_post_meta( $face->ID, '_wp_font_face_file', true );
			if ( $file ) {
				$url = trailingslashit( $font_dir['url'] ) . $file;
			} elseif ( isset( $settings['src'] ) && is_string( $settings['src'] ) ) {
				$url = $settings['src'];
			} else {
				continue;
			}

			$list[] = array(
				'weight' => $weight,
				'url'    => $url,
			);
		}

		if ( empty( $list ) ) {
			continue;
		}

		usort(
			$list,
			function ( $a, $b ) {
				return (int) $a['weight'] - (int) $b['weight'];
			}
		);

		$fonts[] = array(
			'family' => $family->post_title,
			'source' => 'library',
			'faces'  => $list,
		);
	}

	return $fonts;
}

/**
 * Colors offered for text: the theme palette and the custom colors, or the
 * WordPress default palette when the theme has none.
 *
 * @return array[] Colors: {name, color}.
 */
function ctbd_get_palette() {
	$palette = wp_get_global_settings( array( 'color', 'palette' ) );
	$colors  = array();

	foreach ( array( 'theme', 'custom' ) as $origin ) {
		if ( ! empty( $palette[ $origin ] ) && is_array( $palette[ $origin ] ) ) {
			$colors = array_merge( $colors, $palette[ $origin ] );
		}
	}

	if ( empty( $colors ) && ! empty( $palette['default'] ) && is_array( $palette['default'] ) ) {
		$colors = $palette['default'];
	}

	$clean = array();
	foreach ( $colors as $color ) {
		$hex = sanitize_hex_color( $color['color'] ?? '' );
		if ( $hex ) {
			$clean[] = array(
				'name'  => $color['name'] ?? $hex,
				'color' => $hex,
			);
		}
	}

	return $clean;
}
