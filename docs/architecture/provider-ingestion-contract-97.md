# Provider-ingestion custody — contract 97

Contract 97 adds a server-only evidence boundary for football-provider responses. It deliberately does not make provider data authoritative competition state.

- A named `apikey` caller key is checked before provider I/O.
- Requests remain on fixed HTTPS origins and bounded relative paths; credential-shaped query parameters are refused.
- Exact raw response text is archived in `predictor_internal` before parse or decode.
- Processing attempts are append-only evidence.
- Browser roles receive no custody access; the two RPCs are service-role-only.
- No provider path writes official fixtures, results, locks, scores, totals, ranks or standings.

After merge, apply the pending additive migrations to Development through `.github/workflows/development-fast-lane-rollout.yml`, verify the ledger at 94, then align non-production declarations. Production remains at contract 63 and has no fast lane.
