<?php
/**
 * Admin page.
 *
 * For milestone 1 the page holds the technical spike: it generates a test
 * PDF in the browser to measure the proposed stack. The editor replaces it
 * in later milestones.
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
	$hook = add_menu_page(
		__( 'Badges', 'camptix-badge-generator' ),
		__( 'Badges', 'camptix-badge-generator' ),
		'manage_options',
		'ctbg-badges',
		'ctbg_render_admin_page',
		'dashicons-id-alt'
	);

	add_action( 'admin_enqueue_scripts', 'ctbg_enqueue_admin_assets' );
	$GLOBALS['ctbg_admin_hook'] = $hook;
}
add_action( 'admin_menu', 'ctbg_register_admin_page' );

/**
 * Prints the container the JavaScript app renders into.
 */
function ctbg_render_admin_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	echo '<div class="wrap">';
	echo '<h1>' . esc_html__( 'Badges: technical spike', 'camptix-badge-generator' ) . '</h1>';

	if ( ! file_exists( CTBG_PLUGIN_DIR . 'build/spike.asset.php' ) ) {
		echo '<div class="notice notice-error"><p>';
		echo esc_html__( 'The JavaScript build is missing. Run "npm install" and "npm run build" in the plugin folder.', 'camptix-badge-generator' );
		echo '</p></div></div>';
		return;
	}

	echo '<div id="ctbg-spike"></div>';
	echo '</div>';
}

/**
 * Loads the spike script and its settings on the Badges page only.
 *
 * @param string $hook_suffix The current admin page.
 */
function ctbg_enqueue_admin_assets( $hook_suffix ) {
	if ( empty( $GLOBALS['ctbg_admin_hook'] ) || $hook_suffix !== $GLOBALS['ctbg_admin_hook'] ) {
		return;
	}

	$asset_file = CTBG_PLUGIN_DIR . 'build/spike.asset.php';
	if ( ! file_exists( $asset_file ) ) {
		return;
	}
	$asset = require $asset_file;

	wp_enqueue_script(
		'ctbg-spike',
		CTBG_PLUGIN_URL . 'build/spike.js',
		$asset['dependencies'],
		$asset['version'],
		true
	);
	wp_enqueue_style( 'wp-components' );

	$settings = array(
		'pdfWorkerUrl' => CTBG_PLUGIN_URL . 'build/pdf.worker.min.js',
		'fonts'        => array(
			'400' => CTBG_PLUGIN_URL . 'fonts/inter/Inter-Regular.ttf',
			'600' => CTBG_PLUGIN_URL . 'fonts/inter/Inter-SemiBold.ttf',
			'700' => CTBG_PLUGIN_URL . 'fonts/inter/Inter-Bold.ttf',
		),
		'woff2Url'     => CTBG_PLUGIN_URL . 'tests/fixtures/Inter-Regular.woff2',
	);

	wp_add_inline_script(
		'ctbg-spike',
		'window.ctbgSpike = ' . wp_json_encode( $settings ) . ';',
		'before'
	);
}
