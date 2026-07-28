---
"@tangle-network/browser-agent-driver": patch
---

Surface the agent's result in the CLI output and the `bad view` viewer.

Previously, when a run's completion message was empty the agent's answer was written only to `goalVerification.evidence` in `report.json`; the CLI printed a bare "Goal achieved" and the viewer showed the same, so the actual result was hidden. Now:

- The CLI prints the full result under the run's ✓/✗ line, with multi-line output preserved and indented (multi-task rows collapse to one line).
- `bad view` renders it in a "Result" panel, derived directly from the report so it also shows for existing runs.
