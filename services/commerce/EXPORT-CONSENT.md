# Export consent preflight (RPG-126 / SS-035)

This disconnected metadata contract checks an exact order/asset/export/proof/configuration binding against a recipient-, purpose- and policy-specific permission record. Missing, withdrawn, expired, future or mismatched permission is held. Conversion and manufacture are distinct purposes. The injected aware clock makes expiry boundaries deterministic.

A successful result means ready for owner review only, never permission to transmit. The caller must independently authenticate the subject, resolve current authoritative records, check asset ownership and re-resolve withdrawal immediately before any future dispatch. A serialized result is not a durable capability. Do not expose this helper as a client-controlled authorization endpoint.

No image storage/upload, real customer consent capture, retention duration, recipient registry, policy text, photo processing, mapping qualification, payment, supplier spend/submission ledger, or production workflow is implemented. The synthetic test interval is not a business retention policy. Reproduction and recipient transfer permission do not grant portfolio/marketing permission. This slice does not close SS-035 or RPG-126.

Validation: `python -m pytest tests/unit/test_export_consent.py -q`. Fixtures are synthetic metadata only. Full service composition and race-safe dispatch/revocation remain future acceptance gates.
