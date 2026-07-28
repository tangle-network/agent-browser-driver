#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

export function applyClaudeCodeExitPatch(source) {
  const resultState = '    let receivedResultMessage = false;\n';
  const resultAssignment = '          receivedResultMessage = true;\n';
  const catchNeedle = `      } else {\n        throw this.handleClaudeCodeError(error, messagesPrompt, collectedStderr);\n      }\n`;
  const patchedCatchNeedle = '      } else if (receivedResultMessage) {\n';

  if (!source.includes(resultState) || !source.includes(resultAssignment)) {
    throw new Error('Claude Code provider patch failed: result-state anchors were not found.');
  }

  if (source.includes('Ignoring post-result process error')) {
    if (!source.includes(patchedCatchNeedle)) {
      throw new Error('Claude Code provider patch failed: patched catch branch was not found.');
    }
    return source;
  }

  if (!source.includes(catchNeedle)) {
    throw new Error('Claude Code provider patch failed: upstream catch anchor was not found.');
  }

  return source.replace(
    catchNeedle,
    `      } else if (receivedResultMessage) {\n        warnings.push({\n          type: "other",\n          message: \`Claude Code process exited after emitting a final result: \${error instanceof Error ? error.message : String(error)}\`\n        });\n        this.logger.warn(\n          \`[claude-code] Ignoring post-result process error: \${error instanceof Error ? error.message : String(error)}\`\n        );\n      } else {\n        throw this.handleClaudeCodeError(error, messagesPrompt, collectedStderr);\n      }\n`,
  );
}

const patches = [
  {
    name: 'ai-sdk-provider-claude-code',
    file: path.join(ROOT, 'node_modules/ai-sdk-provider-claude-code/dist/index.js'),
    apply: applyClaudeCodeExitPatch,
  },
];

function applyProviderPatches() {
  for (const patch of patches) {
    if (!fs.existsSync(patch.file)) continue;
    const original = fs.readFileSync(patch.file, 'utf8');
    const updated = patch.apply(original);
    if (updated !== original) {
      fs.writeFileSync(patch.file, updated, 'utf8');
      console.log(`[postinstall] patched ${patch.name}`);
    }
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : undefined;
if (import.meta.url === invokedPath) applyProviderPatches();
