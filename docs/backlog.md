# Backlog

Ideas and pending work that belong to no milestone yet. Nilo decides if and when each one goes into a milestone (`docs/milestones.md`).

## Gravatar from the WordPress.org username

Use the avatar of the attendee's WordPress.org profile when the CampTix email address has no Gravatar.

- The WordPress.org profile shows the Gravatar of that account's email address, which the export does not include; the CampTix address may be a different one.
- There is no public API that returns the avatar for a username. Reading it from the profile pages would mean fetching one page per attendee from the server (browsers cannot, because of CORS), which is slow and breaks if the page changes.
- Left out of milestone 5 for these reasons (October 2026).
