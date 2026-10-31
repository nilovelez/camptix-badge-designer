# Handoff

Where the work stands, so anyone can pick it up. Update it at the end of every session. Working rules are in `AGENTS.md`.

## Current state

- The plugin was renamed from Camptix Badge Generator to **CampTix Badge Designer** (`camptix-badge-designer`, prefix `ctbd`), because WordCamp.org already runs a plugin with the old name. Why, and the plan to take this to WordCamp.org, are in "Name, and the road to WordCamp.org" in `docs/decisions.md`. Read it first.
- Milestones 0 to 7 are done. Milestone 8 (WordCamp sandbox with the real CampTix, attendees read live) is proposed and waits for Nilo's OK. Milestones, and the approved editor layout, are in `docs/milestones.md`.
- **Badges** in the admin menu is the editor (`src/editor/`): toolbar with the + inserter, undo, redo and the attendee pagination; canvas with guides and the elements (text boxes, Gravatar, QR code), which can be selected, dragged, resized and nudged; the Document and Element sidebar. The background comes from the Media Library (PDF, PNG or JPG). The design is saved automatically in the `ctbd_design` option through the REST route `ctbd/v1/design` (`includes/design.php`, which also validates the elements). Fonts (Inter and the Font Library) and the site palette come from `includes/fonts.php`. Preview badge and Generate PDF build the PDF in the browser (`src/editor/build-pdf.js`).
- `src/shared/` holds the text layout, the QR path and the Gravatar URL, shared by the editor and the PDF generator so screen and paper match.
- Ideas for later are in `docs/backlog.md`.
- The milestone 1 spike was removed in milestone 6; its results and findings are in `docs/decisions.md`.
- `includes/attendees.php` reads the newest CSV in `test-data/` and serves the attendees at the REST route `ctbd/v1/attendees` (administrators only), without email addresses. Tests: `php tests/php/attendees-test.php` (no WordPress needed).
- Test backgrounds, all invented, are in `tests/fixtures/` (`tools/make-fixtures.mjs` rebuilds the PDFs).
- Playground mounts the whole repo, so the CSV in `test-data/` can be downloaded from the test site by URL. Nilo accepted this: test sites are only reachable locally.
- A real CampTix export for testing is in `test-data/` (ignored by Git: it holds real names and emails).
- `composer lint` is clean; `npm run lint:js` has no errors (a few JSDoc warnings). Plugin Check passes with no errors or warnings on a release-like copy (`git archive` plus `build/`), run in a second Playground with the plugin-check plugin.
- A Studio site exists under its old name, `~/Studio/camptix-badge-generator`, with the repo linked as `camptix-badge-generator`. It has not been started, and the rename broke it (the main file is now `camptix-badge-designer.php`): recreate it after renaming the local folder.

## Next steps

1. Rename the local folder `D:\repos\camptix-badge-generator` to `camptix-badge-designer` (with no Claude Code session open in it), and recreate the Studio site.
2. Milestone 8, when Nilo gives the OK.

## Open questions

- Minimum WordPress version: 6.8 was chosen by default and can change.

## Resume

1. Read `AGENTS.md`.
2. `composer install`, then `composer lint`.
3. `npm install`, then `npm run build` (the build is not in Git).
4. Start a test site as described in `AGENTS.md` and give Nilo its URL. The editor is under **Badges** in the admin menu.
