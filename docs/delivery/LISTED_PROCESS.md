# Listed process discovery

RPG-117 / SS007 includes technique-based discovery. This bounded slice uses only existing public `infoFor(product).details` entries whose label is exactly `Process`; it introduces no manufacturing taxonomy or claims. Values are not inferred from material, category, source paths or private sources.

The optional Listed process control shares existing catalog URL restoration, replace-state edits, reset and conjunctive filtering. Typo suggestions use the same selected process eligibility. All processes includes products without listed metadata. The visible qualification explains partial metadata. Existing prices remain unknown; this does not complete price filtering, physical process validation or full SS007 acceptance.

Evidence: external `store-process-red.log` preserves two missing-control failures against unchanged product source. Focused DOM, native desktop/mobile and repository checks are recorded separately in the external acceptance receipt. Native tests cover keyboard choice, exact result count, product Back/reload, explicit typo recovery, incompatible-process no-suggestion, reset and unrelated URL preservation. No live commerce or customer data used.
