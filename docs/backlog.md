# Backlog

Ideas and pending work that belong to no milestone yet. Nilo decides if and when each one goes into a milestone (`docs/milestones.md`).

## Quick jumps in the attendee pagination

Buttons to go to the next attendee without a QR code, without a Gravatar, or with text that is cut, to review them before printing. Nilo moved it here from milestone 5: it will probably be done another way (October 2026).

## Release zip and built plugin

`build/` stays out of `main` (decided by Nilo, November 2026). Since milestone 9, a GitHub Action (`.github/workflows/dist.yml`) builds the plugin on every push to `main` and publishes it, ready to install, to the `dist` branch, with only what goes in the plugin (no `src/`, tests or docs); the public Playground demo installs it from there. Still to do: the release zip from the same branch (or attached to a GitHub release), and Plugin Check on it. Plugin Check already passes on a release-like copy (milestone 7).

## Integration into the official WordCamp.org badge plugin

Once the WordCamp.org team agrees (see "Name, and the road to WordCamp.org" in `docs/decisions.md`): fork `WordPress/wordcamp.org`, move the code into its `camptix-badge-generator` plugin following that repo's conventions, and send the pull request.