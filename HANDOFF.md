# Handoff

Where the work stands, so anyone can pick it up. Update it at the end of every session. Working rules are in `AGENTS.md`.

## Current state

- Milestone 2 (attendee data) is done and waiting for Nilo's review. Milestones are in `docs/milestones.md`.
- `includes/attendees.php` reads the newest CSV in `test-data/` and serves the attendees at the REST route `ctbg/v1/attendees` (administrators only), without email addresses. Tests: `php tests/php/attendees-test.php` (no WordPress needed).
- The **Badges** admin page shows the attendee list (summary and table) and the milestone 1 spike, which can now generate the test PDF from the CSV attendees. Code in `includes/admin.php` and `src/spike/`. Spike results and findings in `docs/decisions.md`.
- Known issue: Playground mounts the whole repo, so the CSV in `test-data/` can be downloaded from the test site by URL. A fix is proposed to Nilo (keep the CSV outside the mounted folder).
- The project is defined in `docs/specification.md`, including the CampTix CSV format (checked against a real export).
- A real CampTix export for testing is in `test-data/` (ignored by Git: it holds real names and emails).
- `composer lint` is clean.
- A Studio site exists at `~/Studio/camptix-badge-generator` with the repo linked and the plugin active. It has not been started.

## Next steps

1. Nilo reviews milestone 2 on the Playground site.
2. With his OK, milestone 3: editor structure.

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
