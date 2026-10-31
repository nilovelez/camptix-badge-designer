# Specification

Draft. It grows as Nilo defines the project; open points are listed at the end.

## Goal

A WordPress plugin for WordCamp sites that generates printed badges. Organizers place the attendees' CampTix fields over a background image in a visual editor, and get a print-ready PDF to send to a print shop.

Long-term goal: run on every WordCamp site, as part of WordCamp.org's badge plugin (see "Name, and the road to WordCamp.org" in `docs/decisions.md`). The plugin reads the attendees from CampTix when it is active, and from a CampTix CSV export on test sites without it (see Attendee data).

## Workflow

1. The organizer designs the badge background in any drawing program, leaving room for the fields. Templates with the trim, bleed and safe margins will be provided.
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

- When CampTix is active, as on WordCamp sites, the attendee list is read live from its `tix_attendee` posts (`includes/camptix.php`, milestone 8). It is built as the same table CampTix's own CSV export produces, with the same functions and hooks (`get_all_questions()`, `get_attendee_answers()`, the `camptix_attendee_report_*` filters), so both sources go through the same reader and a design works with either. The add-on columns (Username, Severe allergy…) get their English names by internal key, because the export translates its headers into the user's language. The editor is then under Tickets › Badge Designer.
- Without CampTix, on test sites, the list is read from a CampTix CSV export at a fixed path in `test-data/`, and the editor is Badges in the main menu. No CSV upload is planned for production.
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
- `WordPress.org Profile URL`, when present, is `https://wordpress.org/@<username>` and always matches `Username`.
- Names: many with accents and ñ, compound first names, last names of up to three words (29 characters in the sample), some written all in uppercase or all in lowercase.
- The same email address can appear on more than one ticket.

### Variables

The variables a text box can insert:

- First name, last name, and full name (first name + last name).
- The questions defined by the event (one variable per custom column), plus the common "First Time Attending" question.

Names are normalized before they are shown: only words written all in uppercase or all in lowercase change, so "maría" and "GARCÍA" become "María" and "García", while mixed-case words ("McDonald") stay as typed. Particles such as "de" or "del" stay in lowercase. The organizer can still turn a text box to uppercase as a style.

Never offered as variables: email addresses, buyer and payment data, and the sensitive common questions (severe allergy, accessibility needs). Every question the event adds stays available, whatever it asks (decided by Nilo); a site can still exclude one with the `ctbd_excluded_questions` filter.

### What reaches the browser

The server (`includes/attendees.php`, REST route `ctbd/v1/attendees`, administrators only) sends, per attendee: page number, Attendee ID, normalized first and last name, the validated username (empty when missing), the Gravatar hash, and the answers to the allowed questions.

- Email addresses never reach the browser: the server sends the SHA-256 Gravatar hash of the trimmed, lowercase address.
- Only tickets with status `Publish` get a badge; the others are counted and left out.
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

## Elements

The design is made of elements placed over the background. A new design starts with the most common ones already in place: the Gravatar, the QR code, the first name and the last name (Nilo confirmed it). They can be removed, and more can be added. Designs saved before elements existed get these four once; after that, removed elements never come back on their own.

Every element:

- Is dragged into place and resized with handles on its corners. Gravatars and QR codes stay square. While dragging, the element snaps to the center lines of the badge.
- Moves with the arrow keys (0.5 mm, 5 mm with Shift); Delete removes it, Escape deselects it.
- When selected, opens its properties in the Element tab, including its exact position and size in millimeters from the top-left corner of the trim.
- Is listed in the Elements panel of the Document tab, where it can be selected, deleted and moved up or down a layer.

New elements are added with the + button. Every change can be undone and redone (Ctrl+Z, Ctrl+Shift+Z); a whole drag is one step. The pagination in the toolbar steps through the attendees, and the canvas shows each one's data.

### Text box

- Holds text with variables, which are replaced with each attendee's data (for example the first name or the last name).
- Variables are written in braces: `{first_name}`, `{last_name}`, `{full_name}` and `{question:<key>}` for each event question. A selector inserts them. Unknown variables are printed as typed, so a typo is visible. Stray spaces left by an empty variable are removed.
- Always one line: text never wraps to a second line.
- Properties (decided by Nilo): font family, weight, size, color, alignment and uppercase. No shrink to fit, line height or letter spacing.
- Text that does not fit (decided by Nilo): it is never resized; it is cut at the edge of the box (starting from the left edge, so its beginning stays readable whatever the alignment) and the editor warns. The warning shows on the canvas for the attendee on screen, and the Attendees panel counts and lists the attendees affected, so they can be checked before printing.
- Color: picked from the site's color palette (the theme's `theme.json` palette and the custom colors; the WordPress default palette when the theme has none). The design stores the hex value, so the color survives an import on a site with another palette.
- Font families offered:
  - Inter, shipped with the plugin so it works out of the box, in weights 400, 600 and 700 (SIL Open Font License, accepted on WordPress.org). Chosen over Montserrat because it is narrower (long names fit), very legible at a distance, neutral over any background, and covers Latin Extended, Cyrillic, Greek and Vietnamese.
  - Every font installed on the site through the WordPress Font Library (Appearance > Fonts), including Google Fonts installed there.

### QR code

- Points to the attendee's WordPress.org profile: `https://profiles.wordpress.org/<username>/`, built from the `Username` column (not from the export's `wordpress.org/@<username>` URL).
- When the attendee has no valid username, the QR code is not drawn: its space stays empty, showing the background, and generation goes on.
- Black and white, no options.
- At least 20 × 20 mm (decided by Nilo): smaller codes may not scan once printed. The editor does not let it get smaller, and the server enforces it too.
- Generated in the browser with the LadyQR encoder (see Architecture).

### Gravatar

- Loaded by URL from Gravatar, never generated or stored by the plugin.
- The URL comes from the attendee's email address. Using the WordPress.org username instead is in `docs/backlog.md`.
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
- **Preview** shows the one-page PDF itself in the editor, rendered with PDF.js, with buttons to download it or open it in a new tab.
- **Stable order.** Attendees are numbered in purchase order, never alphabetically, so a new ticket never shifts existing ones: page 101 of a later batch is never someone already printed.

## Architecture

- The editor and almost all the work run in the browser, in JavaScript, fed with the attendee data.
- Everything that can be generated in the browser is generated there, with browser resources (QR codes, Gravatar hashes, layout, ideally the PDF). Earlier attempts at this tool generated and stored images on the server, and with large events the files and the memory and CPU needed became too big. Generated images are not stored.
- QR codes: the encoder from LadyQR (https://github.com/nilovelez/ladyqr, `assets/qr.js`): no dependencies, GPLv2, compatible with this plugin's GPL-2.0-or-later license.
- The final PDF may be generated in JavaScript (pdf-lib or jsPDF) or in PHP; to be decided.

## Personal data

CampTix exports contain real names and email addresses.

- Test exports live in `test-data/`, which is ignored by Git, as is every `*.csv` file. Never commit them, and never copy real data into documentation, examples or tests: invent it.

## Open points

- PDF generation in the browser or in PHP. A PDF background points to the browser: PDF.js to show it in the editor, and pdf-lib to embed its page as a vector background in the final PDF.
- Editor technology: to be decided as we test (proposal in `docs/decisions.md`).
- Full list of text box properties.

## Out of the first phase

- Several designs per site, or styles that depend on the ticket type (organizer, speaker, volunteer...).
