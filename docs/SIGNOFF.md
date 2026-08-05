# Sign-off — the merge gate for browser-agent-driver

**The merge gate is `pnpm signoff`, run locally. CI is not the merge gate.**
A merge whose commit has no valid sign-off proof is a defect, in the same sense a merge with a failing test is a defect — regardless of who merged it or how urgent it was.

The gate itself ships in `@tangle-network/agent-app` (`/signoff`, the `agent-app-signoff` bin).
Its doctrine, the measured comparison against CI, and the calibration against the failures it replaced are in [agent-app's `docs/local-signoff.md`](https://github.com/tangle-network/agent-app/blob/main/docs/local-signoff.md).
This file is how to use it here.

## Run it

```bash
nvm use            # reads .nvmrc — Node 22, and the gate REFUSES another major
pnpm signoff --source head
```

`--source head` is the mode that authorizes a merge: it verifies exactly the commit that would land, so the proof binds to a hash somebody else can check out.
The default (`--source working-tree`) verifies HEAD plus your uncommitted work, which is the right mode while you are still writing, and the wrong one for a sign-off — it cannot catch a file you forgot to `git add`.

Useful flags:

| flag | what it is for |
|---|---|
| `--keep-going` | run every step instead of stopping at the first failure |
| `--seed <n>` | replay a previous run's suite orders exactly |
| `--json proof.json` | the machine-readable record |
| `--keep-workspace` | leave the clean tree on disk to inspect |

Exit 0 means every step passed. Exit 1 is a real failure. Exit 2 is a usage or config error, so "your code is broken" and "your gate is misconfigured" are distinguishable.

Attach the proof — the report block, or the one-line `signoff PASS <sha> …` summary — to the pull request that merges the commit.

## Why `.nvmrc` is the most important line in this repo's adoption

No repo in this fleet had a `.nvmrc` before this gate, and agent-app's calibration measured what that costs: a Vite build asks `module.builtinModules` whether something is a Node builtin before deciding to externalize it, Node 24 lists `node:sqlite` and Node 22 does not, and a suite that imports it bundles cleanly on one major and dies with `Cannot bundle Node.js built-in "node:sqlite"` on the other — CI-only, unreproducible locally, until the runtime pin is actually enforced rather than merely written down in a workflow file nothing reads.

This repo has no confirmed incident of that specific failure. The mechanism is general, not repo-specific, and the fix is the same regardless: `.nvmrc` now carries the pin, and the gate refuses to run on a different major rather than reporting a pass it did not earn.

**This repo's runtime pin is not fully settled, and that is a finding, not a footnote.** `ci.yml` matrix-tests both Node 20 and 22 on every push and pull request. `tier1-gate.yml` and `tier2-staging-gate.yml` pin Node 20 only. `.nvmrc`, `changesets.yml`, `publish-npm.yml`, and `release.yml` all pin 22. The gate's own workflow-pin scanner refuses to run at all when the merge-gate workflows it reads disagree — it caught this disagreement on the first run — so `signoff.config.mjs` declares `nodeVersion: '22'` explicitly to settle it. That declaration does not close the gap: **a regression that reproduces only on Node 20 is invisible to this gate**, and the two-major CI matrix in `ci.yml` is the only thing that still catches it, now running post-merge instead of pre-merge. Unifying the fleet on one Node major is a real fix this document is not making on its own authority.

## What a green run proves

The same commands the `build` job in `.github/workflows/ci.yml` runs (Node 22 leg only — see above), in a clean `git worktree` with a `--frozen-lockfile --ignore-scripts=false` install into a pristine store:

| step | command |
|---|---|
| lint | `pnpm run lint` (`tsc --noEmit`) |
| check boundaries | `pnpm run check:boundaries` |
| build | `pnpm run build` |
| playwright browsers | `pnpm exec playwright install chromium` |
| unit tests | `pnpm run test`, twice, under randomized file order |

Four things it does that CI did not:

- **the runtime is pinned and enforced.** `.nvmrc` says 22; a different major refuses the run.
- **the suite runs under randomized file order**, at least twice, with every seed recorded and a base seed that replays the whole run.
- **the steps run as a dependency graph**, so lint, the boundary check, the build, and the Playwright browser install overlap instead of queueing; only `unit tests` waits, on the browser install.
- **the failure names itself** — step, command, exit code, seed, captured output, and the exact command that reproduces the run.

Two spellings in `signoff.config.mjs` are load-bearing and should not be "simplified" back toward a shorter form:

- **`pnpm run test`, not `pnpm test`.** pnpm's own option parser sits in front of a shorthand script name. Measured on pnpm 10, the shorthand form either rejects the shuffle flags this gate appends or exits 0 having never run the suite — a green step that executed zero tests. `run` is the form that reliably forwards them.
- **`--ignore-scripts=false` on the install.** A developer machine can carry `ignore-scripts=true` in `~/.npmrc` (this fleet's signing host does) and a CI runner cannot. Without the flag the install builds a different dependency tree than the one that ships and reports the result as if it were CI's. The environment-variable spellings of the same setting are silently ignored by pnpm, so it has to be on the command line.

## What it cannot prove

This list is the calibration's, not a summary of it. Do not soften it when you copy it forward.

**1. A machine-specific pass or fail — MITIGATED one way, CANNOT the other.**
The clean tree carries only what git tracks, so a stray file in the checkout cannot leak in. Everything *outside* the tree is the host's: `PATH`, system libraries, the C toolchain, and — specific to this repo — the OS-level packages Playwright's Chromium needs to actually launch (fonts, codecs, `libnss3`, and the rest of the list `playwright install --with-deps` would otherwise manage).
`ci.yml` runs `playwright install --with-deps chromium` on a fresh `ubuntu-latest` image every run. This gate runs `playwright install chromium` — the browser **binary** only, not `--with-deps` — because the dependency layer means `apt-get install`, which needs root and is host package-manager state, not something a checked-out tree carries. On a persistent dev box that already has those libraries from a prior install, the gap is invisible; on a fresh machine, or one where an OS upgrade silently dropped a shared library Chromium needs, this step can pass locally on a stale cache and still fail for a different reason in CI. It is the same class as tax-agent's Python toolchain caveat: the interpreter and its system libraries are the host's, and there is no general local check for the host **having** less than a fresh runner does.

**2. A file that was never committed — CLOSED, but only in `--source head`.**
Measured directly (agent-app's calibration): with an untracked, non-ignored module in the repo, `source: 'working-tree'` copies it into the verified tree (`untracked carried: 1`) and `source: 'head'` does not (`untracked carried: 0`).
The default is `working-tree`, and that default **cannot** catch a forgotten `git add` — by design, since its job is to verify what you are about to commit.
**A sign-off that authorizes a merge must be `--source head`.** That is the mode whose proof binds to a commit hash somebody else can check out.

**3. Platform differences — CANNOT.**
The signing host is Linux x86_64, glibc 2.39, ext4. `ci.yml` runs on GitHub-hosted `ubuntu-latest`; neither runner's core count or memory appears in the job log, so the hardware gap is known to exist and is not quantified here.
Node major is now pinned and enforced for the 22 leg, which removes the one platform variable other repos in this fleet had already lost a day to. Architecture, libc, filesystem semantics, core count, and memory are not pinned and cannot be from inside one machine. A per-test timeout that encodes machine speed is the documented failure mode elsewhere in this fleet (a fast signing host clears a budget a slow CI runner cannot) — if this repo's suite grows one, the mitigation is the same: raise or remove the timeout, don't rely on the gate to reproduce runner speed.

**4. Secrets and network cost — CANNOT, and it is most of this repo's real gate.**
The gate holds no secrets, so every credentialed step is simply absent from the sign-off list. For browser-agent-driver that is **`tier1-gate.yml`** (needs `OPENAI_API_KEY`, makes real billed LLM calls through `router.tangle.tools`) and **`tier2-staging-gate.yml`** (needs `OPENAI_API_KEY` and `AI_TANGLE_STORAGE_STATE`, a live authenticated session against `ai.tangle.tools`, and drives real browser sessions against a real staging site). Both are pass-rate/duration gates on live, non-deterministic infrastructure — not something a local worktree can honestly stand in for, and not something that should run on every local iteration at LLM-call cost.
Nothing local replaces either. They now run **post-merge**, as the safety net described below, exactly like tax-agent's `wrangler versions upload` — the credentialed check that needs a real token and a real call stays where it can have one.

**Also true, and smaller:**

- **It cannot see what no step checks.** It runs the repo's steps hermetically; it does not invent coverage.
- **A derived config is a weaker claim than a declared one**, which is why the origin is printed in the proof. This repo declares `signoff.config.mjs`.
- **The store cache is a speed lever, not a correctness one.** Correctness comes from `--frozen-lockfile` into a fresh `node_modules`; the cache only decides whether the bytes are already on disk.
- **"Cold" is store-cold, not network-cold in the CI sense.** On a slower connection the cold column grows and the warm column does not.

## What CI is now

None of `.github/workflows/ci.yml`, `tier1-gate.yml`, or `tier2-staging-gate.yml` trigger on `pull_request` anymore, so none of them can block a person waiting on a pull request.

- **`ci.yml`**'s `build` job re-runs the same Node-22 verification `signoff.config.mjs` runs (plus a Node-20 leg the local gate does not cover, see above) on every push to `main`, as a post-merge safety net. When it fails it files (or appends to) an issue titled *Post-merge safety net is red on main*, naming the commit, the run, and the command that reproduces it locally.
- **`tier1-gate.yml`** and **`tier2-staging-gate.yml`** keep their existing behavior — they still run on push to `main` and `workflow_dispatch`, they still skip cleanly when their secrets are unavailable (unchanged from before), and a failure now also files into the same rolling safety-net issue instead of blocking a PR nobody can merge past.

`ci.yml`'s `build` job step list and `signoff.config.mjs` are meant to stay identical for the Node-22 leg, with the Node-20 matrix leg and the two secret-gated tier workflows the deliberate exceptions named above. **Adding a step to one without the other makes the sign-off proof a weaker claim than it reads as** — if a workflow checks something the gate does not, a green sign-off no longer means what this document says it means.
