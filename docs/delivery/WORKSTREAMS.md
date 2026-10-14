# Four-agent delivery ownership

These are work packages ready for assignment, NOT claims that agents have been launched.
No inherited classroom deadline, fake team identity, hourly automation or existing RPG work-order rules apply.

| Agent | Owns | First integrated deliverable |
| --- | --- | --- |
| AGENT-01 | Storefront, responsive design system, product/configuration UX, customer/owner screens | Approved product browse + accessible persistent configuration |
| AGENT-02 | Commerce domain, contracts, money/stock/payment/proof/quote/event workflows | One durable configuration-to-order path with verified test payment and proof gate |
| AGENT-03 | Optional Bedrock assistant, catalog retrieval, artwork assistance, AI evals | Bounded tool calls over approved data; failure cannot block shopping |
| AGENT-04 | AWS, CI/CD, integration, security/operational evidence | Repeatable non-production deployment with private data boundaries and recoverable release |

## Coordination

Contract owner AGENT-02 publishes changes before dependent UI/AI work. AGENT-04 serially integrates tested PRs.
Each lane works on its own feature branch. Review rotation: 01 reviews 02's customer contracts;
02 reviews 03's tool authority; 03 reviews 04's AI exposure/configuration; 04 reviews 01's release/accessibility evidence.
Cross-domain money/privacy changes additionally require the appropriate domain reviewer and owner release approval.
Do not share an uncommitted worktree or have two agents merge at once. Do not touch unrelated local workloads.

## Milestones, not invented dates

M0: reproducible foundation and preserved sources (this reset).
M1: approved catalog + durable retail/personalization + test payment/proof vertical slice.
M2: all product families, quotes, events and owner production workflows integrated.
M3: optional AI and polished discovery/recovery/notifications.
M4: security/accessibility/performance/restore acceptance and live launch approval.

See `backlog.json`; future tasks start planned, not completed. Agent activation is a separate owner action.
