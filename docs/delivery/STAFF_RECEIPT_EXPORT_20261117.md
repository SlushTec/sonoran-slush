# Bounded recoverable staff receipt export
Private successor of 2f35002f9a9306257e643992946828c4090f39df. Existing receipt validation accepted the three known fields but retained runtime extras; native synthetic red exported internal_notes. Separate forced download red had no recovery feedback. No real service was contacted.

The same validation predicate now adopts only id/status/access_token. Existing active-session download guard is unchanged. Local synchronous failure feedback preserves the receipt and confirmed action outcome, offers download-only retry, and never suggests repeating the server mutation. Success says download started. Feedback resets wherever receipt is cleared, including action replacement, record/context invalidation and Lock. No auth, backend, request payload or business-state change.

External store-staff-export-*.log/.exit:
- Original two red failures retained: unknown field downloaded and missing failure feedback.
- Final native6/6,28.4s includes new desktop/mobile export/retry/exact JSON/single mutation/unchanged storage/Lock cleanup plus four existing staff-session cases, including automated axe checks.
- 658frontend, TypeScript, static build/export/archive exit0. One indentation-only correction after tests and before build changed no semantics. Export72pages/4399links/40images/oneH1/noarchive; archive67+41.
- Fresh npmci exact storefront junction, owned36292/31528 closed and4271 listener absent.
No actual staff credential, real order preparation, manualAT, reviewed screenshot, full browser or release claim. Independent source-design review preceded implementation; final independent review required.
