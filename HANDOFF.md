# Handoff

Where the work stands, so anyone can pick it up. Update it at the end of every session. Working rules are in `AGENTS.md`.

## Current state

- Milestone 3 (editor structure) is done and waiting for Nilo's review. Milestones, and the approved editor layout, are in `docs/milestones.md`.
- **Badges** in the admin menu is the editor (`src/editor/`): toolbar, canvas with guides, and the Document and Element sidebar. The background comes from the Media Library (PDF, PNG or JPG) and its size is checked against the print size. The design is saved automatically in the `ctbg_design` option through the REST route `ctbg/v1/design` (`includes/design.php`). Elements, the attendee pagination, undo, preview and generation are shown disabled until their milestones.
- **Badges › Technical test** holds the milestone 1 spike (`src/spike/`). Spike results and findings are in `docs/decisions.md`.
- `includes/attendees.php` reads the newest CSV in `test-data/` and serves the attendees at the REST route `ctbg/v1/attendees` (administrators only), without email addresses. Tests: `php tests/php/attendees-test.php` (no WordPress needed).
- Test backgrounds, all invented, are in `tests/fixtures/` (`tools/make-fixtures.mjs` rebuilds the PDFs).
- Playground mounts the whole repo, so the CSV in `test-data/` can be downloaded from the test site by URL. Nilo accepted this: test sites are only reachable locally.
- A real CampTix export for testing is in `test-data/` (ignored by Git: it holds real names and emails).
- `composer lint` is clean; `npm run lint:js` has no errors (a few JSDoc warnings).
- A Studio site exists at `~/Studio/camptix-badge-generator` with the repo linked and the plugin active. It has not been started.

## Next steps

1. Nilo reviews milestone 3 on the Playground site.
2. With his OK, milestone 4: text boxes.

## Open questions

- Gravatar from the WordPress.org username instead of the email.
- Whether `build/` is committed for releases (see `docs/decisions.md`).
- Minimum WordPress version: 6.8 was chosen by default and can change.

## Resume

1. Read `AGENTS.md`.
2. `composer install`, then `composer lint`.
3. `npm install`, then `npm run build` (the build is not in Git).
4. Start a test site as described in `AGENTS.md` and give Nilo its URL. The editor is under **Badges** in the admin menu.
