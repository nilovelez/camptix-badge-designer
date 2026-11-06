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
 * Smallest window the editor works in, in CSS pixels. Keep in step with
 * $min-width and $min-height in src/editor/editor.scss.
 */
const CTBD_EDITOR_MIN_WIDTH  = 960;
const CTBD_EDITOR_MIN_HEIGHT = 560;

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
 * Moves Tickets > Badge Designer right after CampTix's Setup, so it sits
 * between Setup and the other badge tools (Profile Badges on WordCamp.org).
 * Runs after every plugin has added its items. Without Setup in the menu
 * nothing moves.
 */
function ctbd_move_submenu_item() {
	global $submenu;

	$parent = 'edit.php?post_type=tix_ticket';
	if ( empty( $submenu[ $parent ] ) || ! is_array( $submenu[ $parent ] ) ) {
		return;
	}

	$ours  = null;
	$items = array();
	foreach ( $submenu[ $parent ] as $item ) {
		if ( isset( $item[2] ) && 'ctbd-badges' === $item[2] ) {
			$ours = $item;
		} else {
			$items[] = $item;
		}
	}
	if ( null === $ours ) {
		return;
	}

	$sorted = array();
	$placed = false;
	foreach ( $items as $item ) {
		$sorted[] = $item;
		if ( isset( $item[2] ) && 'camptix_options' === $item[2] ) {
			$sorted[] = $ours;
			$placed   = true;
		}
	}
	if ( ! $placed ) {
		return;
	}

	// The keys set the order WordPress prints the items in.
	// phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited -- Reordering the menu is the point.
	$submenu[ $parent ] = $sorted;
}
add_action( 'admin_menu', 'ctbd_move_submenu_item', PHP_INT_MAX );

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
	// Shown while the editor script downloads, which can take a few seconds
	// on a slow connection. The editor replaces it with the same bar.
	echo '<div id="ctbd-editor" class="ctbd-editor">';
	echo '<div class="ctbd-editor__loading"><div class="ctbd-loading" role="status">';
	echo '<p>' . esc_html__( 'Loading the badge editor…', 'camptix-badge-designer' ) . '</p>';
	echo '<div class="ctbd-loading__bar"><div class="ctbd-loading__fill"></div></div>';
	echo '</div></div>';
	echo '</div>';

	// Shown instead of the editor on small screens, by editor.css.
	echo '<div class="ctbd-small-screen"><div class="ctbd-small-screen__box">';
	echo '<h2>' . esc_html__( 'Your screen is too small for the badge editor', 'camptix-badge-designer' ) . '</h2>';
	echo '<p>' . esc_html(
		sprintf(
			/* translators: 1: minimum width, 2: minimum height, in pixels. */
			__( 'The badge editor needs a window of at least %1$d × %2$d pixels, to show the badge and its settings side by side. Open this page on a computer, or make the window bigger.', 'camptix-badge-designer' ),
			CTBD_EDITOR_MIN_WIDTH,
			CTBD_EDITOR_MIN_HEIGHT
		)
	) . '</p>';
	echo '</div></div>';
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
	// fontkit shapes Indic scripts with generator code compiled for
	// regenerator-runtime, which it expects as a global; WordPress ships it
	// but loads it only when a script asks. Without it, a Devanagari font
	// stops the editor (milestone 13).
	$dependencies = array_merge( $asset['dependencies'], array( 'regenerator-runtime' ) );
	wp_enqueue_script( 'ctbd-editor', CTBD_PLUGIN_URL . 'build/editor.js', $dependencies, $asset['version'], true );
	// The editor's strings, translated on translate.wordpress.org like the PHP ones.
	wp_set_script_translations( 'ctbd-editor', 'camptix-badge-designer' );
	wp_enqueue_style( 'ctbd-editor', CTBD_PLUGIN_URL . 'build/editor.css', array( 'wp-components' ), $asset['version'] );

	$settings = array(
		'pdfWorkerUrl' => CTBD_PLUGIN_URL . 'build/pdf.worker.min.js',
		'fontFamilies' => ctbd_get_fonts(),
		'palette'      => ctbd_get_palette(),
		// Where to install fonts, or empty when the Font Library is off.
		'fontLibrary'  => ctbd_font_library_url(),
	);
	wp_add_inline_script( 'ctbd-editor', 'window.ctbdSettings = ' . wp_json_encode( $settings ) . ';', 'before' );
}
add_action( 'admin_enqueue_scripts', 'ctbd_enqueue_admin_assets' );
