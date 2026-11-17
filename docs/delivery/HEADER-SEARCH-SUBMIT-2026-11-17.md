# Header search keyboard submission

Private bounded UX-01/UX-02 keyboard discovery repair on c884437. The header search previously had no submit action: Enter in the populated input stayed on the current page despite the existing Browse all results link. A native GET form now submits the same /shop query destination, closes the dialog, and uses browser encoding for the unchanged input value. The existing link and quick-result navigation remain unchanged. No product/filter/persistence/commerce policy changes.

Native baseline red remained on /help after Enter. Two final Edge tests at 1280/390 passed, covering Enter, destination query, accented text plus ampersand, empty query, Back, repeated opening and Escape focus. Full frontend 658, typecheck, static build/export and archive preservation passed. No full browser-suite, physical-phone or manual assistive-technology claim.

Initial RDC failed to write the test; its first launch reported no tests. File absence and closed job were checked before retry. All initial logs remain outside the candidate. Final evidence is store-submit-browser/frontend/types/build/export/archive logs and exits. Independent review required; no publication or held-source changes.
