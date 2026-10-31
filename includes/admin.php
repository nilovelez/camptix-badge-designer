<?php
/**
 * Admin page: the badge editor (Badges).
 *
 * @package Camptix_Badge_Generator
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the Badges admin page.
 */
function ctbg_register_admin_page() {
	$GLOBALS['ctbg_admin_hook'] = add_menu_page(
		__( 'Badges', 'camptix-badge-generator' ),
		__( 'Badges', 'camptix-badge-generator' ),
		'manage_options',
		'ctbg-badges',
		'ctbg_render_editor_page',
		'dashicons-id-alt'
	);
}
add_action( 'admin_menu', 'ctbg_register_admin_page' );

/**
 * Whether an admin page is the editor.
 *
 * @param string $hook_suffix The admin page.
 * @return bool Whether it is the editor.
 */
function ctbg_is_editor_page( $hook_suffix ) {
	return ! empty( $GLOBALS['ctbg_admin_hook'] ) && $hook_suffix === $GLOBALS['ctbg_admin_hook'];
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
		echo '<div class="wrap"><div class="notice notice-error"><p>';
		echo esc_html__( 'The JavaScript build is missing. Run "npm install" and "npm run build" in the plugin folder.', 'camptix-badge-generator' );
		echo '</p></div></div>';
		return;
	}
	echo '<div id="ctbg-editor" class="ctbg-editor"></div>';
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
	if ( $screen && ctbg_is_editor_page( $screen->id ) ) {
		$classes .= ' ctbg-editor-page';
	}
	return $classes;
}
add_filter( 'admin_body_class', 'ctbg_admin_body_class' );

/**
 * Loads the editor script, its CSS and its settings, on the editor only.
 *
 * @param string $hook_suffix The current admin page.
 */
function ctbg_enqueue_admin_assets( $hook_suffix ) {
	$asset_file = CTBG_PLUGIN_DIR . 'build/editor.asset.php';
	if ( ! ctbg_is_editor_page( $hook_suffix ) || ! file_exists( $asset_file ) ) {
		return;
	}
	$asset = require $asset_file;

	// The Media Library modal, to pick the background and images.
	wp_enqueue_media();
	wp_enqueue_script( 'ctbg-editor', CTBG_PLUGIN_URL . 'build/editor.js', $asset['dependencies'], $asset['version'], true );
	wp_enqueue_style( 'ctbg-editor', CTBG_PLUGIN_URL . 'build/editor.css', array( 'wp-components' ), $asset['version'] );

	$settings = array(
		'pdfWorkerUrl' => CTBG_PLUGIN_URL . 'build/pdf.worker.min.js',
		'fontFamilies' => ctbg_get_fonts(),
		'palette'      => ctbg_get_palette(),
	);
	wp_add_inline_script( 'ctbg-editor', 'window.ctbgSettings = ' . wp_json_encode( $settings ) . ';', 'before' );
}
add_action( 'admin_enqueue_scripts', 'ctbg_enqueue_admin_assets' );
