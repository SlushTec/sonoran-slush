# Explicit inquiry save verification

The original explicit Save draft action could announce a saved draft after a silently dropped local write. External store-inquiry-save-red preserves that reproduction: saved-success toast with no stored key and zero network calls.

The action still attempts exactly one write with unchanged values/request_id and expiry policy. Success now requires readable, matching payload in an unexpired envelope. Otherwise it says the draft could not be verified and offers the existing download path; read denial is not labeled definite loss. No autosave, schema, consent, request lifecycle or network change.

Focused final nine cases pass across contact/bulk/event and throw/silent/readback denial. They preserve old bytes on failed write, distinguish successful write with denied readback, retain visible edit and request identity, make no navigation/edit writes, and recover only on explicit Save. Checkbox states and zero network/session attempts are checked. Initial fixture incorrectly assumed a required checkbox existed on every step; preserved failure corrected to exact rendered before/after states. First correction edit failed CP1252 decoding before writes; repeated diagnostic retained, then explicit UTF-8 edit applied. Native actual download fallback and cumulative checks pending source peer.

## Final qualification

Frozen1edfbf42 passed the complete current eight-file test:frontend command:724/724 in7.120s; types, export build/check (72pages/4399links/40images), standalone build and archive67+41 all exit0. Six native cases passed14.5s across contact/bulk/event at390throw and1280silent. They exercise explicit old save, current edit without autosave, rejected Save/old bytes retained, actual downloaded unsent draft readback, unchanged request_id/contact/consent, zero POST/session attempts, explicit successful retry and reload. Readback denial remains focused DOM coverage, not native.

Actual390 and1280 pixels inspected: conservative failure toast readable on both.390 toast temporarily overlays portions of the action row; native subsequent download is exercised successfully. Sticky header overlaps upper content outside the target. No whole-page/accessibility/device acceptance claim. Ancillary preview NoFallbackError preserved. Final cumulative stages passed without retry; earlier focused fixture/encoding diagnostics retained. Owned83535 closed,4306 free/no candidate Node. No submission or publication.
