# Specification

Draft. It grows as Nilo defines the project; open points are listed at the end.

## Goal

A WordPress plugin for WordCamp sites that generates printed badges. Organizers place the attendees' CampTix fields over a background image in a visual editor, and get a print-ready PDF to send to a print shop.

Long-term goal: read the attendees from CampTix directly and run on every WordCamp site. Until then, development happens on test sites, with a CampTix CSV export as the attendee source (see Attendee data).

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

## Attendee data

- On test sites, the attendee list is read from a CampTix CSV export at a fixed path in `test-data/`.
- On real WordCamp sites, the attendee list will be read live from the site's CampTix attendees. No CSV upload is planned for production.
- Attendee data is not part of the saved design.

## Badge size

- Default: 100 × 150 mm (width × height, portrait) trim size, with 3 mm bleed on each side, so the background and each PDF page are 106 × 156 mm.
- Print size and bleed are configurable, so other badge sizes can be used.
- When a background image is uploaded, the editor reads its pixel dimensions:
  - If its aspect ratio matches the current print size plus bleed (106 × 156 mm by default), it is used as is.
  - Otherwise, the editor asks for the print size and the bleed.
- The editor shows the effective resolution of the background at the chosen size and warns when it is too low for print (300 dpi recommended: 1252 × 1843 px for the default size).
- The editor shows the trim line and the safe area as guides; they are not printed.

## Fields

- Text fields: any attendee field (a CSV column on test sites), placed and styled (font, size, color, alignment, weight).
- Image fields generated from an attendee field:
  - QR code from a URL (for example the attendee's WordPress.org profile).
  - Gravatar avatar from the email address.
- WordPress.org username: a required field on every ticket. From it the plugin derives the profile URL, `https://profiles.wordpress.org/<username>/`, and one of the elements that can be placed on the badge is a QR code pointing to that profile.

## Preview and PDF generation

The model is data merge, as in Adobe InDesign: the design holds fields that act as variables, a data source (the attendees) is connected, and the design can be previewed with any record.

- The editor shows the design filled with one attendee, and the organizer can step through the attendees. This is how they check difficult cases: names with accents, very long names, attendees without a Gravatar.
- **Preview:** a button that generates a one-page PDF with the attendee currently shown in the editor, to check the result before generating everything.
- **Generate:** one page per attendee (300 tickets sold, 300 pages). Like a print dialog, the organizer chooses the range: all pages by default (1 to the last), or a range such as 1-100 or 250-300. Typical use: send the first 100 badges to the print shop, and generate 101 onwards later, when more tickets have been sold.
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

- CampTix CSV format: columns, encoding, delimiter (waiting for a sample export).
- PDF generation in the browser or in PHP. A PDF background points to the browser: PDF.js to show it in the editor, and pdf-lib to embed its page as a vector background in the final PDF.
- Editor technology (React with `@wordpress/components`, or plain JavaScript).
- Styles that depend on the ticket type (organizer, speaker, volunteer...).
- Crop marks in the PDF, and one badge per page or several per sheet.
