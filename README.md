# Camptix Badge Generator

WordPress plugin that processes CampTix CSV export files and generates PDF badges ready to print.

Organizers design the badge in a visual editor in the WordPress admin, over a background made in any drawing program, with text boxes, the attendee's Gravatar and a QR code to their WordPress.org profile. The PDF, one page per attendee with bleed and crop marks, is built in the browser.

Status: development. See `HANDOFF.md` for where the work stands, and `docs/specification.md` for what the plugin does.

## Development

- Working rules for agents and contributors: `AGENTS.md`.
- Current state and next steps: `HANDOFF.md`.
- Project documentation: `docs/`.

Requirements: PHP 8.3+, Composer, Node.js 20.18+ (WordPress Playground) and, optionally, WordPress Studio.

```bash
composer install
composer lint
npm install
npm run build
npx @wp-playground/cli@latest server --blueprint ./blueprint.json --mount-dir . /wordpress/wp-content/plugins/camptix-badge-generator
```

The JavaScript build (`build/`) is not in Git: run `npm run build` after cloning and after changing `src/`. Put a CampTix CSV export in `test-data/` (ignored by Git) to have attendees.

The test site is at http://127.0.0.1:9400/ (admin / password).

## License

GPL-2.0-or-later.
