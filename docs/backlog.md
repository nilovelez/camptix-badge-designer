# Backlog

Ideas and pending work that belong to no milestone yet. Nilo decides if and when each one goes into a milestone (`docs/milestones.md`).

## Quick jumps in the attendee pagination

Buttons to go to the next attendee without a QR code, without a Gravatar, or with text that is cut, to review them before printing. Nilo moved it here from milestone 5: it will probably be done another way (October 2026).

## Canvas zoom

Planned for milestone 11, moved here by Nilo after bor0's review (November 2026). − and + buttons and a menu in the toolbar (Fit to view, as today, then 50%, 100% at real size, 200% and 400%), and Ctrl + wheel over the canvas only, to zoom towards the pointer (in Chrome and Edge this also gives trackpad pinch). No keyboard shortcuts for zoom, so the browser's own zoom keeps working in wp-admin (decided by Nilo: the basic tool, nothing delicate to maintain). When the badge does not fit, the canvas scrolls and Space + drag pans, except while typing in a field. View only: the design and the PDF do not change. The PDF background render needs a size cap at high zoom.

## Integration into the official WordCamp.org badge plugin

Once the WordCamp.org team agrees (see "Name, and the road to WordCamp.org" in `docs/decisions.md`): fork `WordPress/wordcamp.org`, move the code into its `camptix-badge-generator` plugin following that repo's conventions, and send the pull request. Before it is merged, go through `docs/integration-tests.md`: the parts that only run on WordCamp.org.