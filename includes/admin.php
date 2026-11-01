<?php
/**
 * Admin page: the badge editor (Badges).
 *
 * @package CampTix_Badge_Designer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registers the editor page: Tickets > Badge Designer on sites with
 * CampTix, next to its other tools, and Badges in the main menu otherwise.
 */
function ctbd_register_admin_page() {
	if ( ctbd_camptix_is_active() ) {
		$GLOBALS['ctbd_admin_hook'] = add_submenu_page(
			'edit.php?post_type=tix_ticket',
			__( 'Badge Designer', 'camptix-badge-designer' ),
			__( 'Badge Designer', 'camptix-badge-designer' ),
			'manage_options',
			'ctbd-badges',
			'ctbd_render_editor_page'
		);
		return;
	}

	$GLOBALS['ctbd_admin_hook'] = add_menu_page(
		__( 'Badges', 'camptix-badge-designer' ),
		__( 'Badges', 'camptix-badge-designer' ),
		'manage_options',
		'ctbd-badges',
		'ctbd_render_editor_page',
		'dashicons-id-alt'
	);
}
add_action( 'admin_menu', 'ctbd_register_admin_page' );

/**
 * Whether an admin page is the editor.
 *
 * @param string $hook_suffix The admin page.
 * @return bool Whether it is the editor.
 */
function ctbd_is_editor_page( $hook_suffix ) {
	return ! empty( $GLOBALS['ctbd_admin_hook'] ) && $hook_suffix === $GLOBALS['ctbd_admin_hook'];
}

/**
 * Prints the container the editor renders into.
 */
function ctbd_render_editor_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	echo '<h1 class="screen-reader-text">' . esc_html__( 'Badges', 'camptix-badge-designer' ) . '</h1>';
	if ( ! file_exists( CTBD_PLUGIN_DIR . 'build/editor.asset.php' ) ) {
		echo '<div class="wrap"><div class="notice notice-error"><p>';
		echo esc_html__( 'The JavaScript build is missing. Run "npm install" and "npm run build" in the plugin folder.', 'camptix-badge-designer' );
		echo '</p></div></div>';
		return;
	}
	echo '<div id="ctbd-editor" class="ctbd-editor"></div>';
}

/**
 * Adds a body class to the editor page, used by its CSS to fill the
 * space below the admin bar.
 *
 * @param string $classes Space-separated classes.
 * @return string Classes.
 */
function ctbd_admin_body_class( $classes ) {
	$screen = get_current_screen();
	if ( $screen && ctbd_is_editor_page( $screen->id ) ) {
		$classes .= ' ctbd-editor-page';
	}
	return $classes;
}
add_filter( 'admin_body_class', 'ctbd_admin_body_class' );

/**
 * Loads the editor script, its CSS and its settings, on the editor only.
 *
 * @param string $hook_suffix The current admin page.
 */
function ctbd_enqueue_admin_assets( $hook_suffix ) {
	$asset_file = CTBD_PLUGIN_DIR . 'build/editor.asset.php';
	if ( ! ctbd_is_editor_page( $hook_suffix ) || ! file_exists( $asset_file ) ) {
		return;
	}
	$asset = require $asset_file;

	// The Media Library modal, to pick the background and images.
	wp_enqueue_media();
	wp_enqueue_script( 'ctbd-editor', CTBD_PLUGIN_URL . 'build/editor.js', $asset['dependencies'], $asset['version'], true );
	wp_enqueue_style( 'ctbd-editor', CTBD_PLUGIN_URL . 'build/editor.css', array( 'wp-components' ), $asset['version'] );

	$settings = array(
		'pdfWorkerUrl' => CTBD_PLUGIN_URL . 'build/pdf.worker.min.js',
		'fontFamilies' => ctbd_get_fonts(),
		'palette'      => ctbd_get_palette(),
	);
	wp_add_inline_script( 'ctbd-editor', 'window.ctbdSettings = ' . wp_json_encode( $settings ) . ';', 'before' );
}
add_action( 'admin_enqueue_scripts', 'ctbd_enqueue_admin_assets' );
