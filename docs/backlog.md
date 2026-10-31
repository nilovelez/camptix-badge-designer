# Backlog

Ideas and pending work that belong to no milestone yet. Nilo decides if and when each one goes into a milestone (`docs/milestones.md`).

## Gravatar from the WordPress.org username

Use the avatar of the attendee's WordPress.org profile when the CampTix email address has no Gravatar.

- The WordPress.org profile shows the Gravatar of that account's email address, which the export does not include; the CampTix address may be a different one.
- There is no public API that returns the avatar for a username. Reading it from the profile pages would mean fetching one page per attendee from the server (browsers cannot, because of CORS), which is slow and breaks if the page changes.
- Left out of milestone 5 for these reasons (October 2026).

## Quick jumps in the attendee pagination

Buttons to go to the next attendee without a QR code, without a Gravatar, or with text that is cut, to review them before printing. Nilo moved it here from milestone 5: it will probably be done another way (October 2026).
## Release zip

Build the release zip with `git archive` (see the `wp-agentic-workflow` skill). First decide whether `build/` is committed so `git archive` includes it, or the zip is built from the working tree after `npm run build`. Plugin Check already passes on a release-like copy (milestone 7). Nilo postponed it (October 2026).

## Translatable editor strings

The PHP strings are translatable, but the editor's JavaScript strings are plain English. Wrap them with `@wordpress/i18n` (`__`, `_n`, `sprintf`) and load the translations with `wp_set_script_translations()`, so organizers can use the editor in their language. Found in the milestone 7 review (October 2026).

## Attendees live from CampTix

Read the attendees from the site's CampTix tickets instead of a CSV in `test-data/`, so the plugin works on real WordCamp sites. `ctbg_get_attendees()` in `includes/attendees.php` is the single place to change. Planned since the start, out of the first phase.