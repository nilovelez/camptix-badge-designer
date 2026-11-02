# Backlog

Ideas and pending work that belong to no milestone yet. Nilo decides if and when each one goes into a milestone (`docs/milestones.md`).

## Gravatar from the WordPress.org username

Use the avatar of the attendee's WordPress.org profile when the CampTix email address has no Gravatar.

- The WordPress.org profile shows the Gravatar of that account's email address, which the export does not include; the CampTix address may be a different one.
- There is no public API that returns the avatar for a username. Reading it from the profile pages would mean fetching one page per attendee from the server (browsers cannot, because of CORS), which is slow and breaks if the page changes.
- Left out of milestone 5 for these reasons (October 2026).

## Quick jumps in the attendee pagination

Buttons to go to the next attendee without a QR code, without a Gravatar, or with text that is cut, to review them before printing. Nilo moved it here from milestone 5: it will probably be done another way (October 2026).

## Smaller editor script

`build/editor.js` is about 1.6 MB, and on a slow mobile connection the editor takes a few seconds to appear (a loading bar covers it since milestone 9). Most of it is pdf-lib and PDF.js: load them with a dynamic `import()` only when they are needed (the background preview and Generate PDF), so the editor itself loads first. Nilo agreed to note it here (November 2026).

## Release zip and built plugin

`build/` stays out of `main` (decided by Nilo, November 2026). Since milestone 9, a GitHub Action (`.github/workflows/dist.yml`) builds the plugin on every push to `main` and publishes it, ready to install, to the `dist` branch, with only what goes in the plugin (no `src/`, tests or docs); the public Playground demo installs it from there. Still to do: the release zip from the same branch (or attached to a GitHub release), and Plugin Check on it. Plugin Check already passes on a release-like copy (milestone 7).

## Integration into the official WordCamp.org badge plugin

Once the WordCamp.org team agrees (see "Name, and the road to WordCamp.org" in `docs/decisions.md`): fork `WordPress/wordcamp.org`, move the code into its `camptix-badge-generator` plugin following that repo's conventions, and send the pull request.