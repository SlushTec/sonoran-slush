# Square capability evidence matrix

RPG-125 / SS-021, SS-023, SS-024, SS-029. Primary documentation checked November 14, 2026. US support pages are the selected research jurisdiction, not proof of the actual merchant country/location. This is documentary evidence, not account or device qualification.

## Boundaries

No Square account, credentials, device settings or payment was accessed or changed. No purchase, subscription, new payment method, offline policy or live test is authorized by this document. PayPal remains excluded by the existing project decision. Provider support must not be displayed as Sonoran availability until the actual approved merchant, device and integration path qualify.

At repository base `06bd37998b9b92d6451597a5fb8541ac45c54015`, the local adapter and synthetic/browser checks are not a real Square checkout, wallet or POS test. [Local retail limits](../../services/commerce/RETAIL-TEST.md) and [connected synthetic journey](CONNECTED_CUSTOMER_JOURNEY.md) remain applicable; payment, proof and fulfillment holds remain independent.

## Capability matrix

| Surface | Published provider capability | Sonoran qualification still missing |
| --- | --- | --- |
| Hosted online checkout | Checkout API provides Square-hosted links and lists cards, Apple Pay and Google Pay among its methods. This is not a card-entry form hosted by Sonoran. [S1] | Approved merchant/location, permissions, actual supported integration and truthful pending/paid reconciliation. No account was inspected. |
| Online wallet visibility | The buyer device/browser determines which wallet button appears. The US Payment Links settings page specifically limits Apple Pay display to Safari. Do not promise every wallet in every browser. [S2][S3] | Current eligible devices/browsers, account configuration and accessibility/fallback review. Do not extrapolate Web Payments SDK behavior to hosted Checkout API. |
| Hosted Sandbox testing | Checkout API Sandbox supports credit/debit card tests, but not Apple Pay, Google Pay, Afterpay, Cash App Pay or ACH. A passing sandbox card flow cannot certify wallets. [S2] | Separately authorized supported wallet verification; never substitute an unapproved live charge for missing sandbox support. |
| Merchant/location settings | Checkout Settings endpoints distinguish merchant payment-method settings from location settings; those endpoints do not support Sandbox. [S4] | Authorized account evidence and minimum required permissions. A sandbox error is not proof that the merchant lacks a capability. No settings API was called. |
| In-person iPhone | Square documents NFC cards and Apple/Google/Samsung Pay with Tap to Pay on iPhone. Requirements include iPhone XS or newer, latest iOS, passcode and stable internet; iPad is excluded. POS/Appointments device-code login has a restriction, while Retail POS is documented separately. Offline is unsupported. [S5] | Brian's exact hardware, app/mode, login method, staff roles and authorized physical test. Samsung NFC acceptance does not imply a Samsung online checkout button. |
| In-person Android | Square documents NFC cards and Apple/Google/Samsung Pay. Requirements include compatible Android hardware, Android 9+, NFC and developer options disabled; some models/app combinations and countries differ. Offline is unsupported. [S6] | Exact model/country/app compatibility, settings and physical qualification. No phone settings were changed. |
| Offline hardware eligibility | The US article lists Register, Terminal, Handheld, supported Stand and Reader generations. Reader first-generation v1/v2 and buyer-facing Terminal API mode are excluded; phone-only Tap to Pay is excluded. [S7] | Identify exact hardware generation and operating mode; terminal ownership alone is insufficient. |
| Offline timing and risk | Reader/Stand acceptance sessions are limited to 24 hours; upload is required within 72 hours from session start. Register/Terminal/Handheld text specifies 72-hour upload, recommending 24 hours. Expired payments cannot be recovered; merchant bears decline/dispute/expiry risk. [S7] | Owner-approved risk limits and exact device guidance. Do not treat pending offline records as paid or authorize supplier/engraving work from them. |

### Source ambiguity that must remain visible

S7's subsection heading says 24 hours to upload, while its following Register/Terminal/Handheld paragraph says 72 hours and recommends 24. Preserve this discrepancy; recheck exact hardware guidance with Square before adopting an operational deadline. Pending-payment precautions also prohibit sign-out, app deletion, mode/location switching and factory reset; upload must be verified. S7 describes a 2026 automatic-enablement rollout: actual account settings are unknown. These facts do not authorize changing them.

## Acceptance plan, not completed tests

1. Owner/authorized operator identifies the existing merchant country/location and intended online/POS paths. Keep financial identifiers and credentials out of Git and board notes.
2. Record device model/generation, OS/app version, mode and operator permissions. Record each supported wallet separately, including unsupported combinations; do not infer device support from an Android/iPhone label.
3. With appropriate authorization, qualify sandbox card success, decline, cancellation, abandoned authentication, duplicate retry and delayed event reconciliation. Label unsupported sandbox wallet tests unavailable rather than passed.
4. Obtain a separately approved method for wallet and physical POS verification. Bind observed transaction evidence to the correct order/location without raw card data. No testing is authorized by this checklist itself.
5. Before any offline acceptance, resolve the timing ambiguity for the exact hardware and approve limits, reconciliation ownership and a supported fallback. A captured request is not payment approval.
6. Only then update customer-facing availability. Accounting mappings, fees, settlement, supplier spend and physical manufacturing remain separate open qualifications; this matrix does not resolve them.

## Primary sources

All links below were opened and read November 14, 2026; this is the observation date, not a guaranteed publication/update date. Recheck before activation or after provider changes.

- [S1: Checkout API overview](https://developer.squareup.com/docs/checkout-api), highlights and workflow.
- [S2: Checkout API guidelines and limitations](https://developer.squareup.com/docs/checkout-api/guidelines-and-limitations), device-dependent buttons and Sandbox limitations.
- [S3: US Payment Link settings](https://squareup.com/help/us/en/article/8364-customize-square-payment-links), wallet visibility/settings.
- [S4: Checkout Settings API](https://developer.squareup.com/docs/checkout-api/checkout-settings), requirements and merchant/location separation.
- [S5: US Tap to Pay on iPhone](https://squareup.com/help/us/en/article/7786-get-started-with-tap-to-pay-on-iphone), prerequisites and login restrictions.
- [S6: US Tap to Pay on Android](https://squareup.com/help/us/en/article/7960-get-started-with-tap-to-pay-on-android), compatibility and offline exclusion.
- [S7: US offline payments](https://squareup.com/help/us/en/article/7777-process-card-payments-with-offline-mode), supported/excluded hardware, timing, risk and pending-payment precautions.
