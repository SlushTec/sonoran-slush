# Unsent draft download recovery
Private successor of 0a140d36d4f4e69d93d100ca0ae0544d3b66ec1c. Existing Save draft fallback instructs shoppers with unavailable device storage to download instead, but that download could itself fail without feedback. Status-only try/catch now retains the form and offers explicit retry; success says download started and nothing submitted. Editing form values or changing kind clears stale feedback. Payload/filename and consent:false/unsent_draft semantics remain unchanged.

Evidence: external D:\dot-workspace\store-draft-download-*.log/.exit.
- Baseline red missing failure status retained; first case failed/second not run.
- Initial green: 3 passed/1 failed. Desktop field filled before hydration was not retained in its downloaded payload. New test now awaits network-idle initialization and asserts name/email before triggering fallback. No product workaround or assertion weakening. Original initial failure preserved.
- Final new native browser-v2: 2 passed/11.0s,1280/390, actual unavailable-storage save warning followed by forced download failure and explicit successful real file download. Form Unicode/newline and focus retained, no network requests or device data changes, exported consent false/unsent status, feedback clears after edit, no overflow.
- Existing draft-race and leave/return lifecycle cases passed initial run unchanged; not rerun after test-only synchronization.
- 658 frontend, TypeScript, static build, export and archive exit0. Fresh npmci/exact candidate storefront junction. Owned native/build gates closed; port4265 closed.
No real service, complete bulk/event qualification, manual AT, screenshot, physical phone, full browser or release claim. Independent review required.
