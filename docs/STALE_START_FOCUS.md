# Explicit stale-link new-design focus

Only the explicit Start a new design action records a transient focus intent, bound to its new design ID and product slug. After that matching editor mounts, the intent is consumed and its first step tab receives focus. Product/identity mismatch and unmount discard the intent. Ordinary hydration, reload and product navigation do not request focus.

No draft, named-design, bag, photo, URL or option-review policy changes. The stale URL intentionally remains: reload shows the existing unavailable panel without replacing the new draft; explicit Recover current draft retains existing behavior.

Original external BODY-focus failure is retained outside the repository. Five focused DOM cases cover repeated starts with/without a prior draft, interrupted unmount, product transition and ordinary hydration. Native keyboard scenarios at 1280/390 cover repeated explicit activation, storage preservation across reload and normal recovery without tab focus. Qualification results are recorded separately; no manual assistive-technology claim.
