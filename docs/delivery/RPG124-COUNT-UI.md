# RPG-124 / SS-048 single-bucket count comparison UI

Base a8fcd5af76884bfc770162462415a50959b21110, reviewed count API PR39. Existing staff availability and inspection children have no count-preview lookup. New child in verified StaffWorkspace only, keyed to existing in-memory session generation.

Staff enters a synthetic lot, location, condition and observed count. Zero is valid. One manual comparison first reads/validates availability with the existing positive projection helper, then POSTs the read-only count-preview using that exact version and one explicit bucket. Revalidate request epoch/session before each stage. Server version conflict requires a fresh manual comparison, never an automatic retry or inferred approval.

Validate response identity/component/unit/version, scope flags, exactly one matching observation, recorded count/reservation floor against the fetched view, exact variance and conflict flag. Project only safe display fields; discard metadata. Show recorded/observed/difference/held-floor, version and explicit no-applied/no-authority labels. Omitted buckets and pending/rejected intake are not counted. It is not a count correction UI.

Inputs/Clear/Lock/session/unmount invalidate both requests/results. No storage, polling, credentials in URLs, arbitrary backend messages, direct mutations or activation. Reuse existing commerce client and availability validator, preserve all old children/writers. Tests cover projection, errors, both async stages, credential boundaries, DOM/browser accessibility/mobile/lock and independent frozen review. Full tests/build/typecheck/CI before integration; existing RPG124 remains open. Stop by Nov13 03:00UTC.
