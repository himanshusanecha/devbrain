# vault-bridge

> One vault. Every agent. Every branch.

A git-aware context switching layer that gives every AI coding agent (Claude Code, Codex, Cursor, Gemini CLI) persistent, branch-scoped memory through an Obsidian vault via the Local REST API.

---

## The Problem

Every AI coding agent starts with zero memory. When you switch git branches, the agent has no idea what decisions were made on that branch, what's blocked, or what the previous session accomplished. You re-explain everything, every time.

**vault-bridge fixes this by:**
- Hooking into `git checkout` to detect branch switches
- Loading branch-scoped context from your Obsidian vault automatically
- Exposing that context to every agent through a single shared MCP server
- Writing structured handoff notes when sessions end

---

## Prerequisites

- **Obsidian** installed and running
- **Local REST API plugin** — `Obsidian → Settings → Community Plugins → Browse → "Local REST API" by Adam Coddington → Install → Enable`
- Copy the API key from `Settings → Local REST API`
- Node.js 18+
- Git

---

## Quick Install

```bash
git clone https://github.com/yourname/vault-bridge
cd vault-bridge
./install.sh
```

`install.sh` will:
1. Run `npm install && npm run build`
2. Prompt for your Obsidian API key and vault path
3. Write `~/.vault-bridge.env` and source it from `.zshrc` / `.bashrc`
4. Scaffold vault folder structure
5. Verify the Obsidian REST API connection (`✅` or `❌` with fix instructions)

Then link it to any repo:

```bash
vault-bridge setup-repo /path/to/your/repo
```

---

## How It Works

```
git checkout feature/my-feature
        │
        ▼
post-checkout hook fires
        │
        ▼
curl → Obsidian Local REST API (localhost:27124)
        │
        ├── GET  /vault/Projects/{repo}/branch-{name}.md   (exists?)
        ├── PUT  /vault/Projects/{repo}/branch-{name}.md   (create if not)
        ├── PUT  /vault/ACTIVE_CONTEXT.md                  (update pointer)
        └── PUT  /active/                                  (open note in Obsidian)
        │
        ▼
Agent session starts
        │
        ▼
MCP tool: get_active_context
        │
        ▼
Agent knows: branch, repo, last session, blockers, next actions
```

If Obsidian is not running — hooks skip silently, never block git.

---

## Project Structure

```
vault-bridge/
├── README.md
├── package.json
├── tsconfig.json
├── install.sh                        # one-command installer
├── src/
│   ├── obsidian/
│   │   ├── client.ts                 # typed Obsidian REST API client
│   │   ├── vault-ops.ts              # higher-level vault operations
│   │   └── health.ts                 # reachability check + polling
│   ├── mcp-server/
│   │   ├── index.ts                  # MCP server entry point
│   │   └── tools/
│   │       ├── get-active-context.ts
│   │       ├── write-handoff.ts
│   │       ├── list-branch-notes.ts
│   │       ├── get-decisions.ts
│   │       ├── create-branch-note.ts
│   │       ├── search-vault.ts
│   │       └── get-backlinks.ts
│   └── git-hooks/
│       ├── post-checkout.sh
│       ├── post-commit.sh
│       └── hook-utils.sh
├── agent-configs/
│   ├── claude/
│   │   ├── CLAUDE.md
│   │   └── settings.json
│   ├── cursor/
│   │   └── mcp.json
│   ├── codex/
│   │   └── hooks.json
│   └── gemini/
│       └── settings.json
├── vault-template/
│   ├── ACTIVE_CONTEXT.md
│   ├── Projects/
│   │   └── example-project/
│   │       ├── branch-main.md
│   │       ├── DECISIONS.md
│   │       └── HANDOFF.md
│   └── .vault-bridge.json
└── scripts/
    ├── setup-repo.sh
    └── create-vault.sh
```

---

## Architecture

### Layer 1 — Obsidian REST API Client (`src/obsidian/client.ts`)

All vault I/O goes through the Obsidian Local REST API. Never use `fs.readFile` on vault files directly — that bypasses the graph, backlinks, Dataview, and Omnisearch.

**Base URL:** `http://localhost:27124`  
**Auth:** `Authorization: Bearer {OBSIDIAN_API_KEY}`

```typescript
export interface ObsidianConfig {
  host: string;       // default: localhost
  port: number;       // default: 27124
  apiKey: string;     // from OBSIDIAN_API_KEY env var
  ssl: boolean;       // default: false
}

export interface NoteContent {
  content: string;
  frontmatter: Record<string, unknown>;
  path: string;
  stat: { ctime: number; mtime: number; size: number };
  tags: string[];
}

export interface SearchResult {
  filename: string;
  score: number;
  matches: Array<{
    context: string;
    match: { start: number; end: number };
  }>;
}

export class ObsidianClient {
  async getNote(path: string): Promise<NoteContent>
  async putNote(path: string, content: string): Promise<void>
  async appendNote(path: string, content: string): Promise<void>
  async deleteNote(path: string): Promise<void>
  async listFolder(path: string): Promise<string[]>
  async searchSimple(query: string, contextLength?: number): Promise<SearchResult[]>
  async searchJsonLogic(logic: object): Promise<SearchResult[]>
  async executeCommand(commandId: string): Promise<void>
  async getActiveNote(): Promise<NoteContent | null>
  async openNote(path: string): Promise<void>
  async isReachable(): Promise<boolean>
}
```

**Error types:**
- `ObsidianConnectionError` — Obsidian not running or wrong port
- `ObsidianNotFoundError` — 404, note does not exist
- `ObsidianAuthError` — wrong API key

#### REST Endpoints Used

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/vault/{path}` | Read note content + metadata |
| PUT | `/vault/{path}` | Create or overwrite note |
| PATCH | `/vault/{path}` | Append content to note |
| DELETE | `/vault/{path}` | Delete note |
| GET | `/vault/{folder}/` | List folder contents |
| POST | `/search/simple/` | Full-text BM25 search |
| POST | `/search/` | JsonLogic search (tags, properties) |
| GET | `/active/` | Currently open note in Obsidian |
| PUT | `/active/` | Open a note in Obsidian |
| GET | `/commands/` | List available commands |
| POST | `/commands/{id}/` | Execute an Obsidian command |

---

### Layer 2 — Vault Operations (`src/obsidian/vault-ops.ts`)

Higher-level functions built on `ObsidianClient`:

```typescript
// Branch notes
createBranchNote(repo: string, branch: string, description?: string): Promise<void>
getBranchNote(repo: string, branch: string): Promise<NoteContent | null>
listBranchNotes(repo: string): Promise<BranchNoteSummary[]>
appendToProgressLog(repo: string, branch: string, entry: string): Promise<void>

// Active context
updateActiveContext(repo: string, branch: string): Promise<void>
getActiveContext(): Promise<ActiveContext | null>

// Handoff
writeHandoff(params: HandoffParams): Promise<void>
getLastHandoff(repo: string): Promise<HandoffRecord | null>

// Decisions
getDecisions(repo: string, limit?: number): Promise<Decision[]>
appendDecision(repo: string, decision: string): Promise<void>

// Search (Obsidian-powered)
searchVault(query: string, tags?: string[]): Promise<SearchResult[]>
getBacklinks(notePath: string): Promise<string[]>
```

---

### Layer 3 — MCP Server (`src/mcp-server/`)

Built with `@modelcontextprotocol/sdk`. Starts in under 500ms. Reads `OBSIDIAN_API_KEY` and `VAULT_BRIDGE_VAULT_PATH` from environment.

If Obsidian is unreachable at startup: logs a warning, starts anyway, tools return structured `obsidian_unavailable` errors instead of crashing.

#### MCP Tools

---

##### `get_active_context`

**Input:** none  
**What it does:**
1. `GET /vault/ACTIVE_CONTEXT.md` — reads active branch pointer
2. `GET /vault/Projects/{repo}/branch-{branch}.md` — reads full branch context
3. `GET /vault/Projects/{repo}/HANDOFF.md` — reads last session handoff
4. `POST /search/simple/` with `"branch:{branch} status:active"` — finds related notes

**Returns:**
```json
{
  "repo": "naukri-classification",
  "branch": "feature/deberta-v2",
  "switched_at": "2026-05-19T10:00:00Z",
  "last_session": {
    "agent": "claude-code",
    "summary": "Fixed dual-head loss weighting",
    "files_changed": ["src/model/dual_head.py"],
    "ended_at": "2026-05-18T18:32:00Z"
  },
  "blocked_on": "Role head class imbalance for rare designations",
  "next_session_start": "Run eval on deberta checkpoint from epoch 8",
  "related_notes": ["Projects/naukri/DECISIONS.md", "Projects/naukri/arch-notes.md"]
}
```

---

##### `write_handoff`

**Input:**
```typescript
{
  summary: string;
  files_changed: string[];
  blocked_on: string;
  next_session_start: string;
  agent_name: string;
}
```

**What it does:**
1. PATCH appends a timestamped session record to `Projects/{repo}/HANDOFF.md`
2. PATCH appends to the `## Progress Log` section of the active branch note
3. PUT overwrites `ACTIVE_CONTEXT.md` with updated `last_session` block
4. All writes go through Obsidian API so edits appear in Obsidian history

Handoff entry format appended to `HANDOFF.md`:

```markdown
## Session — 2026-05-19T14:32:00Z (claude-code)

**Summary:** Fixed dual-head loss weighting (category: 0.3, role: 0.7)

**Files changed:**
- src/model/dual_head.py (lines 142–180)

**Blocked on:** Role head class imbalance for rare designations

**Next session start:** Run eval on deberta checkpoint from epoch 8

---
```

---

##### `search_vault`

**Input:**
```typescript
{
  query: string;
  tags?: string[];
  limit?: number;   // default: 10
}
```

**What it does:**
1. `POST /search/simple/` with the query string
2. If `tags` provided, chains with `POST /search/` JsonLogic to filter
3. Returns ranked results with context snippets

This is the tool that makes Obsidian worth using over raw files — agents get BM25-ranked search across the full knowledge graph, not just the current branch note.

---

##### `get_backlinks`

**Input:**
```typescript
{ note_path: string }
```

**What it does:**
- Uses JsonLogic search to find all notes that contain a wikilink to `note_path`
- Returns list of note paths that reference this note
- Use case: before modifying a shared utility, agent finds every note (and therefore every project/decision) that references it

---

##### `list_branch_notes`

**Input:**
```typescript
{ repo?: string }
```

**What it does:**
1. `GET /vault/Projects/{repo}/` — lists folder
2. Filters for `branch-*.md` pattern
3. Reads frontmatter from each via REST API
4. Returns structured list

**Returns:**
```json
[
  {
    "branch": "feature/deberta-v2",
    "status": "active",
    "last_modified": "2026-05-19T10:00:00Z",
    "agent_sessions": 4,
    "last_agent": "claude-code",
    "purpose": "Dual-head DeBERTa with hierarchical validity mask"
  }
]
```

---

##### `get_decisions`

**Input:**
```typescript
{ repo: string; limit?: number }
```

**What it does:**
- `GET /vault/Projects/{repo}/DECISIONS.md` via REST API
- Parses `##` sections as individual decisions
- Returns last N in reverse chronological order

---

##### `create_branch_note`

**Input:**
```typescript
{ repo: string; branch: string; description?: string }
```

**What it does:**
1. Check if note exists: `GET /vault/Projects/{repo}/branch-{branch}.md`
2. If 404, create with `PUT` using the branch note template
3. `PUT /active/` with the new note path — Obsidian opens it immediately

---

### Layer 4 — Git Hooks (`src/git-hooks/`)

Pure bash. No Node required. Uses `curl` directly against the REST API. Never block git — all failures are soft.

#### `post-checkout.sh`

Fires on `git checkout <branch>` and `git switch <branch>`. Does NOT fire on `git checkout <file>` (checked via `$3 == 1`).

```bash
#!/bin/bash
CHECKOUT_TYPE=$3
[ "$CHECKOUT_TYPE" != "1" ] && exit 0

REPO_NAME=$(basename $(git rev-parse --show-toplevel))
BRANCH_NAME=$(git branch --show-current)
PORT="${OBSIDIAN_PORT:-27124}"
BASE_URL="http://localhost:$PORT"

# Non-blocking health check
OBSIDIAN_UP=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
  "$BASE_URL/vault/" 2>/dev/null)

if [ "$OBSIDIAN_UP" != "200" ]; then
  echo "⚠️  vault-bridge: Obsidian not running, skipping context load"
  exit 0
fi

BRANCH_NOTE="Projects/$REPO_NAME/branch-$BRANCH_NAME.md"

# Create branch note if it doesn't exist
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
  "$BASE_URL/vault/$BRANCH_NOTE")

if [ "$STATUS" = "404" ]; then
  # PUT branch note from template
  # (template defined in hook-utils.sh)
  create_branch_note "$REPO_NAME" "$BRANCH_NAME"
  echo "📝 vault-bridge: created branch note for $BRANCH_NAME"
fi

# Update ACTIVE_CONTEXT.md
update_active_context "$REPO_NAME" "$BRANCH_NAME"

# Open branch note in Obsidian
curl -s -X PUT \
  -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"path\": \"$BRANCH_NOTE\"}" \
  "$BASE_URL/active/" > /dev/null

echo "🧠 vault-bridge: loaded context → $REPO_NAME/$BRANCH_NAME"
```

#### `post-commit.sh`

```bash
#!/bin/bash
REPO_NAME=$(basename $(git rev-parse --show-toplevel))
BRANCH_NAME=$(git branch --show-current)
COMMIT_MSG=$(git log -1 --pretty=%B | head -1)
COMMIT_HASH=$(git log -1 --pretty=%h)
CHANGED=$(git diff-tree --no-commit-id -r --name-only HEAD | tr '\n' ', ')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

PORT="${OBSIDIAN_PORT:-27124}"

# Append to Progress Log via PATCH (append endpoint)
curl -s -X PATCH \
  -H "Authorization: Bearer $OBSIDIAN_API_KEY" \
  -H "Content-Type: text/markdown" \
  --data-binary "
- \`$COMMIT_HASH\` $TIMESTAMP — $COMMIT_MSG (files: $CHANGED)" \
  "http://localhost:$PORT/vault/Projects/$REPO_NAME/branch-$BRANCH_NAME.md" \
  > /dev/null
```

---

## Vault Structure

```
your-vault/
├── ACTIVE_CONTEXT.md              # auto-updated on every branch switch
├── .vault-bridge.json             # vault config
└── Projects/
    └── {repo-name}/
        ├── branch-main.md
        ├── branch-feature-x.md
        ├── DECISIONS.md           # append-only decision log
        └── HANDOFF.md             # agent session history
```

---

## Branch Note Schema

```markdown
---
repo: naukri-classification
branch: feature/deberta-v2
created: 2026-05-19T10:00:00Z
status: active
related-branches:
  - "[[Projects/naukri-classification/branch-main]]"
agent-sessions: 4
last-agent: claude-code
last-session: 2026-05-18T18:32:00Z
tags:
  - vault-bridge
  - project/naukri-classification
---

## Purpose
Dual-head DeBERTa-v3 model with hierarchical validity mask for role classification.

## Key Decisions
<!-- newest first -->
- 2026-05-18: loss weighting set to category:0.3, role:0.7 after eval on epoch 6–8

## Progress Log
<!-- auto-updated by post-commit hook -->
- `a3f1b2c` 2026-05-18T18:30:00Z — fix dual-head loss weighting

## Blocked On
Role head class imbalance for rare designations (<10 samples in training set).

## Next Session
Run eval on deberta checkpoint from epoch 8. Compare with DistilBERT baseline.
```

**Why wikilinks in `related-branches`?** Obsidian's graph view automatically shows branch relationships. No extra config needed.

---

## ACTIVE_CONTEXT.md Format

```markdown
---
active_repo: naukri-classification
active_branch: feature/deberta-v2
switched_at: 2026-05-19T10:00:00Z
branch_note: "[[Projects/naukri-classification/branch-feature-deberta-v2]]"
---

> Auto-updated by vault-bridge on branch switch.

See [[Projects/naukri-classification/branch-feature-deberta-v2]] for full context.
```

---

## Agent Configuration

### Claude Code — `agent-configs/claude/CLAUDE.md`

Drop this into your workspace `.claude/` folder or the vault root:

```markdown
## vault-bridge Instructions

At the start of every session:
1. Call `get_active_context` — read the active branch context before touching code
2. If the context shows a HANDOFF note, read it fully before making any changes

Before answering architecture questions:
3. Call `search_vault` with the relevant topic
4. Call `get_decisions` to check prior decisions on this repo
   — never propose an approach that conflicts with a logged decision without flagging it

Before modifying shared utilities:
5. Call `get_backlinks` on the file you're about to change
   — understand what else in the vault depends on it

At the end of any session where files were modified:
6. Call `write_handoff` with summary, files_changed, blocked_on, next_session_start

When writing to branch notes:
- Always use wikilinks [[note-name]] not plain paths — the graph depends on this
- Append to sections, never overwrite existing content
- Use ISO 8601 timestamps
```

### Cursor — `agent-configs/cursor/mcp.json`

```json
{
  "mcpServers": {
    "vault-bridge": {
      "command": "node",
      "args": ["${VAULT_BRIDGE_PATH}/dist/mcp-server/index.js"],
      "env": {
        "OBSIDIAN_API_KEY": "${OBSIDIAN_API_KEY}",
        "OBSIDIAN_PORT": "27124",
        "VAULT_BRIDGE_VAULT_PATH": "${VAULT_BRIDGE_VAULT_PATH}"
      }
    }
  }
}
```

### Codex — `agent-configs/codex/hooks.json`

```json
{
  "sessionStart": {
    "command": "node",
    "args": ["${VAULT_BRIDGE_PATH}/dist/hooks/session-start.js"]
  },
  "sessionEnd": {
    "command": "node",
    "args": ["${VAULT_BRIDGE_PATH}/dist/hooks/session-end.js"]
  },
  "mcp": {
    "servers": {
      "vault-bridge": {
        "command": "node",
        "args": ["${VAULT_BRIDGE_PATH}/dist/mcp-server/index.js"]
      }
    }
  }
}
```

### Gemini CLI — `agent-configs/gemini/settings.json`

```json
{
  "mcpServers": {
    "vault-bridge": {
      "command": "node",
      "args": ["${VAULT_BRIDGE_PATH}/dist/mcp-server/index.js"],
      "env": {
        "OBSIDIAN_API_KEY": "${OBSIDIAN_API_KEY}",
        "VAULT_BRIDGE_VAULT_PATH": "${VAULT_BRIDGE_VAULT_PATH}"
      }
    }
  }
}
```

### `.mcp.json` (repo root — works for all agents)

```json
{
  "mcpServers": {
    "vault-bridge": {
      "command": "node",
      "args": ["${VAULT_BRIDGE_PATH}/dist/mcp-server/index.js"],
      "env": {
        "OBSIDIAN_API_KEY": "${OBSIDIAN_API_KEY}",
        "OBSIDIAN_PORT": "27124",
        "VAULT_BRIDGE_VAULT_PATH": "${VAULT_BRIDGE_VAULT_PATH}"
      }
    }
  }
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OBSIDIAN_API_KEY` | required | From Obsidian → Local REST API plugin |
| `OBSIDIAN_PORT` | `27124` | Local REST API port |
| `VAULT_BRIDGE_VAULT_PATH` | `~/vault` | Path to your Obsidian vault |
| `VAULT_BRIDGE_PATH` | auto | Path to this repo (set by install.sh) |

All written to `~/.vault-bridge.env` by `install.sh` and sourced from shell rc.

---

## Supported Agents

| Agent | Context Load | Handoff Write | Search | Backlinks |
|-------|-------------|---------------|--------|-----------|
| Claude Code | ✅ | ✅ | ✅ | ✅ |
| Cursor | ✅ | ✅ | ✅ | ✅ |
| Codex CLI | ✅ | ✅ | ✅ | ✅ |
| Gemini CLI | ✅ | ✅ | ✅ | ✅ |
| Windsurf | 🔜 | 🔜 | 🔜 | 🔜 |
| Kiro | 🔜 | 🔜 | 🔜 | 🔜 |

---

## Build Order for Claude Code Prompt

Tell Claude Code to build in this exact order:

```
1. src/obsidian/client.ts          — typed REST client
2. src/obsidian/health.ts          — reachability polling
3. src/obsidian/vault-ops.ts       — higher-level ops
4. src/mcp-server/tools/           — one tool at a time, test each
5. src/mcp-server/index.ts         — wire tools into MCP server
6. src/git-hooks/hook-utils.sh     — shared bash helpers
7. src/git-hooks/post-checkout.sh  — branch switch hook
8. src/git-hooks/post-commit.sh    — commit hook
9. agent-configs/                  — all four agent configs
10. scripts/setup-repo.sh          — repo linker
11. install.sh                     — full installer
12. README.md                      — with ASCII diagram + agent table
```

---

## Security Notes

- Obsidian REST API runs on localhost only — no external exposure
- API key is stored in `~/.vault-bridge.env`, not in any repo file
- Add `~/.vault-bridge.env` to your global `.gitignore`
- If your vault has personal notes alongside technical docs, create a separate work vault and point `VAULT_BRIDGE_VAULT_PATH` at that
- Git hooks fail silently — they never expose credentials in terminal output on failure

---

## What Makes This Different from Existing Projects

| Project | Branch-aware | Git hooks | Multi-agent | Obsidian API (not raw files) |
|---------|-------------|-----------|-------------|------------------------------|
| obsidian-second-brain | ❌ | ❌ | ✅ | ❌ |
| obsidian-mind | ❌ | partial | ✅ | ❌ |
| claude-obsidian | ❌ | ❌ | ❌ | ✅ |
| mcpvault | ❌ | ❌ | ✅ | ❌ |
| **vault-bridge** | **✅** | **✅** | **✅** | **✅** |

The git branch awareness + Obsidian REST API combination is the gap none of them fill.