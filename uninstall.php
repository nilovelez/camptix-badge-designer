<?php
/**
 * Removes the plugin's data when it is uninstalled: the badge design.
 *
 * The background and the images it uses stay in the Media Library: they
 * belong to the site, not to the plugin.
 *
 * @package CampTix_Badge_Designer
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'ctbd_design' );
