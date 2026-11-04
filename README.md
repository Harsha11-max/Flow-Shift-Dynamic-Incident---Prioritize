# FlowShift — Dynamic Incident Prioritizer

**Medium-level Software Engineering project · Vanilla HTML, CSS, and JavaScript**

FlowShift solves a **dynamic resource allocation problem**: When a city service desk has more incidents than response teams, which incidents should be handled first? The answer changes as fresh emergencies arrive, incident deadlines approach, workers become available, and cases are resolved.

Unlike a static first-come-first-served list, FlowShift continually recalculates an **explainable priority score** and automatically assigns the highest-ranked open incidents to the limited available teams.

## Problem statement

A support center receives incidents with different levels of urgency, number of people affected, and response-time targets (SLAs). The number of response teams can change at any moment. A fixed dispatch order creates delays for urgent cases and cannot react quickly to shortages or demand spikes.

**Goal:** Build a transparent dashboard that reprioritizes pending incidents automatically after any change in incident state, available capacity, or simulated time.

## Solution and features

- **Dynamic priority queue:** Scores are recalculated and sorted whenever anything changes.
- **Emergency injection:** Add a high-urgency case and observe its new queue position.
- **SLA escalation:** Cases approaching or missing their target get extra priority points.
- **Aging fairness:** Incidents waiting longer gradually receive an increased score to reduce starvation.
- **Capacity-aware dispatch:** Only the top N open incidents receive teams; reducing N automatically returns lower-ranked incidents to waiting.
- **Resolve and reopen:** Completing an incident releases its slot; reopening sends it back into ranking.
- **Demand surge and time simulation:** Test changing operating conditions.
- **Explainability:** Select **Why?** to inspect how the four score components were calculated.
- **Audit trail and browser persistence:** Actions appear in history, and the demo is saved in `localStorage`.
- **Automated unit tests:** Verify emergency ranking, capacity changes, aging, deadline escalation, input validation, and more.

## Priority algorithm

```
priority = 15 × urgency
         + 10 × people_affected
         + min(36, 3 × floor(minutes_waited / 10))
         + deadline_bonus
```

Deadline bonus:

| Time remaining to response target | Bonus |
|---|---:|
| More than 45 minutes | +0 |
| 16–45 minutes | +10 |
| 1–15 minutes | +22 |
| Deadline reached or overdue | +40 |

The engine sorts by descending total score, breaking ties by the earlier deadline, earlier creation time, then ID. The **first `availableTeams` incidents are dispatched**. The rest wait in the queue. Already resolved tickets are excluded.

> **Important:** This is a rule-based educational prototype, not a real emergency dispatch system or trained AI. Its numeric weights are demonstration assumptions; real-world deployment would require validated policies, human oversight, security, and access to trustworthy data.

## Live example: why the problem is dynamic

1. Start the app. Seven incidents compete for **two** response teams.
2. Click **Inject emergency**. A new clinic oxygen incident enters the queue with high urgency and a short target. The ranked order and assignments immediately change.
3. Click **+15 minutes**. Waiting-time and deadline scores increase, potentially changing the order.
4. Click **−** next to response teams. The system now has fewer responders, so additional incidents enter the waiting queue.
5. Click **Resolve** on an assigned incident. The next highest-ranked eligible incident immediately takes its place.
6. Click **Why?** on any case to inspect the exact scoring math.

## Run locally (Windows / VS Code)

No installation is needed for the website:

1. Download and extract the project ZIP.
2. Open the extracted folder in **VS Code** (File → Open Folder).
3. Open `index.html` in any browser (double-click the file in File Explorer), **or** use the VS Code Live Server extension.
4. Test the buttons, add incidents, advance simulated time, and change team capacity.

Optional automated tests require Node.js (v18+):

```bash
npm test
```

No `npm install` is needed; tests use Node's built-in test runner.

## GitHub upload

**Simple method (no terminal required):**

1. Create a **public** repository named `FlowShift-Dynamic-Incident-Prioritizer` on GitHub.
2. Select **Add file → Upload files**.
3. Upload the **contents of the extracted folder** (not the ZIP itself). Include the `tests` directory.
4. Write the commit message `Build FlowShift dynamic incident prioritization system` and click **Commit changes**.
5. To publish the app, visit **Settings → Pages**, set **Deploy from a branch**, choose **main** and **/(root)**, then **Save**. GitHub Pages will provide a public site address after deployment.

## Project structure

```text
FlowShift-Dynamic-Incident-Prioritizer/
├── index.html          # Dashboard layout
├── styles.css          # Responsive UI design
├── engine.js           # Pure scoring and scheduling functions
├── app.js              # UI, simulated events, persistence
├── tests/
│   └── engine.test.cjs # Automated unit tests
├── package.json        # npm test script
└── README.md           # Problem, algorithm, setup, evidence
```

## Design choices and limitations

- **Priority computation:** `O(n log n)` per replan because incidents are scored in `O(n)` and sorted in `O(n log n)`.
- **Storage:** Local to one browser; this is not a collaborative/multi-device app.
- **Simulation:** Advancing time does not change the real system clock; an offset simulates later operating conditions. The display also refreshes periodically as real time passes.
- **Resource model:** One incident occupies one response-team slot. This prototype does not model staff skills, travel routes, or partial completion.
- **Safety:** For classroom use only. Do not rely on it for real incident response or emergency decisions.

## Future enhancements

Connect a backend/database for multiple users, implement role-based approvals, send notification events, and allow team skill matching and geospatial assignment.

## Learning outcomes

This project demonstrates changing requirements/constraints, priority scheduling, SLA policy, fairness/aging, state management, event-driven interfaces, persistence, and testable separation of business logic from presentation.

## License

MIT — created as an educational demonstration project.
