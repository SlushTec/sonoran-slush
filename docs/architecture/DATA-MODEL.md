# Shared data and trust boundaries

## Records to implement

Product / Variant / BlankInventory / PriceBookVersion / Configuration / Artwork / ProofVersion /
Cart / Quote / Order / Payment / Refund / StockReservation / ProductionJob / Shipment /
EventRequest / EventHold / EventBooking / NotificationOutbox / AuditEvent.

A physical blank has one inventory identity even when offered as a single, set or event inclusion.
Paid order lines snapshot approved price, currency, configuration and terms; later catalog changes do not rewrite history.
Money uses integer minor units (USD cents initially), never floating-point arithmetic supplied by a browser/model.
Quotes distinguish estimates from accepted price commitments, with expiry and explicit owner approval rules.

## Independent state machines

Payment: unpaid -> pending -> paid; failed/canceled/refunded paths require provider evidence.
Proof: not_required OR awaiting_artwork -> draft -> awaiting_customer -> approved/revision_requested.
Production: not_released -> ready -> in_progress -> quality_check -> fulfilled/canceled.
Event: requested -> under_review -> held -> confirmed -> completed/canceled; requests do not reserve dates.

A production release requires the applicable verified payment rule AND approval of the exact current proof version
AND valid stock/capacity. Editing proof artwork invalidates earlier approval; payment alone never approves engraving.
Repeated payment events and actions must be idempotent. Stock holds need atomic conditional updates and expiry handling.

## Contracts

Read-only v1 paths exist now. `packages/contracts/openapi-commerce.json` and `openapi-assistant.json` are generated from source.
Future mutations remain explicitly unavailable until auth, persistence, validation and acceptance tests land together.
AGENT-02 owns breaking contract changes; AGENT-01/03 consumers review before merge.
Client hints, uploaded text, chat history and retrieval results are untrusted. The server owns prices and permissions.
