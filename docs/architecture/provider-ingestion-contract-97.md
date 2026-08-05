# Provider-ingestion custody — contract 97

Contract 97 adds a server-only evidence boundary for football-provider responses. It deliberately does not make provider data authoritative competition state.

- A named `apikey` caller key is checked before provider I/O.
- Requests remain on fixed HTTPS origins and bounded relative paths; credential-shaped query parameters are refused.
- Exact raw response text is archived in `predictor_internal` before parse or decode.
- Processing attempts are append-only evidence.
- Browser roles receive no custody access; the two RPCs are service-role-only.
- No provider path writes official fixtures, results, locks, scores, totals, ranks or standings.

Contract 97 is merged and its custody boundary has been carried through the later repository and development contract sequence. Moving hosted levels and Netlify declarations belong in the machine records and live operations status, not this contract note. The remaining product step is one bounded non-production provider rehearsal proving the archived raw response, strict decode and processing evidence while writing no official competition truth. This document authorises no credential change, provider request, hosted rollout or production mutation.
