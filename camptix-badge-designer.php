<?php
/**
 * Plugin Name:       CampTix Badge Designer
 * Description:       Design printed badges for CampTix attendees and get a print-ready PDF, generated in the browser.
 * Version:           0.1.0
 * Requires at least: 6.8
 * Requires PHP:      8.3
 * Author:            Nilo Vélez
 * Author URI:        https://profiles.wordpress.org/nilovelez/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       camptix-badge-designer
 *
 * @package CampTix_Badge_Designer
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CTBD_VERSION', '0.1.0' );
define( 'CTBD_PLUGIN_FILE', __FILE__ );
define( 'CTBD_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CTBD_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once CTBD_PLUGIN_DIR . 'includes/camptix.php';
require_once CTBD_PLUGIN_DIR . 'includes/attendees.php';
require_once CTBD_PLUGIN_DIR . 'includes/design.php';
require_once CTBD_PLUGIN_DIR . 'includes/fonts.php';

if ( is_admin() ) {
	require_once CTBD_PLUGIN_DIR . 'includes/admin.php';
}
