# Sonoran Slush storefront — October 16, 2026

Brian requested: **“create the site, everything but images.”**

## Delivered

The navy/gold storefront covers seven product families and 29 documented offerings, plus custom/bulk and live-event journeys.
All product photography and illustrative imagery are intentionally absent. Reserved panels are labeled honestly;
no product photo, customer testimonial, scarcity, provisional selling price, or stock availability was invented.

| Experience | Implemented behavior |
| --- | --- |
| Discovery | Search, material/occasion filters, collection routes, favorites, editable catalog-based gift finder |
| Personalization | Product-specific options; supported crystal shapes/sizes; text/font layout; local artwork inspection and non-drag layout controls |
| Saved work | Thirty-day device drafts, separate saved designs and favorites, persistent bag, multiple designs, downloads and clear controls |
| Guest request | Contact, delivery preference, gifting, exact design summary, recoverable request submission |
| Custom/bulk | Shared versus individual designs, products, quantity, date, budget notes, contact/consent, explicit draft save/download |
| Events | Occasion/date/location/guests/product requirements, inquiry status distinct from a confirmed booking |
| Customer portals | Private record access, quote versions, order timeline, exact-version proof approve/change, separate test checkout connection |
| Owner workspace | Authorized record review, versioned quote offers, order/text-proof preparation, production checks, dispatch records |
| Supporting pages | Story, reserved portfolio, help/FAQ, photo guide, shipping/timing, care, privacy behavior, ordering guidance, accessibility |

The private static review uses the same application source with no commerce/account service URL configured.
Forms do not fabricate successful submissions. Device-local design work functions independently.

## Commerce source

Opt-in local SQLite persistence and transactional duplicate handling are implemented and tested.
Guest credentials are record-specific; staff operations require a separate credential.
Quote acceptance binds to a version. Revising a proof clears the prior approval.
Production checks require verified payment, the exact current proof, inventory reservation, and capacity.
The hosted payment adapter accepts test configuration and signed test events only.
No card data passes through the storefront.

The AWS target architecture is preserved. The local adapter is not a production DynamoDB implementation.
Live Cognito accounts, private upload validation/quarantine, notifications, AI integration, event confirmation/deposits,
refunds, shared-stock automation, and production operations still require their service implementations and qualification.
Approved commercial data, policies, and final images are also release requirements.

## Verification performed

- **52 Python unit/contract tests passed**, covering old foundation invariants and new durable request,
  privacy, concurrency, quote/proof version, signed payment, production-release, dispatch, and retry behavior.
- **15 frontend DOM tests passed**: search/recovery, persisted favorites/designs/bag, invalid customization,
  crystal limits, recoverable form failures, explicit draft saving, gift suggestions, guest access privacy,
  clear-data behavior, initial product HTML, and keyboard tabs.
- DOM accessibility scan returned no violations for the configured WCAG tags with color contrast omitted.
- Core small-text colors were darkened and numerically checked against declared backgrounds.
- Real-browser/device and whole-page accessibility/performance qualification were **not** performed here.
- Browser tests and CI expectations were updated for the implemented experience; future CI results are separate evidence.
- Archive preservation, final builds, export/route/link checks, dependency audit, and publishing are recorded below after completion.

One existing test-tool deprecation warning remains (Starlette's httpx-backed TestClient).
No live AWS, Stripe, mail, DNS, or customer-data action was used for verification.

## Review and release

Source integration is on a feature branch above the October 14 AWS scaffold.
This is a private review delivery, not a declaration that the production release gates pass.
The implementation and API consumer were reviewed together by the implementing agent; independent peer review is pending.
See [the local workflow runbook](../runbooks/STOREFRONT-REVIEW.md) for verification boundaries and rollback.
