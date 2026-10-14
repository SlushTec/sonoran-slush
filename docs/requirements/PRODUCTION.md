# Production scope and release gates

The launch target is complete production behavior, not a demo. This reset delivers foundations only.
No checklist below is marked complete by the presence of a scaffold file.

## Customer scope

Full offering coverage; product/occasion discovery; category-aware search/filters; rich approved imagery;
variant/personalization flows; safely validated uploads; honest previews; preserved configuration;
transparent authoritative pricing, shipping/tax estimates and delivery constraints; guest checkout;
supported express payments; gifting; quote/bulk requests; event inquiry/booking; secure proof review;
order tracking, issue reporting, care instructions and reordering. AI is optional throughout.

## Business scope

Owner dashboard; catalog/price version management; shared blank inventory; set/bulk rules; quotes;
event holds/deposits/balances; versioned proof decisions; payment reconciliation; refunds with approval;
production queue; fulfillment and notification history. Customer and staff permissions must be distinct.

## Release blockers

- Approved product data, real photography, current inventory/policies and all material contradictions resolved.
- Durable records, tenant/customer ownership checks and verified hosted-payment/webhook behavior.
- Duplicate requests/events cannot double-charge, duplicate fulfillment or oversell shared blanks.
- Proof edits invalidate earlier approvals; production release requires applicable approvals and payments.
- Private upload validation, malware/unsafe-format handling, metadata controls, short-lived access and tested deletion.
- Real-browser end-to-end retail, bulk, event, gift and proof journeys; no critical/high-severity open defects.
- Keyboard/touch/screen-reader testing targeting WCAG 2.2 AA; non-drag controls for positioning/cropping.
- Performance budgets: LCP <=2.5s, INP <=200ms, CLS <=0.1 at p75 real visits, per mobile/desktop once measurable.
- Before traffic exists use representative lab tests; never claim field budgets verified from a local screenshot.
- Real iPhone/Android and slow/interrupted network verification; state survives refresh/back/recoverable errors.
- Monitoring/alerts, bounded retries, backup/restore drill, rollback and payment reconciliation demonstrated.
- Least privilege, secrets rotation procedure, dependency/security scans and privacy-preserving logging.
- Current payment/tax/shipping/refund/privacy/legal reviews and explicit owner authorization for live launch.

## Completion accounting

Backlog acceptance criteria and actual evidence determine status. A 503-disabled endpoint is safe scaffolding,
not an implemented feature. A /health response proves a process, not checkout or production readiness.
Use `docs/delivery/VERIFICATION.md` for actual reset evidence and limitations.
