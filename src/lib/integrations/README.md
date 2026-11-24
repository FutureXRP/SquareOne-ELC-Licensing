# Integrations seam

Nothing is built here in v1 (BUILD.md section 1). Stripe, the Anthropic API, ProCare,
CECPD/OPDR and Google Calendar are out of scope until access and data handling are confirmed
(phase 5).

When an integration is approved, it gets one folder here with a typed client and no direct
database writes: it returns records, and a server action validates and stores them like any
other input.
