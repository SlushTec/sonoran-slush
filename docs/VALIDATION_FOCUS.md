# Personalization validation keyboard recovery

The two existing missing-text/photo validation branches now use the existing step-selection focus helper. Rejected Add design to bag returns focus to the already-mounted personalization tab, rather than losing focus when the finishing-step button disappears. Exact validation conditions and error text are unchanged; no rejected request mutates the bag or draft. No new effect, state, storage or policy is introduced.

Original external BODY-focus failure is retained. Two focused DOM cases cover repeated rejection and explicit valid retry for text and photo-later paths. The first focused test attempt used incorrect exact labels (nested help text and punctuation); that diagnostic is preserved and only new test locators were corrected. Four production keyboard scenarios cover both paths at 1280/390. Results and screenshot qualification are recorded separately; no manual assistive-technology claim.
