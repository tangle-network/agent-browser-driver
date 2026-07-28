/**
 * The agent's user-visible answer for a run: its completion message
 * (`agentResult.result`), or — when that is empty because the agent emitted its
 * findings as goal-verification evidence instead — the joined evidence. Returns
 * `undefined` when neither is present.
 *
 * Shared by `buildVerdict` (test-runner) and `normalizeReport` (cli-view) so the
 * terminal, the report's `verdict` field, and the `bad view` viewer all surface
 * the same answer. Loosely typed and defensive: a report loaded from disk or
 * hand-edited may carry a non-string `result` or non-array `evidence`, so every
 * access is runtime-guarded rather than trusting the `AgentResult` types.
 */
export function deriveAnswer(agentResult: {
  result?: unknown;
  goalVerification?: { evidence?: unknown } | null;
}): string | undefined {
  const message = typeof agentResult.result === 'string' ? agentResult.result.trim() : '';
  if (message) return message;
  const rawEvidence = agentResult.goalVerification?.evidence;
  const evidence = (Array.isArray(rawEvidence) ? rawEvidence : []).filter(
    (e): e is string => typeof e === 'string' && e.trim().length > 0,
  );
  return evidence.length ? evidence.join('\n') : undefined;
}
