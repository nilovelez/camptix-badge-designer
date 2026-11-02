# Handoff

Where the work stands, so anyone can pick it up. Update it at the end of every session. Working rules are in `AGENTS.md`.

## Current state

- The plugin was renamed from Camptix Badge Generator to **CampTix Badge Designer** (`camptix-badge-designer`, prefix `ctbd`), because WordCamp.org already runs a plugin with the old name. Why, and the plan to take this to WordCamp.org, are in "Name, and the road to WordCamp.org" in `docs/decisions.md`. Read it first.
- Milestones 0 to 8 are done. Milestone 9 (public demo) is done and waiting for Nilo's review. Milestone 10 (present it) is almost done: the user guide on GitHub Pages (`guide/`, https://nilovelez.github.io/camptix-badge-designer/), the README, the proposal issue WordPress/wordcamp.org#2286, the comment on PR #2278 (closed by the WordCamp.org team, with #1701 and #572), the editor made translatable, the small-screen notice, the `{username}` variable and folded badges. Nilo has submitted the proposal post to the Make/Community blog and is waiting for it to be published. Milestone 11 (refinement) is planned and not started. Milestones, and the approved editor layout, are in `docs/milestones.md`.
- Texts Nilo publishes himself (issues, comments, posts) are given to him in the chat to copy, never written to the repo.
- **Public demo**: the link is in `AGENTS.md`. `sandbox/demo-blueprint.json` installs the real CampTix, the WordCamp sandbox from `main` and the built plugin from the `dist` branch, which `.github/workflows/dist.yml` rebuilds on every push to `main`. It opens on a sample design on the WordCamp Europe 2025 badge, with Matt Mullenweg as the first attendee (real public Gravatar and username) and invented attendees after him. Details in "Public demo" in `docs/decisions.md`.
- With CampTix active, the attendees come live from `tix_attendee` (`includes/camptix.php`), as the same table as CampTix's CSV export, and the editor is under Tickets › Badge Designer. Without CampTix it is **Badges** in the admin menu, and `includes/attendees.php` reads the newest CSV in `test-data/`. Both serve the REST route `ctbd/v1/attendees` (administrators only), without email addresses. Tests: `php tests/php/attendees-test.php` (no WordPress needed).
- The editor (`src/editor/`): toolbar with the + inserter, undo, redo and the attendee pagination; canvas with guides and the elements (text boxes, Gravatar, QR code); the Document and Element sidebar. It is fixed to the window and shows a loading bar while its script downloads. The background comes from the Media Library (PDF, PNG or JPG). The design is saved automatically in the `ctbd_design` option through the REST route `ctbd/v1/design` (`includes/design.php`, which also validates the elements), and can be exported and imported as JSON. Fonts (Inter and the Font Library) and the site palette come from `includes/fonts.php`. Preview badge and Generate PDF build the PDF in the browser (`src/editor/build-pdf.js`).
- `src/shared/` holds the text layout, the QR path and the Gravatar URL, shared by the editor and the PDF generator so screen and paper match.
- Ideas for later are in `docs/backlog.md`.
- Test backgrounds, all invented, are in `tests/fixtures/` (`tools/make-fixtures.mjs` rebuilds the PDFs). The demo background, `sandbox/demo-background.pdf`, is the real WordCamp Europe 2025 badge, provided by Nilo.
- Playground mounts the whole repo, so the CSV in `test-data/` can be downloaded from the test site by URL. Nilo accepted this: test sites are only reachable locally.
- A real CampTix export for testing is in `test-data/` (ignored by Git: it holds real names and emails).
- `composer lint` is clean; `npm run lint:js` has no errors (a few warnings). Plugin Check passes with no errors or warnings on a release-like copy (`git archive` plus `build/`), run in a second Playground with the plugin-check plugin (milestone 7).
- A Studio site exists at `~/Studio/camptix-badge-designer` (http://camptix-badge-designer.local/, PHP 8.3), with the repo linked as the plugin through a junction. The WordCamp sandbox in Playground is the usual test site now.

## Next steps

1. When the Make/Community post is published: give Nilo a short comment for #2286 with its link, and link it from the guide. Then present milestone 10 for review.
2. At the start of the next session, tell Nilo what is left to review in milestones 9 and 10.
3. Milestone 11 (refinement, five items in `docs/milestones.md`), after his OK.
4. If the WordCamp.org team agrees, the pull request that integrates the plugin into `camptix-badge-generator` (`docs/backlog.md`).

## Open questions

- Minimum WordPress version: 6.8 was chosen by default and can change.

## Resume

1. Read `AGENTS.md`.
2. `composer install`, then `composer lint`.
3. `npm install`, then `npm run build` (the build is not in Git).
4. Start a test site as described in `AGENTS.md` (usually the WordCamp sandbox) and give Nilo its URL. The editor is under **Tickets › Badge Designer**, or **Badges** on a site without CampTix.
