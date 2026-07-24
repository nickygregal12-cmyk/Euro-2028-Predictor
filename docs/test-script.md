# Single-Tester Entry-Flow Test Script

One trusted tester, one sitting (about 30–40 minutes), run by Nicky. The goal is finding **friction**, not praise. The tester's confusion is the product's fault, never theirs — say that at the start.

This is a usability and comprehension test, not proof of production readiness. Current code, `docs/quality/current-status.md` and hosted compatibility evidence decide which environment is safe to test.

## Environment prerequisites

- Use a current Euro 2028 preview or development environment connected to development Supabase at the repository's compatible database contract.
- Do not use the legacy `euro28-predictor-dev.netlify.app` site; it belongs to the protected World Cup environment.
- Verify login, signup and recovery are usable in the selected environment before involving the tester. A successful static preview build is not enough.
- Do not use production for this flow while the application/database compatibility gate remains open.
- Record the exact URL, commit/deploy identity, device and date with the findings.

## Ground rules

- The tester uses **their own phone**, on **mobile data** if practical.
- Give them the URL and nothing else. No walkthrough or hints.
- During silent tasks, say nothing. Watch and note every hesitation.
- Note-taking shorthand: ⏸ hesitated · ❓ asked a question · ✗ tried the wrong action first · 💬 useful verbatim reaction.

## Part 1 — Silent observation

**Task 1: “Here’s a link. Make yourself an account and start playing.”**

Watch for signup friction, Turnstile or recovery problems, whether `/welcome` makes sense, whether they find Group A without help, and their first reaction to score inputs. Check that focusing email/password fields does not cause disruptive viewport zoom and that every submit action has visible progress or a safe error state.

**Task 2: “Carry on until you’ve predicted a full group.”**

Watch score-entry speed, thumb accuracy, whether the live group table is noticed, whether the save state is trusted, and whether the route to the next group is obvious. Record repeated mis-taps or hunting for a continuation action as findings rather than explaining the interface.

**Task 3: “Now finish the whole entry — everything the app wants from you.”**

Watch whether the prediction hub reads as a checklist; whether third-place selection is understood; whether tap-to-pick bracket behaviour is self-explanatory; whether Jokers are discovered and understood; and whether Review clearly explains anything blocking submission.

If a tie-resolution prompt appears naturally, observe it closely. Do not manufacture one mid-test; discuss the concept in the debrief instead.

For submission, pay particular attention to the final visible edit immediately before pressing submit. Any lost edit, save conflict or unclear failure is evidence against the remaining browser-closure requirements for `REL-003` and related persistence controls.

## Part 2 — Directed tasks

**Task 4:** “Join my league.” Send the invite link exactly as a friend would. When signed out, check whether the visitor understands what they were invited to before being asked to authenticate. A contextless auth form remains evidence for `UX-001`.

**Task 5:** “Find out how many points an exact score is worth.” This tests scoring-page discoverability.

**Task 6:** “Change your mind about one bracket pick — make [team] win instead.” This tests downstream cascade-dialog comprehension.

**Task 7:** “Move one of your Jokers to another match.” This tests Joker manageability and overview comprehension.

**Task 8:** “Sign out and back in.” This tests confirmation, session behaviour and practical password recall.

## Part 3 — Debrief questions

1. “Walk me through what this game is, as you’d explain it to a mate.”
2. “What was the first moment you weren’t sure what to do?”
3. “Anything feel slow, fiddly or annoying — especially entering scores?”
4. “What do the Jokers do?”
5. “When does all this lock, and what happens after that?”
6. “Would you actually play this next summer? What would make you tell friends?”
7. “Anything you expected to find that wasn’t there?”

## Findings and actions

Write findings up the same day with:

- the exact task and observed behaviour;
- environment/deploy identity and device;
- impact on completion, trust or comprehension;
- reproduction steps where practical;
- severity and the relevant existing finding ID, or a proposed new ID when the root cause is materially different.

Create or update GitHub Issues for actionable work. Update `docs/build-todo.md` only when sequencing changes; do not use chat or the TODO as implementation evidence.

## Pass bar

The tester completes a full valid entry and joins a league with zero verbal help. Anything else produces findings, not a failed tester. This pass bar demonstrates usability only; it does not close database, production compatibility, security, recovery or browser-E2E gates by itself.
