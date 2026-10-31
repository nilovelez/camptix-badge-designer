<?php
/**
 * Admin pages: the badge editor (Badges) and, until real generation
 * replaces it, the milestone 1 technical spike (Badges > Technical test).
 *
 * @package Camptix_Badge_Generator
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the admin pages.
 */
function ctbg_register_admin_pages() {
	$editor = add_menu_page(
		__( 'Badges', 'camptix-badge-generator' ),
		__( 'Badges', 'camptix-badge-generator' ),
		'manage_options',
		'ctbg-badges',
		'ctbg_render_editor_page',
		'dashicons-id-alt'
	);

	// Repeat the parent so the first submenu item is "Editor", not "Badges".
	add_submenu_page(
		'ctbg-badges',
		__( 'Badges', 'camptix-badge-generator' ),
		__( 'Editor', 'camptix-badge-generator' ),
		'manage_options',
		'ctbg-badges',
		'ctbg_render_editor_page'
	);

	$spike = add_submenu_page(
		'ctbg-badges',
		__( 'Technical test', 'camptix-badge-generator' ),
		__( 'Technical test', 'camptix-badge-generator' ),
		'manage_options',
		'ctbg-technical-test',
		'ctbg_render_spike_page'
	);

	$GLOBALS['ctbg_admin_hooks'] = array(
		'editor' => $editor,
		'spike'  => $spike,
	);
}
add_action( 'admin_menu', 'ctbg_register_admin_pages' );

/**
 * Which of our pages is being shown.
 *
 * @param string $hook_suffix The current admin page.
 * @return string 'editor', 'spike' or ''.
 */
function ctbg_current_page( $hook_suffix ) {
	if ( empty( $GLOBALS['ctbg_admin_hooks'] ) ) {
		return '';
	}
	$page = array_search( $hook_suffix, $GLOBALS['ctbg_admin_hooks'], true );
	return false === $page ? '' : $page;
}

/**
 * Prints the notice shown when the JavaScript has not been built.
 */
function ctbg_print_missing_build_notice() {
	echo '<div class="notice notice-error"><p>';
	echo esc_html__( 'The JavaScript build is missing. Run "npm install" and "npm run build" in the plugin folder.', 'camptix-badge-generator' );
	echo '</p></div>';
}

/**
 * Prints the container the editor renders into.
 */
function ctbg_render_editor_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	echo '<h1 class="screen-reader-text">' . esc_html__( 'Badges', 'camptix-badge-generator' ) . '</h1>';
	if ( ! file_exists( CTBG_PLUGIN_DIR . 'build/editor.asset.php' ) ) {
		echo '<div class="wrap">';
		ctbg_print_missing_build_notice();
		echo '</div>';
		return;
	}
	echo '<div id="ctbg-editor" class="ctbg-editor"></div>';
}

/**
 * Prints the container the spike renders into.
 */
function ctbg_render_spike_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	echo '<div class="wrap">';
	echo '<h1>' . esc_html__( 'Badges: technical test', 'camptix-badge-generator' ) . '</h1>';
	if ( ! file_exists( CTBG_PLUGIN_DIR . 'build/spike.asset.php' ) ) {
		ctbg_print_missing_build_notice();
	} else {
		echo '<div id="ctbg-spike"></div>';
	}
	echo '</div>';
}

/**
 * Adds a body class to the editor page, used by its CSS to fill the
 * space below the admin bar.
 *
 * @param string $classes Space-separated classes.
 * @return string Classes.
 */
function ctbg_admin_body_class( $classes ) {
	$screen = get_current_screen();
	if ( $screen && 'editor' === ctbg_current_page( $screen->id ) ) {
		$classes .= ' ctbg-editor-page';
	}
	return $classes;
}
add_filter( 'admin_body_class', 'ctbg_admin_body_class' );

/**
 * Enqueues a built script, its CSS if there is one, and its settings.
 *
 * @param string $name     Entry name in build/.
 * @param array  $settings Settings exposed as window.ctbgSettings.
 */
function ctbg_enqueue_build( $name, $settings ) {
	$asset_file = CTBG_PLUGIN_DIR . 'build/' . $name . '.asset.php';
	if ( ! file_exists( $asset_file ) ) {
		return;
	}
	$asset  = require $asset_file;
	$handle = 'ctbg-' . $name;

	wp_enqueue_script( $handle, CTBG_PLUGIN_URL . 'build/' . $name . '.js', $asset['dependencies'], $asset['version'], true );
	wp_enqueue_style( 'wp-components' );
	if ( file_exists( CTBG_PLUGIN_DIR . 'build/' . $name . '.css' ) ) {
		wp_enqueue_style( $handle, CTBG_PLUGIN_URL . 'build/' . $name . '.css', array( 'wp-components' ), $asset['version'] );
	}

	wp_add_inline_script( $handle, 'window.ctbgSettings = ' . wp_json_encode( $settings ) . ';', 'before' );
}

/**
 * Loads the scripts of our admin pages, only on those pages.
 *
 * @param string $hook_suffix The current admin page.
 */
function ctbg_enqueue_admin_assets( $hook_suffix ) {
	$page = ctbg_current_page( $hook_suffix );
	if ( '' === $page ) {
		return;
	}

	$settings = array(
		'pdfWorkerUrl' => CTBG_PLUGIN_URL . 'build/pdf.worker.min.js',
		'fonts'        => array(
			'400' => CTBG_PLUGIN_URL . 'fonts/inter/Inter-Regular.ttf',
			'600' => CTBG_PLUGIN_URL . 'fonts/inter/Inter-SemiBold.ttf',
			'700' => CTBG_PLUGIN_URL . 'fonts/inter/Inter-Bold.ttf',
		),
	);

	if ( 'editor' === $page ) {
		// The Media Library modal, to pick the background.
		wp_enqueue_media();
		ctbg_enqueue_build( 'editor', $settings );
		return;
	}

	$settings['woff2Url'] = CTBG_PLUGIN_URL . 'tests/fixtures/Inter-Regular.woff2';
	ctbg_enqueue_build( 'spike', $settings );
}
add_action( 'admin_enqueue_scripts', 'ctbg_enqueue_admin_assets' );
