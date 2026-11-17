# Catalog category selection semantics

Private successor of 035898d0096734dee57504c74f63bb90b9f5cb6f, under RPG-117 / SS-007.AC3.

## Bounded change

The existing catalog category controls are buttons that filter the displayed collection, not navigation links. Their selected state was conveyed only through the active CSS class. Add aria-pressed to All gifts and each category button, using exactly the same selection expressions as their existing class names. Names, counts, keyboard behavior, routing, reset defaults, product data and visual styling stay unchanged.

Exactly one category button is pressed, including URL restoration, explicit All gifts on a category route, and reset to the route default. This does not claim complete screen-reader/device/WCAG qualification, approved imagery or full RPG-117 completion. Held guided-design, frontend-rollup and packaging sources are excluded.

## Verification scope

Two added DOM regressions cover selected/unselected semantics, switching, reset and restored category URL. Two native browser journeys at 1280 and 390 cover Enter/Space selection, reload, product visit and Back, explicit All gifts and route-default reset. Existing frontend tests remain intact.

External evidence is stored beside this isolated checkout under store-category-*. Initial red tests and failed npm-wrapper/browser attempts remain diagnostic evidence, not passing results. npm wrapper failures occurred before scripts; exact Node entrypoints provide the maintained frontend/typecheck/build equivalents. Native dependencies were installed with npm ci --ignore-scripts; @sonoran/storefront is a junction to this candidate, not a copied stale package.

Only the two aria-pressed attributes change product behavior. No backend, catalog facts, authorization, provider, production infrastructure or publication change. Final gate outcomes and frozen hash are recorded by the coordinating review, not predicted here.
