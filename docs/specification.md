# Specification

What the plugin does, as built through milestone 9. It grows as Nilo defines the project; open points are listed at the end.

## Goal

A WordPress plugin for WordCamp sites that generates printed badges. Organizers place the attendees' CampTix fields over a background image in a visual editor, and get a print-ready PDF to send to a print shop.

Long-term goal: run on every WordCamp site, as part of WordCamp.org's badge plugin (see "Name, and the road to WordCamp.org" in `docs/decisions.md`). The plugin reads the attendees from CampTix when it is active, and from a CampTix CSV export on test sites without it (see Attendee data).

## Workflow

1. The organizer designs the badge background in any drawing program, leaving room for the fields. Templates with the trim, bleed and safe margins are planned (see Open points).
2. They upload the background in the editor. The editor detects its size and sets the print size and bleed (see below).
3. They place attendee fields over the background and style them. Some fields generate images (see below). The design is saved on the site.
4. They generate the PDF for the print shop.

## Background

- Designed in any tool (Canva, Figma, Photoshop...) from the provided templates, and exported as a reference file.
- Accepted formats: bitmap (PNG, JPG) or PDF. A PDF background may be vector and stays vector in the final PDF.
- The background is uploaded to the WordPress Media Library.

## Saved work

- One design per site (one WordCamp, one design) in the first phase. The rare event that needs variants, for example for organizers, exports the JSON, adjusts the design, generates those badges and goes back.
- The badge design (background, print size, bleed, fields and their styles) is saved on the site. When the organizer opens the editor again, it shows the work exactly as they left it. Example: the organizers of WordCamp Valencia upload their background, prepare their badges, and find everything as it was the next time they open the editor.
- The design can be exported to a JSON file and imported from it, for example to reuse last year's design on next year's WordCamp site. The JSON does not include the background: after importing it, the organizer uploads the background again, and every field keeps its position, fonts, colors and styles.
  - The file (`badge-design.json`) holds the print size, the options and the elements. Not exported: the background and the fixed Gravatar image, which are files of the site's Media Library; after importing, the Gravatar falls back to none until an image is chosen again.
  - Importing asks for confirmation, keeps the current background, and is one undo step. Fonts the site does not have are listed (the text uses Inter until they are installed). Files that are not a badge design, or come from a newer plugin version, are refused.
- Uninstalling the plugin deletes the design (the `ctbd_design` option). The background and the images stay in the Media Library.

## Attendee data

- When CampTix is active, as on WordCamp sites, the attendee list is read live from its `tix_attendee` posts (`includes/camptix.php`, milestone 8). It is built as the same table CampTix's own CSV export produces, with the same functions and hooks (`get_all_questions()`, `get_attendee_answers()`, the `camptix_attendee_report_*` filters), so both sources go through the same reader and a design works with either. The add-on columns (Username, Severe allergy…) get their English names by internal key, because the export translates its headers into the user's language. The editor is then under Tickets › Badge Designer, right after Setup, so it sits before Profile Badges on WordCamp.org (asked for by Nilo).
- Without CampTix, on test sites, the list is read from the newest CampTix CSV export in the plugin's `test-data/` folder, and the editor is Badges in the main menu. No CSV upload is planned for production.
- Attendee data is not part of the saved design.

### CampTix data model

From `WordPress/wordcamp.org` (`public_html/wp-content/plugins/camptix/`), where CampTix lives now:

- `tix_ticket`: ticket types. `tix_question`: the event's questions (`tix_type`, `tix_values`, `tix_required`), linked to tickets with `tix_question_id` and `tix_questions_order`.
- `tix_attendee`: one post per attendee, not per order. Statuses: `publish` (paid), `pending`, `draft` (checkout in progress), `cancel`, `failed`, `timeout`, `refund`. The export covers `publish` and `pending`.
- Attendee meta: `tix_first_name`, `tix_last_name`, `tix_email`, `tix_ticket_id`, `tix_timestamp`, `tix_access_token` (shared by an order; the buyer is the first), `tix_questions` (answers by question ID), and `tix_username` from the require-login add-on, which holds `[[ unconfirmed ]]` for a ticket not claimed yet.
- A ticket bought for an "unknown attendee" holds placeholder data (`Unknown Attendee`, `unknown.attendee@example.org`) until someone claims it. It gets no badge, from either source; the real export had one.

### CampTix CSV export format

Checked against a real export of 178 tickets (kept in `test-data/`, never committed):

- UTF-8 without BOM, comma-separated, LF line endings, one header row.
- Rows come sorted by `Attendee ID`, which grows with the purchase date. `Attendee ID` is the stable purchase order used to number the badges.
- Standard CampTix columns: `Attendee ID`, `Ticket Type`, `First Name`, `Last Name`, `E-mail Address`, `Purchase date` (`YYYY-MM-DD hh:mmam`), `Last Modified date`, `Status`, `Transaction ID`, `Coupon`, `Ticket Buyer Name`, `Ticket Buyer E-mail Address`, `Payment Method`, `WordPress.org Profile URL`, `Username`, `Attended the event`.
- Questions common to WordCamp sites, in English: `Severe allergy`, `Accessibility needs`, `First Time Attending`.
- Questions defined by each event, in its own language (for example "will you come on Sunday?" or dietary requirements). They change from one event to another, so columns are always read by header name, never by position.
- `Username` is often missing: about 39% of the tickets in the sample. It is either empty or holds the placeholder `Awaiting attendee ([[ unconfirmed ]])` (a ticket bought for someone who has not confirmed it yet). Anything with spaces is not a valid username and counts as missing.
- `WordPress.org Profile URL`, when present, is `https://wordpress.org/@<nicename>`. It usually matches `Username`, but profile URLs are keyed on the account's nicename, which differs from the login for logins with a dot or an `@`.
- Names: many with accents and ñ, compound first names, last names of up to three words (29 characters in the sample), some written all in uppercase or all in lowercase.
- The same email address can appear on more than one ticket.

### Variables

The variables a text box can insert:

- First name, last name, and full name (first name + last name).
- The WordPress.org username, printed as `@username` like the HTML badges of WordCamp.org, and nothing for attendees without one (asked for by Nilo, for WordPress/wordcamp.org#1701).
- The questions defined by the event, plus the common "First Time Attending" question. Live from CampTix, only the event's own questions (`tix_question`) count: other columns that add-ons put in the export, such as a phone number from a payment add-on or the admin flags, never become variables (bor0's review, milestone 11). A CSV export does not say which columns are questions, so there every column CampTix does not always export counts as one (test sites only).

Names are normalized before they are shown: only words written all in uppercase or all in lowercase change, so "maría" and "GARCÍA" become "María" and "García", while mixed-case words ("DeLuca") stay as typed. Each part after a hyphen or an apostrophe starts with a capital, and so does the letter after "Mc": "O'BRIEN" becomes "O'Brien" and "MCDONALD" becomes "McDonald" ("Mac" is left alone: Macías is not a Mac-name). Particles such as "de", "van" or "le" stay in lowercase only when a word that is not a particle comes after them ("de la Fuente", "van der Berg"); otherwise they are the name ("LE VAN" becomes "Le Van"). Rules based on patterns, with tests (decided by Nilo, milestone 11). Since milestone 12 it is a design option, "Fix names written in all caps or all lowercase", on by default: turned off, names print exactly as typed, for names that are written that way on purpose ("bell hooks"). The Attendees panel says how many attendees have a name written that way. The organizer can still turn a text box to uppercase as a style.

Never offered as variables: email addresses, buyer and payment data, and the sensitive common questions (severe allergy, accessibility needs). Every question the event adds stays available, whatever it asks (decided by Nilo); a site can still exclude one with the `ctbd_excluded_questions` filter.

### What reaches the browser

The server (`includes/attendees.php`, REST route `ctbd/v1/attendees`, administrators only) sends, per attendee: page number, Attendee ID, normalized first and last name (and the names as typed, when they differ), the validated username (empty when missing), the profile URL for the QR code, the Gravatar hash (and, on WordCamp.org, the hash of the WordPress.org account's email when it differs), the answers to the allowed questions, and the CampTix admin flags the attendee has (only live from CampTix, with the Admin Flags plugin).

- Email addresses never reach the browser: the server sends the SHA-256 Gravatar hash of the trimmed, lowercase address.
- Only tickets with status `Publish` get a badge; the others are counted and left out. Activity tickets (Contributor Day, a social dinner) from the camptix-companion-tickets add-on, which carry `tix_companion_primary_attendee_id`, get no badge either: they belong to the attendee's main ticket (bor0's review, milestone 12).
- Badges are numbered from 1 in `Attendee ID` order.

## Badge size

- Default: 100 × 150 mm (width × height, portrait) trim size, with 3 mm bleed on each side, so the background and each PDF page are 106 × 156 mm.
- Print size, bleed and safe area are configurable, so other badge sizes can be used. Limits: 20 to 500 mm per side, bleed up to 10 mm, safe area up to 30 mm (5 mm by default).
- When a background is chosen, the editor checks it against the current page with bleed:
  - A PDF has a physical page size. If it matches the page with bleed (within 0.5 mm), it is used as is. Otherwise the editor shows the PDF's page size and asks how much of it is bleed; the print size follows.
  - An image has pixels only. If its proportions match the page with bleed (within 1%), it is used as is. Otherwise the editor asks for the width and the bleed; the height follows the image's proportions.
  - If the print size is changed later and the background no longer matches, the editor warns that it is stretched and offers to adjust the print size.
- The editor shows the effective resolution of an image background at the chosen size and warns when it is too low for print (300 dpi recommended: 1252 × 1843 px for the default size).
- The editor shows the trim line and the safe area as guides, with the bleed dimmed; they are not printed and can be hidden.

- Crop marks: optional, drawn in the PDF the way print shops expect them, as short corner marks outside the bleed area, not as guide lines over the design. With crop marks on, each page grows to make room for them.
- Mark for the lanyard hole (asked for by Nilo, milestone 11): optional, on by default (changed by Nilo after milestone 12; a design saved without the setting gets it on). A small vertical line at the top center of every badge, 15 mm into the trim, starting in the bleed so it still reaches the edge if the cut is slightly off; black on a thin white outline, so it shows on any background. It marks the center, to help punch the hole with a hole punch; it does not set how far from the edge the hole goes (decided by Nilo). On a folded badge each face has it from the fold, so both marks meet when it is folded. Shown on the canvas too, and saved with the design (`holeMark`) and in the exported JSON.
- Elements that go past the trim, for example after the print size is made smaller, are marked in red on the canvas and listed in the Print size and Elements panels, with a button that moves them back inside (and shrinks them only if they are bigger than the badge). Half a millimeter is allowed, for rounding (bor0's review, milestone 11).
- Badge type (decided by Nilo, milestone 10): **single**, one face per page, printed on one side or both (the default); or **folded**, printed on a sheet twice as tall and folded in half. Either way only one face is designed. For a folded badge, each PDF page holds the face twice, joined at the fold: the bottom one upright and the top one turned 180°, each cut at its top edge so there is no bleed at the fold. The page is the trim width plus the bleed, by twice the trim height plus the bleed at the top and the bottom. With crop marks on, dashed fold marks are drawn on both sides at the fold, outside the bleed. The type is asked whenever a background is chosen, can be changed in the Print size panel, and is saved with the design (`folded`) and in the exported JSON.

## Elements

The design is made of elements placed over the background. A new design starts with the most common ones already in place: the Gravatar, the QR code, the first name and the last name (Nilo confirmed it). They can be removed, and more can be added. Designs saved before elements existed get these four once; after that, removed elements never come back on their own.

Every element:

- Is dragged into place and resized with handles on its corners. Gravatars and QR codes stay square. While dragging, the element snaps to the center lines of the badge.
- Moves with the arrow keys (0.5 mm, 5 mm with Shift); Delete removes it, Escape deselects it.
- When selected, opens its properties in the Element tab, including its exact position and size in millimeters from the top-left corner of the trim.
- Is listed in the Elements panel of the Document tab, where it can be selected, deleted and moved up or down a layer.

New elements are added with the + button. Every change can be undone and redone (Ctrl+Z, Ctrl+Shift+Z); a whole drag is one step. The pagination in the toolbar steps through the attendees, and so do Page Up and Page Down, except while typing in a field (asked for by Nilo, milestone 11); the canvas shows each one's data.

### Text box

- Holds text with variables, which are replaced with each attendee's data (for example the first name or the last name).
- Variables are written in braces: `{first_name}`, `{last_name}`, `{full_name}`, `{username}` and `{question:<key>}` for each event question. A selector inserts them. Unknown variables are printed as typed, so a typo is visible. Stray spaces left by an empty variable are removed, and so is one separator next to it (`·`, `•`, `|`, `/`, `,`, `;`, `:` or a dash): the one before it when there is text before, otherwise the one after, so "{job} · {country}" gives "Italy", not "· Italy". No separator setting in the interface (decided by Nilo, milestone 11, after bor0's review).
- Always one line: text never wraps to a second line (decided by Nilo: very long texts are usually people adding their company, job title or handle to the name).
- Properties (decided by Nilo): font family, weight, size, color, alignment and uppercase. No line height or letter spacing.
- Text that does not fit (decided by Nilo, changed in milestone 11 after bor0's review): it shrinks, down to 80% of its size. If it still does not fit, it is cut after the last whole character that fits, never in the middle of a letter (whole characters as a reader sees them, so an accent stays with its letter and an Indic syllable is never split, milestone 13), starting from the left so its beginning stays readable, and ends with an ellipsis, the "…" character (milestone 12); the editor warns. The warning shows on the canvas for the attendee on screen, and the Attendees panel counts and lists the attendees affected, so they can be checked before printing. In the demo, the attendees with cut text went from 14 to 2.
- Color: picked from the site's color palette (the theme's `theme.json` palette and the custom colors; the WordPress default palette when the theme has none), or any custom color with the picker (asked for by Nilo after milestone 12), always solid: no transparency, since the PDF draws text without it. The design stores the hex value, so the color survives an import on a site with another palette.
- Font families offered:
  - Inter, shipped with the plugin so it works out of the box, in weights 400, 600 and 700 (SIL Open Font License, accepted on WordPress.org). Chosen over Montserrat because it is narrower (long names fit), very legible at a distance, neutral over any background, and covers Latin Extended, Cyrillic, Greek and Vietnamese.
  - Every font installed on the site through the WordPress Font Library (Appearance > Fonts), including Google Fonts installed there, active or not. Deactivating a font in the Font Library only takes it out of the site's styles: its files stay installed and the editor still offers it. So a font meant only for the badges can stay inactive and add nothing to the event website's load (checked by Nilo with Montserrat 600, November 2026).
- Names in other scripts (milestone 13, after bor0's review): Inter covers Latin (Vietnamese included), Greek and Cyrillic, not CJK, Hangul, Indic scripts, Arabic, Hebrew or Thai. The editor checks every attendee's text against the font of each text box (`src/shared/scripts.js`):
  - Automatic fallback in a fixed order (decided by Nilo): each attendee's text prints in the first font that has all its characters: the box's own font; then Inter; then the Noto font of each script it still lacks, if it is installed in the Font Library, active or not (Noto Sans JP for Japanese, KR for Korean, Devanagari, Arabic, and so on; Han characters alone try Noto Sans SC, TC and JP). Always at the closest installed weight, on the canvas, in Preview badge and in the PDF. A whole text uses one font, never a mix, so measuring, shrinking and cutting work as with one font. Inter covers, for example, a Polish or Turkish name at an event that uses Noto Sans JP, which lacks some Central European letters. The fallback fonts load only when some attendee needs them. There is no setting to pick the fallback fonts: it would add nothing (decided by Nilo).
  - The warning under the font selector is a checklist of fonts to install: it counts the attendees no font can print yet, explains that the font is used as a fallback and can stay inactive, and lists by script the Noto font to install, with the scripts already printed by an installed fallback in green with a check. Once nothing is left to install, the warning goes and a note says how many attendees print in a fallback font, and which.
  - The Attendees panel has a table of the scripts the badges need beyond the box fonts: how many attendees use each, and the font that prints them (green, with a check) or the one to install. Below it, the attendees no font can print are listed with their scripts, like cut text, and the Generate PDF summary counts them. The PDF is still generated, as with cut text: the organizer decides.
  - The canvas shows those characters as they will print, as the font's empty boxes, never filled in from a system font, and marks the box in red with a warning, like cut text (asked for by Nilo: the canvas must never look right when the paper will not).
  - Han characters alone are reported as "Chinese or Japanese kanji", since they can be either; with kana, as Japanese.
  - A text that mixes two scripts no single installed font has, such as Arabic and Latin in one box (Noto Sans Arabic has no Latin letters), can only be warned about.
  - The sandbox, and so the public demo, installs Noto Sans JP, inactive, so the Japanese names show as solved and the other scripts still ask for a font.

### QR code

- Points to the attendee's WordPress.org profile (milestone 12, after bor0's review): the export's "WordPress.org Profile URL" when it has one; otherwise, on WordCamp.org, `https://wordpress.org/@<nicename>` from the account; otherwise `https://profiles.wordpress.org/<username>/`. `{username}` prints the login.
- When the attendee has no valid username, the QR code is not drawn: its space stays empty, showing the background, and generation goes on.
- Black on a white square by default. The only option is a transparent background, with no white square (asked for by Nilo, November 2026, for backgrounds that are light but not white; simpler than picking a background color). The editor warns that phones only read it on a light, plain background.
- At least 20 × 20 mm (decided by Nilo): smaller codes may not scan once printed. The editor does not let it get smaller, and the server enforces it too.
- Generated in the browser with the LadyQR encoder (see Architecture).

### Gravatar

- Loaded by URL from Gravatar, never generated or stored by the plugin.
- The URL comes from the attendee's email address. On WordCamp.org, when that address has no Gravatar, the one of the attendee's WordPress.org account is used (milestone 12): the ticket's is asked first with `d=404`, then the account's with the element's fallback.
- Gravatar returns each image in the format it was uploaded in (PNG or JPEG), whatever extension is requested. PNG images keep their transparency. The size requested is the element size at 300 dpi.
- Options, all simple:
  - Shape: round or square.
  - Fallback when the attendee has no Gravatar, using Gravatar's own default images (the `d` parameter): none (`d=404`: nothing is drawn), a fixed image, or a generated one (identicon, monster, wavatar, retro, robot).
  - Fixed image: the organizer's own image (for example the WordCamp logo), picked from the Media Library (decided by Nilo). The plugin asks Gravatar with `d=404` and draws this image itself when there is no Gravatar, instead of passing it to Gravatar as `d=<URL>`: that works on any site, local test sites included, and the PDF embeds the image once for every attendee who needs it.
- With "none", or when the image cannot be loaded at all (network error), nothing is drawn: the background shows through and generation never stops.
- An attendee without a valid email address has no Gravatar: they get the fixed image if there is one, and nothing otherwise (Gravatar's generated images need an address).
- In the editor, a dashed silhouette marks where a missing Gravatar would go; it is not printed.

## Preview and PDF generation

The model is data merge, as in Adobe InDesign: the design holds fields that act as variables, a data source (the attendees) is connected, and the design can be previewed with any record.

- The editor shows the design filled with one attendee, and the organizer can step through the attendees. This is how they check difficult cases: names with accents, very long names, attendees without a Gravatar.
- **Preview:** a button that generates a one-page PDF with the attendee currently shown in the editor, to check the result before generating everything.
- **Generate:** one page per attendee (300 tickets sold, 300 pages). Like a print dialog, the organizer chooses the range: all pages by default (1 to the last), or a range such as 1-100 or 250-300. Typical use: send the first 100 badges to the print shop, and generate 101 onwards later, when more tickets have been sold.
- **Before generating**, the dialog shows how many badges the range has, the page size, and how many of them have no QR code or have text that is cut. Generation shows its progress, can be cancelled, and downloads `badges-<first>-<last>.pdf`.
- **Admin flags** (milestone 11, after bor0's review): when the site uses CampTix admin flags, the dialog can print only the attendees with one flag, for example only the volunteers, within the range chosen; the file name ends with the flag. There is no filter by ticket type (decided by Nilo).
- **Preview** shows the one-page PDF itself in the editor, rendered with PDF.js, with buttons to download it or open it in a new tab.
- **Stable order.** Attendees are numbered in purchase order, never alphabetically, so a new ticket never shifts existing ones: page 101 of a later batch is never someone already printed.

## Architecture

- The editor and almost all the work run in the browser, in JavaScript, fed with the attendee data.
- Everything that can be generated in the browser is generated there, with browser resources (QR codes, Gravatar hashes, layout, ideally the PDF). Earlier attempts at this tool generated and stored images on the server, and with large events the files and the memory and CPU needed became too big. Generated images are not stored.
- QR codes: the encoder from LadyQR (https://github.com/nilovelez/ladyqr, `assets/qr.js`): no dependencies, GPLv2, compatible with this plugin's GPL-2.0-or-later license.
- The PDF is generated in the browser with pdf-lib, and PDF.js shows PDF pages in the editor (decided in milestone 1, built in milestone 6; see `docs/decisions.md`). The server only sends the design and the attendee data. pdf-lib is loaded the first time a PDF is made, not with the editor (milestone 11).
- The editor is built with the WordPress packages (`@wordpress/element`, `@wordpress/components`) and `@wordpress/scripts`. It fills the admin content area, fixed to the window like the block editor, and shows a loading bar while its script downloads. Below 960 × 560 pixels it shows a notice instead, printed by PHP and switched by CSS (asked for by Nilo): the badge and its settings do not fit side by side.
- Every string is translatable: PHP with `__()` and the editor with `@wordpress/i18n`, loaded with `wp_set_script_translations()` (milestone 10, asked for by Nilo before anything goes public).
- Distribution: `build/` is not in Git. A GitHub Action builds the plugin on every push to `main` and publishes it, ready to install, to the `dist` branch (milestone 9).

## Personal data

CampTix exports contain real names and email addresses.

- Test exports live in `test-data/`, which is ignored by Git, as is every `*.csv` file. Never commit them, and never copy real data into documentation, examples or tests: invent it.
- The WordCamp sandbox and the public demo use invented attendees. The only exception is the first one, Matt Mullenweg, with the email address and WordPress.org username he publishes himself, so the demo opens on a badge with a real Gravatar and QR code (decided by Nilo).
- Email addresses never reach the browser (see What reaches the browser), and the PDF holds only what the design prints.

## Public demo

A Playground link anyone can open (milestone 9; the link is in `AGENTS.md`). It installs the real CampTix from `WordPress/wordcamp.org`, the WordCamp sandbox from `main` and the built plugin from `dist`, and opens the editor with a sample design on the WordCamp Europe 2025 badge background (provided by Nilo), ready to generate the PDF of 140 badges.

## Open points

- Background templates with the trim, bleed and safe area marked, for the drawing programs organizers use.
## Out of the first phase

- Several designs per site, or styles that depend on the ticket type (organizer, speaker, volunteer...).
