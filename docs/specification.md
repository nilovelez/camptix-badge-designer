# Specification

Draft. It grows as Nilo defines the project; open points are listed at the end.

## Goal

A WordPress plugin for WordCamp sites that generates printed badges. Organizers upload the attendee list exported from CampTix, place its fields over a background image in a visual editor, and get a print-ready PDF to send to a print shop.

Long-term goal: integrate with CampTix directly (no CSV) and run on every WordCamp site. Until then, development happens on test sites.

## Workflow

1. The organizer designs the badge background in any drawing program, leaving room for the fields. Templates with the trim, bleed and safe margins will be provided.
2. They upload the CampTix CSV export.
3. They upload the background image. The editor detects its size and sets the print size and bleed (see below).
4. In the editor, they place CSV fields over the background and style them. Some fields generate images (see below).
5. They generate the PDF for the print shop.

## Badge size

- Default: 100 × 150 mm (width × height, portrait) trim size, with 3 mm bleed on each side, so the background and each PDF page are 106 × 156 mm.
- Print size and bleed are configurable, so other badge sizes can be used.
- When a background image is uploaded, the editor reads its pixel dimensions:
  - If its aspect ratio matches the current print size plus bleed (106 × 156 mm by default), it is used as is.
  - Otherwise, the editor asks for the print size and the bleed.
- The editor shows the effective resolution of the background at the chosen size and warns when it is too low for print (300 dpi recommended: 1252 × 1843 px for the default size).
- The editor shows the trim line and the safe area as guides; they are not printed.

## Fields

- Text fields: any CSV column, placed and styled (font, size, color, alignment, weight).
- Image fields generated from a CSV column:
  - QR code from a URL (for example the attendee's WordPress.org profile).
  - Gravatar avatar from the email address.
- WordPress.org username: a required field on every ticket. From it the plugin derives the profile URL, `https://profiles.wordpress.org/<username>/`, and one of the elements that can be placed on the badge is a QR code pointing to that profile.

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
- Whether the uploaded CSV is stored on the server or only processed in the browser.
- PDF generation in the browser or in PHP.
- Editor technology (React with `@wordpress/components`, or plain JavaScript).
- Styles that depend on the ticket type (organizer, speaker, volunteer...).
- Crop marks in the PDF, and one badge per page or several per sheet.
