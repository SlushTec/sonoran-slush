# RPG-125 bounded webhook intake

November 12 authorized store lane through 20:00 Arizona. Base main
0531e5766f0d23a58936d5330e775e26a8ffe730. Scope: enforce the existing
64KiB Square sandbox event limit while reading the body, rather than after
buffering it. Preserve exact signature bytes and payment gates. No actual
Square call, settings, credentials, commerce activation or deployment.

Independent lane coordination confirmed no overlap with staff history dd62185
or recovery7859074. Prior restricted source and mappings remain excluded.

Acceptance: oversized chunk streams stop at the first excess chunk before
verification/database work; exact-limit and Unicode signed bytes stay intact;
malformed/empty/disconnect paths stay controlled. Full Python/contracts, archive
and links plus independent frozen-source review before publication. ASGI server
incoming chunk allocations and slow-client timeouts are outside this handler
limit. This bounded slice does not complete COM-03 or real-provider acceptance.
