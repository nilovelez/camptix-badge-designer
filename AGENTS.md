# CampTix Badge Designer: instructions for agents

WordPress plugin that processes CampTix CSV export files and generates PDF badges ready to print.

This file is the single source of working rules for any agent or person picking up the project. `CLAUDE.md` only imports it. Read `HANDOFF.md` next: it says where the work stands and what comes next.

## Repository map

| Path | What it is |
|---|---|
| `camptix-badge-designer.php` | Main plugin file. |
| `readme.txt` | WordPress.org readme. |
| `AGENTS.md` | Working rules (this file). |
| `CLAUDE.md` | Imports `AGENTS.md` for Claude Code. |
| `HANDOFF.md` | Current state, next steps and how to resume. Keep it up to date. |
| `README.md` | Project overview for GitHub. |
| `docs/` | Project documentation: specification, milestones, decisions, backlog. |
| `guppy/` | Project status published to Guppy (see below). |
| `blueprint.json` | WordPress Playground blueprint for the test site. |
| `composer.json`, `phpcs.xml.dist` | WordPress Coding Standards (PHPCS). |
| `includes/` | PHP code loaded by the main file. |
| `src/` | JavaScript sources, built with `@wordpress/scripts` (`npm run build`) into `build/`, which is not in Git. |
| `src/vendor/ladyqr/qr.js` | QR encoder copied from LadyQR (GPLv2). |
| `fonts/inter/` | Inter 4.1 static TTF files and their license. |
| `src/editor/` | The badge editor (Badges admin page). |
| `src/shared/` | Code shared by the editor and the PDF generator: text layout, QR codes, Gravatar URLs. |
| `tools/` | Build helpers, and `make-fixtures.mjs` for the test backgrounds. |
| `tests/` | Test fixtures, all invented (backgrounds, a WOFF2 font), and PHP tests. |
| `test-data/` | Real CampTix exports for testing. Ignored by Git: never commit them. |

Everything an agent needs to resume the work lives in this repository. Do not rely on local memory, chat history or files outside the repo: if something matters, write it here.

## Language

- Everything in the repository is in US English: code, function and class names, prefixes, comments, user-facing strings, documentation, the readme and commit messages.
- The developer, Nilo, talks to agents in Spanish, and agents answer him in Spanish.

## How we work

- **Milestones.** Work is split into milestones, listed in `docs/milestones.md`. Ask Nilo for an OK before starting each one. When it is done, present it and stop: Nilo reviews it and must give an explicit, clear OK before the next one starts. Never chain milestones.
- **Branches.** Work directly on `main`. Once something is working, a new feature to try out goes in its own feature branch; otherwise only when Nilo asks. No pull requests unless asked.
- **Push** only when Nilo asks, or when he closes a session (below).
- **Ignored files.** Nilo will add test documents (for example real CampTix exports) that must stay out of Git. Add them to `.gitignore` as he points them out, and never commit personal data from attendee lists.
- **End of a session.** When Nilo says the session is over (usually after a milestone or a feature), unless he says otherwise:
  1. Update `HANDOFF.md` and the Guppy status (below).
  2. Check that nothing is left uncommitted, and commit what is.
  3. Push everything to the remote, so the work can be resumed from another computer.

## WordPress development

The project follows the `wp-agentic-workflow` skill (https://github.com/nilovelez/wp-agentic-workflow), on top of the official WordPress agent skills (https://github.com/WordPress/agent-skills). Without the skill, the essentials are:

- Slug and text domain: `camptix-badge-designer`. Prefix for functions, constants, options and hooks: `ctbd` (`CTBD_` for constants, `Ctbd_` or a `Ctbd` namespace for classes).
- Requires WordPress 6.8 and PHP 8.3.
- WordPress Coding Standards: `composer install` once, then `composer lint` before every commit that touches PHP (`composer fix` for automatic fixes). Plugin Check must be clean before any release.
- Readable, simple code: a plain loop or `if` over clever one-liners.
- Development files stay out of the release zip through `export-ignore` in `.gitattributes`. Add any new development file or folder there.

### Test sites

Login for every test site: `admin` / `password`.

Nilo often works from another computer, reaching this one through Tailscale. Every time a site is up, give him its URL and, for a Studio domain, the hosts line he needs. Use the Tailscale address (`tailscale ip -4`, a `100.x.y.z` address) when the computer is on Tailscale, otherwise the LAN IP. Check it every time: it can change.

- **Playground** (disposable), from the repo root:

  ```bash
  npx @wp-playground/cli@latest server --blueprint ./blueprint.json --mount-dir . /wordpress/wp-content/plugins/camptix-badge-designer --site-url http://<Tailscale or LAN IP>:9400
  ```

- **Studio** (persistent): created at `~/Studio/camptix-badge-designer`, with the repo linked as the plugin. Start it with `studio start --path <site> --skip-browser`; it is then at `http://camptix-badge-designer.local/` and the other computer needs `<IP> camptix-badge-designer.local` in its hosts file. WP-CLI: `studio wp --path <site> <command>`.

On Windows, use PowerShell rather than Git Bash for these commands.

## Project status (Guppy)

This project publishes its status to Guppy, Nilo's project manager (https://github.com/manuelstone/guppy). Everything Guppy-related lives in `guppy/`, written in English:

- `guppy/STATUS.md`: extended status and work log, for agents working on this project. It is never synced anywhere.
- `guppy/STATUS.json`: public summary, following the status contract (https://github.com/manuelstone/guppy/blob/main/docs/status-contract.md). `.github/workflows/guppy-sync.yml` copies it to Guppy every time it changes on the default branch, and from there it goes to a public website. Never put private information, credentials or secrets in it.

At the end of every work session on the project, even if `status` stays the same:

1. Update the Status section of `guppy/STATUS.md` and add a brief entry at the top of its Log.
2. Update `guppy/STATUS.json`: change `status` if it changed, rewrite `status_text` so it says where the project stands now, and always take new `last_update` and `last_update_unix`. They record when the status was last reported, not when `status` last changed: an `active` project gets new dates after every session. Take both dates from a single timestamp: `ts=$(date +%s); date -d "@$ts" '+%Y-%m-%d %H:%M:%S %z'; echo "$ts"` (GNU date; the contract has the macOS and PowerShell versions).
3. Commit both files with the rest of the session's changes and push to the default branch.

Statuses: `active` (being worked on), `blocked` (waiting for something outside the project), `inactive` (stopped by choice), `planned` (decided, not started), `archived` (closed).

`status_text`: one or two sentences, under 200 characters, plain text. Say where the project stands and what comes next; if blocked, start with what it is waiting for and from whom. Self-contained: no relative dates, name versions and third parties. Rewrite it in full each time; the history goes in the Log.

When Nilo asks to change this project's data in Guppy (its icon, title, description or status), edit `guppy/STATUS.json` following the contract, commit and push to the default branch: the sync publishes it. A change of only the icon, title or description does not touch the dates. `icon` is any public URL, ideally a square 128×128 PNG. Never edit the Guppy repo for this.

Do not use CHANGELOG.md for this: it is for users. Do not edit `guppy-sync.yml`. If the Guppy sync action fails, read its log in the Actions tab and tell Nilo.
