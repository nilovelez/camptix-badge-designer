# Technical decisions

Proposals and decisions, with their reasons. A proposal becomes a decision when Nilo confirms it, usually after testing it.

## Name, and the road to WordCamp.org (decided by Nilo, October 2026)

The plugin was first called Camptix Badge Generator (`camptix-badge-generator`, prefix `ctbg`). By accident, that is also the name and folder of the badge plugin that WordCamp.org already runs, in the `WordPress/wordcamp.org` repo (`public_html/wp-content/plugins/camptix-badge-generator/`, next to CampTix, which now lives there too). The two could not be active on the same site, so this one was renamed **CampTix Badge Designer**: slug and text domain `camptix-badge-designer`, prefix `ctbd`, repo `nilovelez/camptix-badge-designer`. "WordCamp" stays out of the name: it is a trademark of the WordPress Foundation.

Why this plugin exists:

- WordCamp badges have been made in two ways. The official plugin renders them as HTML styled with CSS in the Customizer and prints them from the browser, which is limited. Or organizers export the CampTix CSV, process it with a script and lay the badges out with data merge in Adobe InDesign.
- The community asked for more useful badges ("Elevating individuals", https://make.wordpress.org/core/2026/04/11/elevating-individuals/; issue WordPress/wordcamp.org#1701): the WordPress.org username, hometown, website and company. The answers to the event's ticket questions (country, job, anything an event asks) are what make this possible.
- Nilo's earlier tool, camptix-to-canva (https://github.com/nilovelez/camptix-to-canva), turns the CSV into an `.xlsx` with the Gravatars and QR codes embedded, for Canva Bulk Create. It works, but it needs a local program and a paid Canva account.
- PR WordPress/wordcamp.org#2278 (October 2026) added the new fields to the official plugin and ported camptix-to-canva to generate the `.xlsx` on the WordCamp.org server. Embedding every image makes that export heavy on memory, disk and CPU, enough to put the server at risk on a big event. Nilo proposed splitting it: the fields went in as #2282, and the Canva export was put back to draft while he prepares this alternative.

The goal is to replace that Canva export with this plugin's approach: the PDF is generated in the organizer's browser, from a page of the WordCamp site, so the server only sends the attendee data.

The plan:

1. Keep developing this as a standalone plugin that can be installed like any other.
2. A Playground sandbox with the real CampTix, from the `WordPress/wordcamp.org` repo, and invented attendees, with this plugin reading them live (milestone 8).
3. Open the conversation upstream (#1701, #2278) with a link to that sandbox, so the WordCamp.org team can try it, ask for changes, or send pull requests to this repo.
4. Once they agree: fork `WordPress/wordcamp.org`, integrate the code into the official plugin as a new way to generate badges (for example `includes/pdf-badges.php` plus an npm workspace, using its namespace `CampTix\Badge_Generator`, its text domain `wordcamporg` and its badge fields), and send the pull request that takes the place of the Canva export.

## Editor: React with WordPress packages (proposal)

Build the editor with `@wordpress/element` (React) and `@wordpress/components`, compiled with `@wordpress/scripts`.

- It looks and behaves like the rest of the WordPress admin, with accessible controls (color picker, number and select fields, panels) ready to use.
- Translations work through `@wordpress/i18n`, the standard for plugins.
- WordPress loads React itself, so the plugin does not ship it.
- Drag and resize are done with pointer events on an absolutely positioned layer over the background, in millimeters scaled to the screen. That logic is small and fully under our control.

The milestone 1 spike used this stack for its admin page, and it worked. The editor (`src/editor/`, milestone 3) is built on it.

## Editor behavior (decided by Nilo, milestone 3)

- The editor lives inside the normal admin, with the admin bar and the admin menu (see the layout in `docs/milestones.md`).
- The design is saved automatically, one second after the last change, in the `ctbd_design` option through the REST route `ctbd/v1/design`. The toolbar shows "Saved", "Unsaved changes", "Saving…" or "Not saved". Leaving the page with unsaved changes asks for confirmation.
- The safe area is configurable, 5 mm inside the trim by default.
- The milestone 1 spike stayed under Badges › Technical test until real generation replaced it in milestone 6; its code was removed then (it is in the Git history).
- One Media Library frame is created and reused: a new frame each time adds another modal to the page.

## Screen and paper match (milestone 4)

- The text layout (`src/shared/text-layout.js`) and the QR code path (`src/shared/qr.js`) are shared by the editor and the future PDF generator.
- The editor measures text with fontkit, from the same font files the PDF will embed, and draws it with the browser using those same files (one CSS family per face, so the browser never synthesizes a weight). Checked: fontkit and the drawn width agree to 0.01 mm.
- Text is centered vertically by its ascent and descent, so the PDF can place the baseline at the same spot.
- Font Library fonts are usually WOFF2: the editor converts them to TTF before measuring, as the PDF has to (see the WOFF2 finding above). Only upright, single-weight faces are offered; variable fonts and italics are left out.
- Designs carry a format version (2 since elements). A design with no elements yet (version 1 from milestone 3, or `elements: null`) gets the default elements once, sized for its print size.

## PDF: generated in the browser with pdf-lib (decided; built in milestone 6)

- pdf-lib embeds a page of a PDF background as a vector object, so vector backgrounds stay vector, and the background is embedded once and reused on every page, which keeps large PDFs small.
- Text is real text with embedded fonts (pdf-lib with `@pdf-lib/fontkit`, subset to the glyphs in use), not images.
- QR codes are drawn from the LadyQR module matrix as one vector path per code (runs of dark modules), filled in a single operation so no hairlines appear between modules.
- Gravatars are fetched in the browser and embedded once per distinct email address.
- PDF.js renders PDF pages in the editor (a PDF background, or the first page of a generated PDF).

### Spike results (milestone 1)

Measured on the Playground test site with headless Chrome, 300 invented attendees, the sample vector background, Inter 700 and 600 subset, round Gravatars (identicons at 472 px) and crop marks:

| Step | Time |
|---|---|
| Fonts loaded and embedded | 0.01 s |
| Background (vector PDF) embedded | < 0.01 s |
| 300 Gravatars fetched and embedded, 8 at a time | 7.4 s |
| 300 pages laid out | 0.5 s |
| PDF saved | 3.2 s |
| **Total** | **11 s**, 6.9 MB, JS heap peak about 280 MB |

- Gravatar sends `Access-Control-Allow-Origin: *`: fetching from the browser works.
- PDF.js renders the first page in 0.1 s.
- QR codes decode correctly (checked with jsQR on pages rendered at 300 dpi); attendees without a username get no QR.
- Network time dominates. Generation is fast enough to run entirely in the browser; no server-side work is needed.

Gravatar sizes with the real test export (aggregate only): 78 of 174 addresses have a Gravatar, about 160 KB each at 472 px, 12 MB in total. Each image is embedded once, so a PDF for that event would be roughly 12 to 15 MB.

### Findings that change the plan

- **Gravatar ignores the requested format.** The `.png` or `.jpg` extension makes no difference: Gravatar returns the image as it was uploaded (in the sample, 49 PNG with transparency and 29 JPEG). The generator detects the format from the first bytes and embeds PNG or JPEG accordingly. PNG transparency is kept when the uploaded image has it.
- **"None" fallback uses `d=404`, not `d=blank`.** With `d=404`, attendees without a Gravatar get a 404 and nothing is downloaded or drawn, so the background shows through. `d=blank` returns tiny PNG files, some of which pdf-lib cannot decode. Browsers log every 404 in the console; that is expected.
- **Gravatar hashes are made on the server.** `crypto.subtle` only exists in secure contexts (HTTPS or localhost), so test sites reached by IP over HTTP do not have it. Since milestone 2 the server sends the hash instead of the email address, which also keeps email addresses out of the browser. The spike's JavaScript SHA-256 was removed with the spike.
- **WOFF2 fonts are converted to TTF first.** `@pdf-lib/fontkit` reads WOFF2 but crashes when it subsets it (`RangeError: Index out of range`). The current `fontkit` 2.x does not work with pdf-lib. Converting with `woff2-encoder` (MIT, WebAssembly, 288 KB, loaded only when a WOFF2 font is used) takes about 15 ms per font, and the result subsets fine.
- **Gravatar resolution.** The pixel size is computed from the element size at 300 dpi (40 mm → 472 px). Gravatar serves up to 2048 px.

### Milestone 2 check with the real test export

178 badges from the test CSV (69 without QR code), with real Gravatars where they exist (78 people) and identicons for the rest: 11.3 s, 18.6 MB. Gravatars: 145 PNG and 29 JPEG, none failed.

## Fonts (decided by Nilo)

The PDF needs the font files, not only CSS.

- The plugin ships one font, Inter 4.1, in weights 400, 600 and 700, as static TTF files in `fonts/inter/` with its SIL Open Font License (`OFL.txt`). Static TTF, not the variable font: embedding and subsetting variable fonts in a PDF is less reliable. Montserrat was considered and left out: it is wide (long names overflow) and has a strong personality; anyone who wants it can install it from the Font Library.
- The editor also offers every font installed through the WordPress Font Library (WordPress 6.5+), which stores the files on the site itself: no requests to Google from the admin, and the files are available to embed. Font Library files are usually WOFF2, converted to TTF before embedding (see above). Still to check: how to list those fonts and their files (the `wp_font_family` and `wp_font_face` post types, also in the REST API).

## Build (proposal)

- JavaScript is built with `@wordpress/scripts` into `build/`, which is ignored by Git: after cloning, run `npm install` and `npm run build`. The PDF.js worker is copied to `build/pdf.worker.min.js` by `tools/copy-pdf-worker.mjs`.
- To decide before the first release: whether to commit `build/` so `git archive` includes it, or build the release zip from the working tree.

## PDF generation (milestone 6)

- `src/editor/build-pdf.js` builds the PDF in the browser from the same layout code as the editor (`src/shared/`): text, QR codes and Gravatar URLs come out identical on screen and on paper.
- Each page is the trim size plus the bleed, plus 6 mm on every side for crop marks when they are on (118 × 168 mm by default).
- Embedded once and reused on every page: the background (a PDF stays vector), the fonts (subset to the glyphs in use), each distinct Gravatar and the fixed fallback image.
- Text boxes are clipped to their box, so text that does not fit is cut exactly as in the editor.
- Gravatars are requested at the element size at 300 dpi. Formats other than PNG and JPEG are converted to PNG in the browser. A failed download is counted and reported; it never stops the build.
- The build reports progress and can be cancelled. The file downloads as `badges-<first>-<last>.pdf`.
- Checked with invented attendees: every page has the right real text and a QR code that decodes to the right profile, or none without a username. With the real test export: 178 badges, 16.5 MB, 8.6 s, about 180 MB of JavaScript memory.