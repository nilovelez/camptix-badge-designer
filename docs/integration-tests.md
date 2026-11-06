# Tests for the integration into WordCamp.org

Some parts of the plugin only run on WordCamp.org, because they use functions or add-ons the sandbox does not have. The PHP tests (`tests/php/attendees-test.php`) cover their logic with stand-ins; this list is what to check on WordCamp.org's own code before the integration pull request is merged. See "The WordPress.org account: Gravatar and profile URL" and "Activity tickets" in `docs/decisions.md`.

There is no staging copy of the network, so run it on the local Docker setup of `WordPress/wordcamp.org` (suggested by bor0 in #2286):

1. Clone the fork of `WordPress/wordcamp.org` with the integration branch, and start the environment as its `.docker/readme.md` says (`docker compose up`; on Windows, Docker Desktop or Rancher Desktop; on macOS, Colima). Its sites are `*.wordcamp.test`, with `admin` / `password`.
2. It has the real mu-plugins (`wcorg_get_user_by_canonical_names()`, the "WordPress.org Profile URL" export column) and `camptix-companion-tickets`, which the sandbox does not.
3. Create test users there: in this environment the WordPress.org accounts are local users. Use email addresses you control, one with a Gravatar on the account's email only, and give the attendees those usernames. Never use or commit real attendee data.
4. Go through the lists below.

## Gravatar from the WordPress.org account

Runs when `wcorg_get_user_by_canonical_names()` exists.

1. An attendee whose ticket email has a Gravatar: the badge shows the ticket's Gravatar, and the browser asks Gravatar only once for that badge.
2. An attendee whose ticket email has no Gravatar, but whose WordPress.org account email has one: the badge shows the account's Gravatar, on the canvas, in Preview badge and in the generated PDF.
3. The same attendee with the Gravatar fallback set to a generated image (identicon) and to the fixed image: the account's Gravatar still wins over the fallback; with neither Gravatar, the fallback is used.
4. An attendee whose ticket email is the same as the account's: no `accountGravatarHash` in `/wp-json/ctbd/v1/attendees`.
5. A username that matches no account, and a ticket still at `[[ unconfirmed ]]`: no `accountGravatarHash`, no errors in the PHP log.
6. The REST response has no email address anywhere, only hashes.
7. A big event (a few thousand attendees): time `/wp-json/ctbd/v1/attendees` before and after, since it now looks up one account per attendee with a username.

## Profile URL in the QR code

1. The export has a "WordPress.org Profile URL" column (from `camptix-tweaks/addons/wporg-profile-url.php`): every QR code with a username decodes to that column's URL.
2. A login with a dot or an `@`, whose nicename differs: the QR code opens the right profile, `https://wordpress.org/@<nicename>`.
3. Without that column (the add-on turned off), the QR code uses the account's nicename; for a username with no account, `https://profiles.wordpress.org/<login>/`.
4. `{username}` still prints `@<login>`.

## Fonts for names in other scripts

1. Appearance › Fonts (`font-library.php`) opens for organizers, and the links in the badge editor's font warnings go there. If WordCamp.org turns the Font Library off (`fontLibraryEnabled` false, or a future `wp_is_font_library_enabled` filter), the warnings show no links: then decide with the WordCamp.org team how organizers get the Noto fonts.
2. A Noto font installed there and left inactive prints the names of its script as a fallback.

## Activity tickets

1. With camptix-companion-tickets active, an attendee with a main ticket and a Contributor Day seat gets one badge, and the attendee list counts the seat as an activity ticket left out.
2. The admin flag the add-on sets for the activity is offered in the Generate PDF dialog, and filtering by it prints the main attendees who signed up.
3. A seat whose main ticket was refunded or cancelled gives no badge.
