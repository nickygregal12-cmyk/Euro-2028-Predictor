// Design-system feature flags. Kept tiny and explicit; no config lib.

export const FEATURES = {
  // Whole-card navigation to the match centre. Enabled now that the Match Centre
  // (/match/:matchRef) + Matches tab ship — the group predictor's cards pass an
  // onOpen that navigates there. The chevron is a real affordance again.
  matchCardNavigation: true,
}
