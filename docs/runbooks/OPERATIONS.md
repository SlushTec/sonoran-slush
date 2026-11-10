# Operating requirements

Implement alarms for availability, order/payment webhook lag, failed outbox deliveries, stock conflicts,
AI token/cost budgets, upload quarantine failures and approaching storage/compute budgets.
Keep logs structured and redacted; correlation IDs must not carry customer input. Define alert ownership.

Schedule restore drills and verify actual order/proof/payment recovery before launch. Document dependency patching,
credential rotation, suspicious-upload response, payment reconciliation and customer-support escalation.
No ongoing monitoring automation or background agent has been activated by this scaffold.
