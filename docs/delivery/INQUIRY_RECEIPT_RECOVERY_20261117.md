# Inquiry receipt download recovery
Private successor of ac87c815075abf6812adf71466ff6f89627bd9ae. The separate shared InquiryForm receipt control still allowed download failures to escape. A status-only handler now reports failure and explicit retry without resubmitting the already-received inquiry, or accurately reports download started. Kind lifecycle clears the transient feedback. No receipt, request payload, draft cleanup, date/booking promise, or persistence contract changes.

External evidence: D:\dot-workspace\store-inquiry-receipt-*.log/.exit.
- Red first native case failed missing recovery status; second not run under max-failures1. Preserved.
- Final native4/4,17.4seconds: desktop createObjectURL failure and390px anchor-click failure, unchanged local/session data, focus retained, URL cleaned after click failure, explicit retry downloads exact validated receipt only, single network submission, no access token persisted/no overflow. Existing unverified receipt and leave/return lifecycle cases also pass.
- 658 frontend tests; TypeScript/static build/export/archive verification exit0. Export72pages/4399links/40images/oneH1/noarchive, archive67+41.
- Fresh npm ci with exact candidate storefront junction; owned13516/27104 closed and4263 listener absent. Tracked native harness remains uncommitted.
Native provider is intercepted synthetic contact inquiry only, not live commerce or full event/bulk acceptance. No screenshot/manualAT/physicalphone/fullbrowser/publication claim. Independent review required.
