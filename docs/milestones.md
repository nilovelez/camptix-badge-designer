# Milestones

Each milestone needs Nilo's OK before it starts and an explicit OK after review before the next one starts (see `AGENTS.md`).

| # | Milestone | Status |
|---|---|---|
| 0 | Plugin skeleton and development setup: main file, readme, Playground blueprint, Studio site, WPCS, Guppy. | Done |
| 1 | Technical spike: an admin page that generates a 300-page badges PDF in the browser with pdf-lib (Inter embedded, vector QR codes from LadyQR, Gravatars, a vector PDF background, crop marks) and measures it; PDF.js preview; WOFF2 check. Confirms or changes the proposals in `docs/decisions.md`. | Done, waiting for review |
| 2 | Attendee data: PHP reads the CSV in `test-data/`, sorts by `Attendee ID`, validates usernames, normalizes names and sends the browser only the allowed fields. | Planned |
| 3 | Editor structure: admin page with the mockup layout in React and WordPress components; background from the Media Library (PDF, PNG or JPG), print size and bleed, guides, saved design. | Planned |
| 4 | Text boxes: elements with variables, drag and resize, Document and Element tabs, typography, attendee pagination. | Planned |
| 5 | QR code and Gravatar elements, with their options and the cases without a username or a Gravatar. | Planned |
| 6 | PDF generation: one-page preview, page ranges, crop marks. | Planned |
| 7 | Import and export of the design as JSON, polish, Plugin Check and the release zip. | Planned |

The editor mockup is at https://claude.ai/artifact/AzEqUCXhPU5poaHuaQMDix (private to Nilo).
