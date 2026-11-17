# Protect inquiry initialization from early edits
Private successor of 3730eb7eed100ab7bceb03d1a305b6226081e981. A deliberately delayed JavaScript cold-load test proves the SSR name field accepted text which hydration then silently reset to empty. The original failure is retained in store-inquiry-ready-red.log/.exit.

The existing requestID initialization now gates an explicitly labeled disabled fieldset, with preparing status and aria-busy. Once saved draft/default values and request identity are initialized, existing controls become usable. The submit handler also rejects missing requestID. No saved data, payload, request identity generation, business promise or post-initialization behavior changes.

External store-inquiry-ready-* evidence:
- Initial repaired native5/5,22.9s includes cold load plus existing draft failure/lifecycle/race cases.
- Expanded final cold-load tests at1280/390 cover disabled preparing state, ready edits, save/reload retaining exact fields and no overflow. Final browser-v4:2passed13.5s.
- Earlier v2/v3 tests passed but screenshots captured fixed header during smooth scrolling. Final capture uses instant scroll plus scrollY=0 check; settled390/1280 images were inspected. Dev-only Next indicator remains visible; this is not a production screenshot.
- 658 frontend, TypeScript, static build, export, archive all exit0. Exact fresh storefront junction. Final native port4269 closed, owned jobs closed; prior4267 was released before Grid reused it.
- Export72pages/4399links/40images/oneH1/noarchive; archive67+41.
No fullbrowser, physicalphone, manualAT, real request or release claim. Independent review required.
