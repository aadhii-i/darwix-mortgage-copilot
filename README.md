# Darwix AI Mortgage Copilot: interactive prototype

A clickable prototype for the Darwix AI PM assessment. It follows one meeting with Sarah + Michael, first-time homebuyers, from preparation to operations. It is built to match the 6-slide deck: product philosophy, the 8 intervention moments, confidence tiers, integrations, and human-control boundaries.

## Run
Open `index.html` in a browser. There is no build step, backend, or install. All data is mocked.

## Demo path (about 4 min)
Follow the dark **guided demo** bar at the bottom. It highlights the next click.

1. Dashboard → **Prepare meeting**
2. Brief → confirm consent → **Start meeting**
3. Live meeting → **Continue conversation** → affordability nudge → **Use nudge** (Target payment is captured)
4. Conflicting income → **Verify** (Income → Pending verification, never marked verified)
5. "You should be approved for this." → **⚠ Compliance review** → **Rephrase** (the event is logged)
6. Competitor objection → **Use** · Missing liabilities → **Confirm** · Next best action → **Confirm**
7. **End meeting** → draft summary (86% · 2 to verify · 1 compliance item · 2 documents) → **Approve summary**
8. Next actions → approve CRM, review and send customer-facing items (LOS is queued safely)
9. **Manager**, then **Operations**

Dismiss and Escalate work on every nudge, and the summary, manager, and ops views reflect those choices.

## Files
- `index.html`: page shell
- `styles.css`: visual identity from the deck (indigo, lavender AI surfaces, amber compliance)
- `app.js`: scripted meeting, intervention logic, agent decisions, and all screens
# darwix-mortgage-copilot
