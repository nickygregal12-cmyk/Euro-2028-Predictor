# Single-Tester Entry-Flow Test Script (Phase 2 exit gate)

One trusted tester, one sitting (~30-40 min), run by Nicky. The goal is finding **friction**, not praise. The tester's confusion is the product's fault, never theirs — say that to them at the start.

## Ground rules for the run
- Tester uses **their own phone**, on **mobile data** if possible (not your Wi-Fi).
- You give them the URL and NOTHING else. No walkthrough, no "so first you…".
- During silent tasks: **you say nothing**. No hints, no "it's down there." Watch, and note every hesitation — a hesitation is a finding.
- Note-taking shorthand: ⏸ hesitated · ❓ asked a question · ✗ did the wrong thing first · 💬 said something worth quoting verbatim.

## Part 1 — Silent observation (no coaching)

**Task 1: "Here's a link. Make yourself an account and start playing."**
Watch for: sign-up friction, whether /welcome makes sense (do they read it or skip?), whether they find their way into Group A without help, first reaction to the score inputs.

**Task 2: "Carry on until you've predicted a full group."**
Watch for: score-entry speed and rhythm on their thumbs, whether they notice the group table updating live (💬 if they react), whether "Saved" registers with them at all, whether they understand how to get to the next group.

**Task 3: "Now finish the whole entry — everything the app wants from you."**
The big one. Watch for: do they understand the hub as a checklist? Do they find the third-place screen confusing? The bracket — do they understand tap-to-pick without instruction? Do they place jokers at all unprompted, and do they understand what a joker is from the UI alone? Do they reach Review and understand what's blocking submission (if anything)? Do they submit?
- If a tie-resolution prompt appears naturally, gold — watch closely. If not, don't engineer one mid-test; ask about the concept in debrief instead.

## Part 2 — Directed tasks

**Task 4:** "Join my league" — send them the invite link by WhatsApp, exactly as a friend would. Watch the join flow land.
**Task 5:** "Find out how many points an exact score is worth." (Tests discoverability of the scoring page.)
**Task 6:** "Change your mind about one of your bracket picks — make [team] win instead." (Tests the cascade dialog comprehension if downstream picks exist. 💬 their reaction to the dialog.)
**Task 7:** "Move one of your jokers to a different match." (Tests joker manageability + the overview screen.)
**Task 8:** "Sign out and back in." (Tests the confirm, password recall reality, session behaviour.)

## Part 3 — Debrief questions (ask open, don't lead)

1. "Walk me through what this game is, as you'd explain it to a mate." (Tests whether the model landed.)
2. "What was the first moment you weren't sure what to do?"
3. "Anything feel slow, fiddly, or annoying — especially entering scores?"
4. "What do the jokers do?" (In their words — reveals whether the gold UI taught the rule.)
5. "When does all this lock? What happens after that?" (Tests deadline comprehension.)
6. "Would you actually play this next summer? What would make you tell friends about it?"
7. "Anything you expected to find that wasn't there?"

## Findings → actions
Write findings same-day into three buckets:
- **Fix before Phase 3** (broke comprehension of the core loop)
- **Fix eventually** (friction, not failure)
- **Note only** (preference/one-off)
Report the bucketed list back into the project chat for triage into build-todo.

## Pass bar
The test "passes" if the tester completes a full valid entry and joins a league with zero verbal help. Anything else is findings, not failure — that's the point of running it.
