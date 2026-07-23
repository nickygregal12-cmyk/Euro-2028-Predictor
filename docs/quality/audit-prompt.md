# Reusable master audit prompt

## Purpose

This file is the controlled repository location for the complete, approved prompt used to perform repeatable evidence-based audits of the Euro 2028 Predictor.

## Pending approved content

The complete approved audit prompt will be supplied separately. Do not invent, summarise or shorten it during quality-governance setup.

When the approved prompt is inserted, future edits must preserve all of the following controls:

- evidence-based findings tied to exact repository and environment evidence;
- comparison against previous verified baselines and resolved findings;
- regression detection and silent-feature-loss checks;
- environment-isolation checks across local, preview, development, staging and production where applicable;
- Supabase schema, migration, Row Level Security, function, trigger, authentication and permission checks;
- comparison against [`feature-baseline.md`](feature-baseline.md);
- non-destructive audit rules and explicit human approval for production-sensitive actions;
- separation of confirmed defects, likely defects, design concerns, missing evidence and recommendations;
- recording of audited branch, commit SHA, deployed version and inaccessible systems;
- strict scope control so previous predictor projects and future planned modes are not treated as current requirements.

Do not replace the approved prompt with a generic website-audit checklist. Material prompt changes should be reviewed like a quality-control change because they affect future audit comparability.
