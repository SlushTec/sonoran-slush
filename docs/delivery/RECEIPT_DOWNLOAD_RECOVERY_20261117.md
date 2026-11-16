# Private receipt download recovery
Baseline 33c407dff8c4ad941bee7f709f59132a36efe0e3. Checkout receipt button previously let synchronous browser download errors escape with no recovery message. A status-only try/catch now tells the shopper to retry before leaving, not resubmit an already-confirmed request. Successful invocation says download started, not saved. Status clears when starting another request. Original receipt validation, download payload/filename, request lifecycle and privacy persistence remain unchanged.

External evidence D:\dot-workspace\store-receipt-download-*.log/.exit:
- Original native red missing failure status retained, first desktop case failed and second not run.
- First edit script failed before writing because CRLF did not match; its accidentally continued unchanged native failure and frontend/type logs retained, not product verification.
- Corrected editor normalized line endings and was guarded before the final chain. Final browser-v2: 3 passed, 11.8 seconds (new desktop/mobile plus existing malformed-receipt case). Forced download failure retains focus, local/session bytes and one request; retry downloads only exact validated receipt fields, no secret persists, start-another clears feedback without submitting.
- Final frontend-v2: 658 passed; types-v2/build/export/archive exit 0. Fresh npm ci, exact candidate storefront junction. All owned jobs closed, port4261 closed.
- Synthetic intercepted commerce responses only. No real request, manual AT, screenshot, full browser suite or release claim.
Independent review required.
