<?php
/**
 * Plugin Name:       Camptix Badge Generator
 * Description:       Processes CampTix CSV export files and generates PDF badges ready to print.
 * Version:           0.1.0
 * Requires at least: 6.8
 * Requires PHP:      8.3
 * Author:            Nilo Vélez
 * Author URI:        https://profiles.wordpress.org/nilovelez/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       camptix-badge-generator
 *
 * @package Camptix_Badge_Generator
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CTBG_VERSION', '0.1.0' );
define( 'CTBG_PLUGIN_FILE', __FILE__ );
define( 'CTBG_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CTBG_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once CTBG_PLUGIN_DIR . 'includes/attendees.php';
require_once CTBG_PLUGIN_DIR . 'includes/design.php';

if ( is_admin() ) {
	require_once CTBG_PLUGIN_DIR . 'includes/admin.php';
}
