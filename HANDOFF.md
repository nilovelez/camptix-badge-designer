# Handoff

Where the work stands, so anyone can pick it up. Update it at the end of every session. Working rules are in `AGENTS.md`.

## Current state

- Milestone 0 (plugin skeleton and development setup) is done and waiting for Nilo's review.
- The plugin only has its header and constants: it does nothing yet.
- WPCS is installed through Composer and `composer lint` is clean.
- A Studio site exists at `~/Studio/camptix-badge-generator` with the repo linked and the plugin active. It has not been started yet.
- The project is registered in Guppy with status `active`.

## Next steps

1. Nilo reviews milestone 0.
2. Nilo defines the project: what the CampTix export looks like, what the badges must contain, and how they are printed. The specification goes in `docs/specification.md` and the milestones in `docs/milestones.md`.

## Open questions

- Sample CampTix CSV export (real exports contain personal data: keep them out of Git).
- Badge size, badges per sheet and fields on each badge.
- Minimum WordPress version: 6.8 was chosen by default and can change.

## Resume

1. Read `AGENTS.md`.
2. `composer install`, then `composer lint`.
3. Start a test site as described in `AGENTS.md` and give Nilo its URL.
