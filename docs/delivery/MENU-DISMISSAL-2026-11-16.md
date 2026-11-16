# Same-destination mobile navigation dismissal

Private RPG-117 / SS-007.AC3 repair based on 560368b853465473d623ac08f9040618d5971c4f. The mobile Saved designs and Your account links lacked the close handler used by primary links. Selecting either on its current page did not trigger the pathname-change effect and left navigation open. Both now use the identical existing explicit dialog-close behavior. No route, state, content, account, authentication or persistence semantics changed.

Two DOM regressions failed before the repair, then passed. The DOM harness prevents native anchor navigation because jsdom cannot implement it; React click handlers still execute and closing remains asserted. Real navigation is separately covered by two native Edge tests at 390px: repeated keyboard same-route activation, different-route arrival with actual page heading, reopening, Escape and trigger-focus restoration. This is automated desktop-browser viewport evidence, not physical-phone or manual assistive-technology qualification.

No production publication, full parent acceptance, or held guided frontend/rollup/packaging work is included. Earlier failing logs remain retained outside the candidate.
