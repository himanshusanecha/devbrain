# DevBrain

> Git-aware persistent memory for AI coding agents via Obsidian.

[![npm version](https://img.shields.io/npm/v/devbrain)](https://www.npmjs.com/package/devbrain)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Every AI coding agent starts with zero memory. Switch git branches and the agent has no idea what decisions were made, what's blocked, or what the last session accomplished. You re-explain everything, every time.

**DevBrain fixes this.** It hooks into git to detect branch switches, loads branch-scoped context from your Obsidian vault automatically, and exposes that context to every agent through a single shared MCP server. Agents arrive informed. Sessions end with structured handoffs. Knowledge accumulates.

- **Branch-scoped memory** — each branch has its own context note, progress log, and handoff history
- **Two agents, one vault** — Claude Code and Antigravity IDE both read and write from the same vault
- **Zero git disruption** — hooks fail silently if Obsidian is closed; git never blocks

---

## How It Works

```
git checkout feature/my-feature
        │
        ▼
post-checkout hook fires
        │
        ▼
DevBrain → Obsidian Local REST API (localhost:27124)
        │
        ├── Creates branch note if new:  Projects/{repo}/branch-feature-my-feature.md
        ├── Updates active pointer:      ACTIVE_CONTEXT.md
        └── Opens the note in Obsidian
        │
        ▼
Agent session starts → calls get_active_context
        │
        ▼
Agent knows: repo, branch, last session summary,
             files changed, blockers, next actions
```

Obsidian stays open. Hooks are silent. Agents just know.

---

## Prerequisites

1. [Obsidian](https://obsidian.md) installed and **open**.
2. **Local REST API plugin** enabled:
   `Obsidian → Settings → Community Plugins → Browse → "Local REST API" by Adam Coddington → Install → Enable`
3. Copy your API key from `Settings → Local REST API`.
4. Node.js 18+ and Git.
5. Claude Code or Antigravity IDE.

---

## Quick Start

```bash
# 1. Install globally
npm install -g devbrain

# 2. Run the setup wizard (detects your vault, configures all agents)
devbrain init

# 3. Link a repository
cd /path/to/your/repo
devbrain setup-repo .
```

`devbrain init` auto-configures Claude Code and Antigravity IDE. It writes `~/.devbrain.env` and sources it from your shell rc.

`devbrain setup-repo` installs `post-checkout`, `post-commit`, and `post-merge` git hooks, creates the vault folder structure, and prints an **initialization prompt** — read on.

---

## Day 1: Initializing a Repo

After `devbrain setup-repo`, the terminal prints an initialization prompt. **Copy it and paste it into your AI agent.** The agent will:

1. Read your entire codebase exhaustively
2. Call `init_repo_context` to record the repo's purpose and seed `DECISIONS.md` with initial architectural decisions
3. Use `write_architecture_doc`, `write_feature_doc`, `log_bug`, `upsert_config_entry`, and `update_plan` to build the full vault doc set
4. Use `write_custom_doc` to create `Index.md` (your vault's Map of Content)
5. Call `write_handoff` to close the session

This only happens **once per repo**. After that, the standard session workflow takes over.

The initialization prompt is also available as a standalone file at `prompts/init-repo-context.md` if you ever need to re-run it.

---

## Agent Configuration

`devbrain init` handles all of this automatically. The configs are here for reference or manual setup.

### Claude Code

Add to `.mcp.json` in the project root (safe to commit — no secrets):

```json
{
  "mcpServers": {
    "devbrain": {
      "command": "devbrain",
      "args": ["mcp"]
    }
  }
}
```

`devbrain init` also writes this to `~/.claude/settings.json` for global access. The API key is loaded at runtime from `~/.devbrain.env`, so the JSON file contains no credentials.

Drop `agent-configs/claude/CLAUDE.md` into your project's `.claude/` folder to give Claude Code specific instructions for when to call each tool.

### Antigravity IDE

Run once after install:

```bash
devbrain build-schemas
```

This generates static JSON tool schemas at `~/.gemini/antigravity-ide/mcp/devbrain/` that Antigravity IDE reads natively.

---

## Agent Workflow

### Phase 0 — First-time repo setup *(once per repo)*

Run `devbrain setup-repo .` → copy the printed prompt → paste into your agent → agent builds all vault docs.

---

### Phase 1 — Planning a sprint or feature *(before coding starts)*

When you have something new to build — a feature, a sprint, a significant change — plan it in the vault before writing any code.

Paste `prompts/plan-feature.md` into your agent. The agent will:

1. Call `get_active_context` and `get_decisions` to load repo context
2. Ask you: goal, scope, constraints, open questions
3. Propose a technical breakdown for your review
4. Once confirmed, call `write_sprint_plan` — atomically creates:
   - `Plans/{slug}.md` — goal, scope, technical breakdown, task table, dependencies, risks
   - `PLAN.md` rows — one per task, each linking to `[[Plans/{slug}]]`

**When to use:** "build me X", "start a sprint on Y", "plan the auth system".
**When to skip:** small bug fixes, config tweaks, or tasks already in `PLAN.md`.

---

### Phase 2 — Start of every session

Always start by calling `get_active_context`. The response includes:

| Field | Description |
|---|---|
| `repo` | Current repo name |
| `branch` | Current branch |
| `is_initialized` | `false` on first use — triggers `init_repo_context` |
| `last_session` | Agent name, summary, files changed, timestamp |
| `blocked_on` | Blockers from the previous session |
| `next_session_start` | What this session should do first |
| `related_notes` | Vault notes tagged to this branch |

If `is_initialized` is `false`, call `init_repo_context` before touching any code.

**Example prompt:**
> "Start by calling `get_active_context` to see what branch we're on and read the last handoff."

---

### Phase 3 — During development

| Situation | Tool to call |
|---|---|
| About to propose an architecture approach | `search_vault` + `get_decisions` |
| About to modify a shared utility or module | `get_backlinks` — find what else depends on it |
| After completing a logical chunk of work | `update_branch_log` — log it now, not at session end |
| Found a TODO, FIXME, or unhandled edge case | `log_bug` |
| Added a new environment variable | `upsert_config_entry` |
| Starting or finishing a planned task | `update_plan` (action: `update_status`) |

**Key rule:** Never propose an approach that contradicts an entry in `DECISIONS.md` without flagging it first. `get_decisions` exists to prevent this.

---

### Phase 4 — End of session

Before closing:

1. If any work contradicts an architectural decision → `log_architectural_drift`
2. If bugs were fixed this session → `resolve_bug`
3. Always → `write_handoff`

**Example prompt:**
> "We're done for now. Write a handoff for the next agent. We finished the auth middleware but are blocked on the refresh token edge case."

`write_handoff` appends a timestamped session record to `HANDOFF.md`, updates the branch note's `## Blocked On` and `## Next Session` sections, and refreshes `ACTIVE_CONTEXT.md`.

---

### Phase 5 — Post-merge *(after merging a feature branch)*

When you merge into `main`, `master`, or `release`, the `post-merge` hook fires and prints a prompt to the terminal. Copy it and paste it into your agent. The agent will:

1. Run `git log` to identify what was merged
2. Call `mark_branch_merged` — sets `status: merged`, records `merged_at` and `merged_into`, writes `## Merge Summary`
3. Update `PLAN.md` via `update_plan` to mark completed tasks Done
4. Call `resolve_bug` for any bugs fixed in this merge
5. Call `log_architectural_drift` if the merged code violated any decision
6. Call `verify_source_links` to check that doc references didn't go stale from file renames
7. Update `Architecture/` or `Features/` docs if new modules or features were added
8. Call `write_handoff` to close the branch

The post-merge prompt is also available at `prompts/post-merge-sync.md`.

---

## MCP Tools Reference

### Planning

#### `write_sprint_plan`
Creates a sprint or feature plan atomically. Writes `Plans/{slug}.md` with goal, scope, technical breakdown, and task table, then adds one row per task to `PLAN.md` with `[[Plans/{slug}]]` links. Call this at the start of any new feature or sprint — before touching code.

**Input:** `repo`, `branch`, `plan_name`, `slug`, `goal`, `scope_in[]`, `technical_breakdown`, `tasks[]`
**Optional:** `scope_out[]`, `dependencies[]`, `open_questions[]`

**Example:** *"Use write_sprint_plan to plan the payment integration. Goal: add Razorpay checkout with webhook verification."*

---

### Context Management

#### `get_active_context`
Loads the active branch context, last handoff, blockers, and next actions. Call at the start of every session.

**Input:** `repo` *(optional — uses global ACTIVE_CONTEXT.md if omitted)*

**Example:** *"Call get_active_context to see what we're working on."*

---

#### `write_handoff`
Writes a session handoff note. Appends to `HANDOFF.md`, updates `## Blocked On` and `## Next Session` in the branch note, and refreshes `ACTIVE_CONTEXT.md`.

**Input:** `summary`, `files_changed[]`, `blocked_on`, `next_session_start`, `agent_name`
**Optional:** `doc_impact[]` *(logs which vault docs were affected)*, `overview` *(updates the branch Overview section)*

**Example:** *"Write a handoff: we built the payment webhook handler but are blocked on Razorpay signature verification."*

---

#### `init_repo_context`
First-use only. Writes the repo purpose to the branch note and seeds `DECISIONS.md` with initial architectural decisions.

**Input:** `repo`, `branch`, `purpose`, `decisions[]` *(3–5 items)*

**Example:** *"Initialize context for this repo. Purpose: a SaaS AI photo generation platform."*

---

#### `list_branch_notes`
Lists all branch notes for a repo with their status, last agent, and purpose.

**Input:** `repo` *(optional)*

**Example:** *"List branch notes so I can see all active feature branches."*

---

### Branch Tracking

#### `update_branch_log`
Appends a timestamped entry to the branch `## Changes Log`. Call frequently during development — not just at session end.

**Input:** `repo`, `branch`, `changes[]`
**Optional:** `doc_impact[]`, `overview`

**Example:** *"Update the branch log: refactored the S3 upload service to use streaming."*

---

#### `mark_branch_merged`
Marks a branch as merged. Sets `status: merged`, `merged_into`, `merged_at` in frontmatter and writes `## Merge Summary`.

**Input:** `repo`, `branch`, `merged_into`, `summary`

**Example:** *"Mark the feature/auth branch as merged into main. It added JWT refresh token support."*

---

### Knowledge Retrieval

#### `get_decisions`
Returns the most recent logged architectural decisions from `DECISIONS.md`. Always call this before proposing a technical approach.

**Input:** `repo`, `limit` *(default: 10)*

**Example:** *"Get the architectural decisions before we design the new caching layer."*

---

#### `search_vault`
Full-text BM25 search across the entire Obsidian vault. Use to find related notes, prior decisions, or feature docs when you don't know the filename.

**Input:** `query`, `tags[]` *(optional filter)*, `limit` *(default: 10)*

**Example:** *"Search the vault for 'authentication tokens'."*

---

#### `get_backlinks`
Finds all vault notes that contain a wikilink to the given note. Call before modifying shared utilities to understand what else in the vault depends on that file.

**Input:** `note_path`

**Example:** *"Get backlinks for the utility module note before we refactor it."*

---

#### `verify_source_links`
Extracts all backtick-wrapped file references from vault docs and verifies they still exist in the repository. Call after merges that rename or delete files.

**Input:** `repo`, `docs[]` *(optional — defaults to ARCHITECTURE.md, Features.md, PLAN.md)*

**Example:** *"Verify source links in our Architecture docs to make sure nothing went stale."*

---

### Documentation Writing

> To **read** an existing doc, use the Resources API instead of searching — see [Reading Documents](#reading-documents).

#### `write_architecture_doc`
Writes or updates an `Architecture/{filename}` document section by section. Preserves all other sections. Auto-appends a row to the `## Change History` table.

**Input:** `repo`, `filename` *(e.g. `System-Overview.md`)*, `sections` *(map of heading → markdown)*, `change_summary`, `branch`

**Example:** *"Update the Data Flow section of Architecture/Data-Flow.md using write_architecture_doc."*

---

#### `write_feature_doc`
Writes or updates a `Features/{filename}` document. `edge_cases` appends to the existing list rather than overwriting. Auto-appends to `## Change History`.

**Input:** `repo`, `filename`, `change_summary`, `branch`
**Optional:** `user_goal`, `flow_steps[]`, `edge_cases[]`

**Example:** *"Write a feature doc for User Profiles covering the user goal and edge cases."*

---

#### `write_custom_doc`
Writes any unstructured markdown file to the vault. Use for `Index.md`, `Plans/` detail files, or anything that doesn't fit a structured template.

**Input:** `repo`, `filename`, `content`

**Example:** *"Use write_custom_doc to create Index.md linking all our feature docs."*

---

### Tracking & Management

#### `log_bug`
Appends a new bug to the `## Active Known Issues` section of `Bug-tracking.md`.

**Input:** `repo`, `title`, `description`, `severity` *(`low`/`medium`/`high`/`critical`)*, `branch`
**Optional:** `file_refs[]`

**Example:** *"Log a high severity bug: the signup button crashes on mobile Safari."*

---

#### `resolve_bug`
Moves a bug from `## Active Known Issues` to `## Resolved Bugs` in `Bug-tracking.md`.

**Input:** `repo`, `bug_title` *(exact match)*, `resolution`, `files_changed[]`, `branch`

**Example:** *"Mark the signup button bug as resolved — fixed the flexbox overflow."*

---

#### `log_architectural_drift`
Logs a violation of an established architectural decision to the `## Architectural Drift` section of `Bug-tracking.md`.

**Input:** `repo`, `description`, `decision_ref` *(the DECISIONS.md entry it violates)*, `branch`

**Example:** *"Log architectural drift: this PR uses Redux but DECISIONS.md says we use React Context only."*

---

#### `update_plan`
Adds a new task row or updates an existing task's status in `PLAN.md`.

**Input:** `repo`, `action` *(`add`/`update_status`/`strike_through`)*, `task_name`, `branch`
**Optional:** `status` *(`Todo`/`In Progress`/`Done`/`Blocked`)*, `priority`, `sub_tasks`, `timeline`, `plan_link`

**Example:** *"Update the plan to mark 'Setup Database' as Done."*

---

#### `upsert_config_entry`
Adds or updates an environment variable row in `Configurations.md`. Updates the row if the variable already exists.

**Input:** `repo`, `variable_name`, `type`, `default_value`, `required`, `description`, `change_summary`, `branch`

**Example:** *"Add the new REDIS_URL environment variable to the Configurations doc."*

---

## Reading Documents

To read an existing vault document, use the **Resources API** — no tool call needed. Reference documents directly using these URIs:

| URI | What it reads |
|---|---|
| `devbrain://{repo}/docs/{path}` | Any file under `Projects/{repo}/` (e.g. `devbrain://myrepo/docs/Architecture/System-Overview.md`) |
| `devbrain://{repo}/branch/{branch}` | A branch note |
| `devbrain://active-context` | The active context as JSON |

Use `search_vault` only when you don't know the filename. When you do know it, use the resource URI directly — it's faster and uses less context.

---

## Vault Structure

```text
your-vault/
├── ACTIVE_CONTEXT.md                    # global pointer — updated on every branch switch
└── Projects/
    └── {repo-name}/
        ├── ACTIVE_CONTEXT.md            # per-repo pointer (fallback)
        ├── branch-main.md               # one note per branch
        ├── branch-feature-x.md
        ├── DECISIONS.md                 # append-only architectural decision log
        ├── HANDOFF.md                   # full session history across all agents
        ├── PLAN.md                      # task table managed by update_plan
        ├── Bug-tracking.md              # active issues / architectural drift / resolved
        ├── Configurations.md            # environment variable table
        ├── Index.md                     # map of content — links to everything
        ├── Architecture/                # system design docs (write_architecture_doc)
        │   ├── System-Overview.md
        │   ├── Core-Components.md
        │   ├── Data-Flow.md
        │   └── External-Integrations.md
        ├── Features/                    # one file per user-facing feature (write_feature_doc)
        │   ├── Authentication.md
        │   └── ...
        └── Plans/                       # detailed task plans (write_custom_doc)
            └── ...
```

---

## Branch Note Schema

Each branch note (`Projects/{repo}/branch-{name}.md`) follows this structure:

```markdown
---
repo: my-repo
branch: feature/auth
created: 2026-06-01T10:00:00Z
status: active
merged_into: ""
merged_at: ""
agent-sessions: 0
last-agent: ""
last-session: 2026-06-01T10:00:00Z
tags:
  - devbrain
  - project/my-repo
---

## Overview
<!-- set by init_repo_context or update_branch_log overview field -->

## Changes Log
<!-- appended by update_branch_log as you code — each entry timestamped -->

## Impact on Project Docs
<!-- logged when Architecture/Features/Bug-tracking/Configurations are updated -->

## Progress Log
<!-- auto-updated by the post-commit git hook -->

## Blocked On
<!-- written by write_handoff -->

## Next Session
<!-- written by write_handoff -->

## Merge Summary
<!-- written by mark_branch_merged -->
```

---

## ACTIVE_CONTEXT.md Format

```markdown
---
active_repo: my-repo
active_branch: feature/auth
switched_at: 2026-06-01T10:00:00Z
branch_note: "[[Projects/my-repo/branch-feature-auth]]"
---

> Auto-updated by devbrain on branch switch.

See [[Projects/my-repo/branch-feature-auth]] for full context.
```

Both a global `ACTIVE_CONTEXT.md` (vault root) and a per-repo one (`Projects/{repo}/ACTIVE_CONTEXT.md`) are maintained. `get_active_context` checks the repo-specific one first.

---

## Environment Variables

All three variables are written to `~/.devbrain.env` by `devbrain init` and sourced from your `.zshrc` / `.bashrc` automatically.

| Variable | Default | Description |
|---|---|---|
| `OBSIDIAN_API_KEY` | required | From `Obsidian → Settings → Local REST API` |
| `OBSIDIAN_PORT` | `27124` | Local REST API port |
| `DEVBRAIN_VAULT_PATH` | `~/vault` | Absolute path to your Obsidian vault |

---

## CLI Reference

| Command | Description |
|---|---|
| `devbrain init` | Interactive setup wizard: API key, vault detection, agent config injection |
| `devbrain setup-repo [path]` | Install git hooks, scaffold vault folder, print initialization prompt |
| `devbrain mcp` | Start the MCP server over stdio (called by agent configs — not run directly) |
| `devbrain hook <hook-name>` | Execute git hook logic (called internally by installed hooks — not run directly) |
| `devbrain build-schemas` | Generate static JSON tool schemas for Antigravity IDE |

---

## Supported Agents

| Agent | MCP Tools | Auto-configured by `devbrain init` |
|---|---|---|
| Claude Code | ✅ | ✅ `~/.claude/settings.json` |
| Antigravity IDE | ✅ (static schemas) | ✅ via `devbrain build-schemas` |

---

## What Makes This Different

| Project | Branch-aware | Git hooks | Multi-agent | Obsidian REST API |
|---|---|---|---|---|
| obsidian-second-brain | ❌ | ❌ | ✅ | ❌ |
| claude-obsidian | ❌ | ❌ | ❌ | ✅ |
| mcpvault | ❌ | ❌ | ✅ | ❌ |
| **DevBrain** | **✅** | **✅** | **✅** | **✅** |

The combination of git branch awareness and the Obsidian REST API (rather than raw file writes) is what none of the alternatives have. All vault writes go through the API so Obsidian's graph, backlinks, Dataview, and Omnisearch stay consistent.

---

## Security Notes

- Obsidian REST API runs on **localhost only** — no external exposure.
- Your API key is stored in `~/.devbrain.env`, never in any repository file.
- Add `~/.devbrain.env` to your global `~/.gitignore`.
- `.mcp.json` in the project root contains no secrets and is safe to commit.
- Git hooks fail silently — credentials are never exposed in terminal output, and git never blocks if Obsidian is closed.
- **If your vault contains personal notes alongside work docs**, create a dedicated work vault and point `DEVBRAIN_VAULT_PATH` at it. Agents can search the entire vault.

---

## Contributing

Contributions are welcome. Open an issue to discuss before submitting large changes.

**Repo layout:**
```
src/
  obsidian/       # Obsidian REST API client + vault operations
  mcp-server/     # MCP server entry point + all 17 tool handlers
  cli/            # CLI commands (init, setup-repo, hook, build-schemas)
agent-configs/    # Reference configs for each supported agent
vault-template/   # Blank vault structure for new installs
prompts/          # Initialization and post-merge prompts
```

Build:
```bash
npm install
npm run build   # esbuild → dist/
npm run typecheck
```

---

## License

MIT
