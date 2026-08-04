# Provider-ingestion custody — contract 81

Contract 81 adds a server-only evidence boundary for football-provider responses. It deliberately does not make provider data authoritative competition state.

## Boundary

- `provider-poll` accepts only a named `apikey` caller key before any provider I/O.
- Provider requests remain on fixed HTTPS origins and bounded relative paths; credential-shaped query parameters are refused.
- The exact raw response text is archived in `predictor_internal` before parse or decode.
- Decoder attempts are append-only evidence and never rewrite an earlier response or attempt.
- Browser roles receive no custody-table access and cannot call the two custody RPCs; only `service_role` can execute them.
- Response size, retained headers and decoded fixture identities are bounded and validated.
- No provider path writes official fixtures, results, locks, scores, totals, ranks or standings.

## Delivery sequence

1. Merge only after exact repository gates pass.
2. Apply the single additive migration to Development through `.github/workflows/development-fast-lane-rollout.yml` and verify the ledger reaches 81.
3. Align the machine-readable Development contract and Netlify non-production declaration after hosted verification.
4. Deploy the Edge Function to Development only after the migration is present.
5. Do not configure or call a provider until the named caller key and bounded non-production credential are separately available.

Production remains at contract 63 and has no fast lane.
