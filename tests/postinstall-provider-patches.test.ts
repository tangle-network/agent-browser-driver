import { describe, expect, it } from 'vitest';

import { applyClaudeCodeExitPatch } from '../scripts/postinstall-provider-patches.mjs';

const resultState = '    let receivedResultMessage = false;\n';
const resultAssignment = '          receivedResultMessage = true;\n';
const catchBlock = `      } else {\n        throw this.handleClaudeCodeError(error, messagesPrompt, collectedStderr);\n      }\n`;

function upstreamSource() {
  return `before\n${resultState}middle\n${resultAssignment}${catchBlock}after\n`;
}

describe('Claude Code provider postinstall patch', () => {
  it('patches the current upstream catch branch and remains idempotent', () => {
    const patched = applyClaudeCodeExitPatch(upstreamSource());

    expect(patched).toContain('else if (receivedResultMessage)');
    expect(patched).toContain('Ignoring post-result process error');
    expect(applyClaudeCodeExitPatch(patched)).toBe(patched);
  });

  it('fails when the upstream result assignment drifts', () => {
    const source = upstreamSource().replace(resultAssignment, '');

    expect(() => applyClaudeCodeExitPatch(source)).toThrow('result-state anchors were not found');
  });
});
