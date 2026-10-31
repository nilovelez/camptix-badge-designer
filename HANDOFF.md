# Handoff

Where the work stands, so anyone can pick it up. Update it at the end of every session. Working rules are in `AGENTS.md`.

## Current state

- Milestone 1 (technical spike) is done and waiting for Nilo's review. Milestones are in `docs/milestones.md`.
- The plugin adds a **Badges** admin page that, for now, holds the spike: it generates a test PDF of invented attendees in the browser and shows the timings. Code in `includes/admin.php` and `src/spike/`. Results and findings in `docs/decisions.md`.
- The project is defined in `docs/specification.md`, including the CampTix CSV format (checked against a real export).
- A real CampTix export for testing is in `test-data/` (ignored by Git: it holds real names and emails).
- `composer lint` is clean.
- A Studio site exists at `~/Studio/camptix-badge-generator` with the repo linked and the plugin active. It has not been started.

## Next steps

1. Nilo reviews milestone 1 on the Playground site.
2. With his OK, milestone 2: attendee data from the CSV.

## Open questions

- Whether the event's custom questions about dietary requirements are offered as variables (they can reveal sensitive data).
- Gravatar from the WordPress.org username instead of the email.
- Whether `build/` is committed for releases (see `docs/decisions.md`).
- Minimum WordPress version: 6.8 was chosen by default and can change.

## Resume

1. Read `AGENTS.md`.
2. `composer install`, then `composer lint`.
3. `npm install`, then `npm run build` (the build is not in Git).
4. Start a test site as described in `AGENTS.md` and give Nilo its URL. The spike is under **Badges** in the admin menu.
