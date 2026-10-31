# Technical decisions

Proposals and decisions, with their reasons. A proposal becomes a decision when Nilo confirms it, usually after testing it.

## Editor: React with WordPress packages (proposal)

Build the editor with `@wordpress/element` (React) and `@wordpress/components`, compiled with `@wordpress/scripts`.

- It looks and behaves like the rest of the WordPress admin, with accessible controls (color picker, number and select fields, panels) ready to use.
- Translations work through `@wordpress/i18n`, the standard for plugins.
- WordPress loads React itself, so the plugin does not ship it.
- Drag and resize are done with pointer events on an absolutely positioned layer over the background, in millimeters scaled to the screen. That logic is small and fully under our control.

## PDF: generated in the browser with pdf-lib (proposal)

- pdf-lib embeds a page of a PDF background as a vector object, so vector backgrounds stay vector, and the background is embedded once and reused on every page, which keeps large PDFs small.
- Text is real text with embedded fonts (pdf-lib with fontkit, subset to the glyphs in use), not images.
- QR codes are drawn as vector squares from the LadyQR module matrix: sharp at any size, no images.
- Gravatars are fetched as PNG at print resolution and embedded; Gravatar must allow cross-origin requests for this (to be checked).
- PDF.js only renders a PDF background in the editor.
- To be checked in a spike: memory and time for a few hundred pages.

## Fonts (proposal, to be checked)

The PDF needs the font files, not only CSS. Options:

- The WordPress Font Library (WordPress 6.5+), which installs Google Fonts on the site itself: no requests to Google from the admin, and the files are available to embed. Check that fontkit can read the formats it installs (WOFF2).
- Fetching the TTF files from Google Fonts on demand.
