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
2. A Playground sandbox with the real CampTix, from the `WordPress/wordcamp.org` repo, and invented attendees, with this plugin reading them live (milestone 8, done), and a public link to it, with the built plugin from the `dist` branch and a sample design (milestone 9).
3. Open the conversation upstream (#1701, #2278) with a link to that demo, so the WordCamp.org team can try it, ask for changes, or send pull requests to this repo (milestone 10: the proposal is WordPress/wordcamp.org#2286, opened by Nilo in November 2026).
4. Once they agree: fork `WordPress/wordcamp.org`, integrate the code into the official plugin as a new way to generate badges (for example `includes/pdf-badges.php` plus an npm workspace, using its namespace `CampTix\Badge_Generator`, its text domain `wordcamporg` and its badge fields), and send the pull request that takes the place of the Canva export.

## Editor: React with WordPress packages (decided)

The editor is built with `@wordpress/element` (React) and `@wordpress/components`, compiled with `@wordpress/scripts`.

- It looks and behaves like the rest of the WordPress admin, with accessible controls (color picker, number and select fields, panels) ready to use.
- Translations work through `@wordpress/i18n`, the standard for plugins (milestone 10). The ESLint rules of `@wordpress/scripts` check them: `sprintf` needs a literal format string (so a choice between two sentences is two `sprintf` calls, not a ternary inside one), and every placeholder needs a translators comment.
- WordPress loads React itself, so the plugin does not ship it.
- Drag and resize are done with pointer events on an absolutely positioned layer over the background, in millimeters scaled to the screen. That logic is small and fully under our control.

The milestone 1 spike used this stack for its admin page, and it worked. The editor (`src/editor/`, milestone 3) is built on it.

## Editor behavior (decided by Nilo, milestone 3)

- The editor lives inside the normal admin, with the admin bar and the admin menu (see the layout in `docs/milestones.md`).
- The design is saved automatically, one second after the last change, in the `ctbd_design` option through the REST route `ctbd/v1/design`. The toolbar shows "Saved", "Unsaved changes", "Saving…" or "Not saved". Leaving the page with unsaved changes asks for confirmation.
- The safe area is configurable, 5 mm inside the trim by default.
- The milestone 1 spike stayed under Badges › Technical test until real generation replaced it in milestone 6; its code was removed then (it is in the Git history).
- One Media Library frame is created and reused: a new frame each time adds another modal to the page.
- The editor is fixed to the window, like the block editor, from the admin bar down and from the admin menu to the right edge (milestone 9, asked for by Nilo): on sites with a long admin menu, the page scrolled and took the editor with it.
- PHP prints a loading bar in the editor's container, so it shows while the script downloads (slow on a mobile connection); the editor takes it over, without starting again, while it loads the design. The progress is not real (milestone 9, asked for by Nilo).
- Since milestone 11, pdf-lib is not in the editor script: `src/editor/components/pdf-dialogs.js` loads `build-pdf.js` with a dynamic `import()` the first time a PDF is made, and webpack puts it, with pdf-lib, in its own files in `build/`. `editor.js` went from 1.66 MB to 1.28 MB. PDF.js and fontkit stay in it, because the editor uses them from the start to draw a PDF background and to measure text (decided by Nilo). `pageGeometry()` moved to `geometry.js` so the dialogs can show the page size before pdf-lib loads.
- `Notice` from `@wordpress/components` renders its children to a string for screen readers when it has no `spokenMessage`. With buttons inside, their hooks then count as the notice's own, and React crashes when the number of buttons changes (the editor went blank). Every notice with buttons gets a plain-text `spokenMessage`.

## Screen and paper match (milestone 4)

- The text layout (`src/shared/text-layout.js`) and the QR code path (`src/shared/qr.js`) are shared by the editor and the PDF generator.
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

## The WordPress.org account: Gravatar and profile URL (milestone 12)

When the CampTix email address has no Gravatar, the Gravatar of the attendee's WordPress.org account is used. It recovers the photo of people who bought their ticket with an address other than their WordPress.org one.

- **Server side, on WordCamp.org only.** WordCamp.org shares its users with WordPress.org, so the server finds the account with `wcorg_get_user_by_canonical_names()` (`mu-plugins/3-helpers-misc.php` in WordPress/wordcamp.org, by login, then by nicename) and sends the SHA-256 hash of its email address as `accountGravatarHash`, only when it differs from the ticket's. Elsewhere the function does not exist and nothing changes (decided by Nilo after bor0's second review in #2286). The email address never leaves the server.
- **Ticket email first** (decided by Nilo). When an attendee has both hashes, the ticket's is asked with `d=404`, and only if it has no Gravatar is the account's asked, with the element's fallback. The editor and the PDF generator try them in order (`gravatarUrls()` in `src/shared/gravatar.js`), so the second request happens only when the first one misses.
- **Not the `wporg/v1/users` endpoint.** Researched in November 2026 and dropped on bor0's advice: `https://profiles.wordpress.org/wp-json/wporg/v1/users?slug=…` returns the account's Gravatar hash for up to 100 usernames per request, with CORS, but it is internal and nothing in meta depends on it.
- **Profile URL for the QR code.** Profile URLs are keyed on `user_nicename`, not on the login, and the two differ for logins with a dot or an `@`. The server sends `profileUrl`, in this order: the export's "WordPress.org Profile URL" column (`camptix-tweaks/addons/wporg-profile-url.php` on WordCamp.org, `https://wordpress.org/@<nicename>`); the account's nicename, when `wcorg_get_user_by_canonical_names()` exists; `https://profiles.wordpress.org/<login>/`, as before. `{username}` still prints the login (decided by Nilo).
- **Not tested here.** The sandbox has no stand-in for `wcorg_get_user_by_canonical_names()` (decided by Nilo): the PHP tests cover the logic, and `docs/integration-tests.md` lists what to check on WordCamp.org.
- **Whose username it is.** CampTix (`addons/require-login.php` in WordPress/wordcamp.org) gives each ticket its own username: the buyer's goes on the first ticket of the order, unless the buyer marks it as for an unknown attendee; the other tickets hold `[[ unconfirmed ]]` until each attendee logs in with their own account and confirms; a username can confirm only one ticket of an order. The plugin drops `[[ unconfirmed ]]`. So a company buying 10 tickets does not get 10 badges with the buyer's photo. The remaining gap is the first ticket, when the buyer registers it in someone else's name without marking it as unknown: it carries the buyer's username, which affects the QR code, `{username}` and now the account Gravatar.

## Activity tickets (milestone 12)

The camptix-companion-tickets add-on of WordCamp.org sells activity tickets (Contributor Day, a social dinner) as free attendee records for the same person, linked to the main one with `tix_companion_primary_attendee_id`. They are skipped when reading CampTix, so nobody gets a second badge, and counted in the attendee list. The admin flag the add-on sets goes on the main attendee, so the flag filter could not do this (found by bor0). The sandbox creates a Contributor Day ticket with 15 seats, as the add-on stores them, without installing the add-on.

## Names written in all caps or all lowercase (milestone 12)

A design option, `fixNames`, on by default (decided by Nilo): the server sends the fixed names, plus `firstNameAsTyped` and `lastNameAsTyped` when they differ, and the editor and the PDF use the ones the option asks for. No list of changed names (decided by Nilo: too much for what it gives); the Attendees panel says how many there are. No rule gets every name right ("bell hooks", "DI MARIA"), so the option lets organizers print names as typed.
## Fonts (decided by Nilo)

The PDF needs the font files, not only CSS.

- The plugin ships one font, Inter 4.1, in weights 400, 600 and 700, as static TTF files in `fonts/inter/` with its SIL Open Font License (`OFL.txt`). Static TTF, not the variable font: embedding and subsetting variable fonts in a PDF is less reliable. Montserrat was considered and left out: it is wide (long names overflow) and has a strong personality; anyone who wants it can install it from the Font Library.
- The editor also offers every font installed through the WordPress Font Library (WordPress 6.5+), which stores the files on the site itself: no requests to Google from the admin, and the files are available to embed. Font Library files are usually WOFF2, converted to TTF before embedding (see above). `includes/fonts.php` lists them from the `wp_font_family` and `wp_font_face` post types and their `_wp_font_face_file` meta. Active or not: deactivating a font only removes it from the global styles, the posts and files stay, so a font installed only for the badges can stay inactive and never load on the website (found by Nilo, November 2026). Fonts that come with the theme in `theme.json` are not listed: they are not in the Font Library, and in the default themes they are variable fonts anyway.

## Names in other scripts (decided by Nilo, milestone 13)

bor0 found in WordPress/wordcamp.org#2286 that CJK text printed "NO GLYPH" boxes in the PDF with no warning, while the canvas looked fine. What was checked (November 2026):

- **Inter lacks those scripts.** Inter 4.1 has Latin (Vietnamese included), Greek, Cyrillic and the ellipsis, and nothing for Japanese, Chinese, Korean, Devanagari, Bengali, Tamil, Arabic, Hebrew or Thai. The box in the PDF is Inter's own `.notdef` glyph. The canvas hid it because the browser falls back to a system font; the PDF only has the fonts it embeds.
- **pdf-lib draws them all** with a font that has them. Tested with the Noto fonts the Font Library installs from Google Fonts (WOFF2 converted to TTF, subset, `drawText`, as the plugin does): Japanese, Chinese, Korean, Devanagari, Bengali and Tamil (conjuncts and vowel signs right), Arabic (joined, right to left), Hebrew and Thai. Each one embeds in 10–150 ms, and a 140-page PDF carried 3–7 KB per font subset.
- **Bug: Indic fonts left the editor blank.** fontkit's Indic shaper is generator code compiled for `regenerator-runtime` and expects it as a global. WordPress registers that script but only loads it when something asks for it, so the editor now lists it as a dependency (`includes/admin.php`). The JavaScript tests load the same package.
- **No Noto font is bundled.** Noto is one family per script, and the CJK ones are 2–4 MB each per weight in WOFF2: Japanese, Korean and Chinese in three weights would add 25–30 MB to a plugin meant for the WordCamp.org repository, for fonts most events never use. Installing one from the Font Library is one click, and it can stay inactive (see Fonts).
- **Not every Noto font has full Latin.** Checked on the Font Library files: JP, KR and SC have basic Latin and Western accents, but not Ł, Ş, Ğ, Š, Č; Devanagari and Hebrew lack Ō; Bengali, Tamil and Thai have Central European but not Vietnamese; Arabic has no Latin letters at all. Hence the Inter fallback: a whole text prints in Inter when the box's font lacks something Inter has.
- **One font per text, never a mix.** Mixing fonts inside a line would change measuring, shrinking, cutting and drawing; one font per text keeps all of that as it was, and the fallback is chosen per attendee. A box that mixes Arabic and Latin can only be warned about.
- **How scripts are told apart:** Unicode script properties (`\p{Script=…}`), built at run time so the build does not expand them. Spaces, invisible format characters and variation selectors never count as missing. Han alone is reported as "Chinese or Japanese (kanji)".
- **Cut text** is cut between grapheme clusters (`Intl.Segmenter`), not code points, so an Indic consonant never loses its vowel sign.
- **Next phase, decided by Nilo (milestone 14):** a fallback font for each script the box's font lacks, chosen by the organizer, for events with names in several scripts.

## Build and the dist branch (decided by Nilo, milestone 9)

- JavaScript is built with `@wordpress/scripts` into `build/`, which is ignored by Git: after cloning, run `npm install` and `npm run build`. The PDF.js worker is copied to `build/pdf.worker.min.js` by `tools/copy-pdf-worker.mjs`.
- `build/` stays out of `main`. A GitHub Action (`.github/workflows/dist.yml`) builds the plugin on every push to `main` and publishes it to the `dist` branch: `git archive` (so `export-ignore` in `.gitattributes` leaves the development files out) plus `build/`. It commits on top of the branch's history, and only when something changed. Nobody commits to `dist` by hand.
- The `dist` branch exists for Playground: the public demo installs the plugin from it with a `git:directory` resource, which works both in the CLI and on playground.wordpress.net.
## Public demo (milestone 9)

- `sandbox/demo-blueprint.json`: the same WordCamp sandbox as `sandbox/blueprint.json`, but everything comes from GitHub (CampTix from `WordPress/wordcamp.org` at a fixed commit, the sandbox folder from `main`, the plugin from `dist`), so it runs on playground.wordpress.net from a link. It loads in about 40 s.
- The sandbox creates a sample design on the WordCamp Europe 2025 badge (102.5 × 149.2 mm with 5 mm bleed; background and layout provided by Nilo), unless the site already has a design. The design is written already complete, because the plugin may not be active yet, so its sanitizer does not run.
- The first attendee is Matt Mullenweg, with the email address and username he publishes himself (decided by Nilo): the demo opens on a badge with a real Gravatar and QR code. The other attendees are invented and have neither.
- Some ad blockers stop playground.wordpress.net from starting ("WordPress request transport did not start"); the demo then needs the blocker off for that site.

## PDF generation (milestone 6)

- `src/editor/build-pdf.js` builds the PDF in the browser from the same layout code as the editor (`src/shared/`): text, QR codes and Gravatar URLs come out identical on screen and on paper.
- Each page is the trim size plus the bleed, plus 6 mm on every side for crop marks when they are on (118 × 168 mm by default).
- Folded badges (milestone 10): the page drawing is one function that draws a face with its trim box at a fixed spot. The bottom face is drawn as is, clipped at the fold; the top one is drawn inside a 180° turn about the middle of its trim box (a `cm` operator), clipped at the fold in page space first, so its top bleed, which ends up below the fold, is cut away too. The background and the Gravatars stay embedded once.
- Embedded once and reused on every page: the background (a PDF stays vector), the fonts (subset to the glyphs in use), each distinct Gravatar and the fixed fallback image.
- Text boxes are clipped to their box. Since milestone 11 the layout already cuts the text after the last whole character that fits (after shrinking it to 80% at most), so the clip only guards against rounding. Since milestone 12 cut text ends with the ellipsis character, U+2026, not three periods; the cut leaves room for its width. Inter and practically every font has it.
- Lanyard hole mark (milestone 11): drawn inside the face, so on a folded badge the turned face gets its own mark and both meet at the fold.
- Gravatars are requested at the element size at 300 dpi. Formats other than PNG and JPEG are converted to PNG in the browser. A failed download is counted and reported; it never stops the build.
- The build reports progress and can be cancelled. The file downloads as `badges-<first>-<last>.pdf`.
- Checked with invented attendees: every page has the right real text and a QR code that decodes to the right profile, or none without a username. With the real test export: 178 badges, 16.5 MB, 8.6 s, about 180 MB of JavaScript memory.

### Stress test (milestone 11)

Asked for in bor0's review: does it hold at flagship size? Headless Chrome on the development computer, the sandbox design (vector PDF background, three text boxes, a Gravatar and a QR code), the sandbox attendees repeated with new Gravatar hashes, and every Gravatar answered with the same real 72 KB JPEG photo, so each attendee embeds its own image: the worst case, as if everyone had a Gravatar.

| Badges | Time | PDF | JS heap peak |
|---|---|---|---|
| 1,000 | 7.6 s | 71 MB | about 355 MB |
| 3,000 | 22.3 s | 214 MB | about 895 MB |

- It works and grows in a straight line: the background, the fonts and the QR codes cost almost nothing per page; the Gravatars are nearly all of it, about 70 KB each in the file and in memory, plus the PDF being saved.
- At 3,000 badges the file is too big to send comfortably, and a computer with little memory may struggle. A real event has photos for about half of its attendees (78 of 174 in the test export), so about half of this. The answer for now is the range: generate in batches of 500 to 1,000. The guide says so.
- If it is ever needed: re-encode the Gravatars as JPEG at the printed size before embedding them, or build each batch as its own PDF automatically.