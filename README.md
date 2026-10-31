# Camptix Badge Generator

WordPress plugin that processes CampTix CSV export files and generates PDF badges ready to print.

Status: early development. See `HANDOFF.md` for where the work stands.

## Development

- Working rules for agents and contributors: `AGENTS.md`.
- Current state and next steps: `HANDOFF.md`.
- Project documentation: `docs/`.

Requirements: PHP 8.3+, Composer, Node.js 20.18+ (WordPress Playground) and, optionally, WordPress Studio.

```bash
composer install
composer lint
npx @wp-playground/cli@latest server --blueprint ./blueprint.json --mount-dir . /wordpress/wp-content/plugins/camptix-badge-generator
```

The test site is at http://127.0.0.1:9400/ (admin / password).

## License

GPL-2.0-or-later.
