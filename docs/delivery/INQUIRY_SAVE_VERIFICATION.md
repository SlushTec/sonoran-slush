# Explicit inquiry save verification

The original explicit Save draft action could announce a saved draft after a silently dropped local write. External store-inquiry-save-red preserves that reproduction: saved-success toast with no stored key and zero network calls.

The action still attempts exactly one write with unchanged values/request_id and expiry policy. Success now requires readable, matching payload in an unexpired envelope. Otherwise it says the draft could not be verified and offers the existing download path; read denial is not labeled definite loss. No autosave, schema, consent, request lifecycle or network change.

Focused final nine cases pass across contact/bulk/event and throw/silent/readback denial. They preserve old bytes on failed write, distinguish successful write with denied readback, retain visible edit and request identity, make no navigation/edit writes, and recover only on explicit Save. Checkbox states and zero network/session attempts are checked. Initial fixture incorrectly assumed a required checkbox existed on every step; preserved failure corrected to exact rendered before/after states. First correction edit failed CP1252 decoding before writes; repeated diagnostic retained, then explicit UTF-8 edit applied. Native actual download fallback and cumulative checks pending source peer.
