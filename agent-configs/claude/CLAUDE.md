## DevBrain Instructions

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

When the user says "build me X", "plan this sprint", or "plan this feature":
- Follow `prompts/plan-feature.md` — interview the user, then call `write_sprint_plan`
- Write the plan to the vault BEFORE touching any code

## Which Tool to Use for Which Document

| Task | Use Tool |
|---|---|
| Plan a new feature or sprint before coding | `write_sprint_plan` |
| Document a module, service, or system design | `write_architecture_doc` |
| Document a user-facing feature or flow | `write_feature_doc` |
| Log a new bug or TODO found in code | `log_bug` |
| Mark a bug as fixed after a merge | `resolve_bug` |
| Note that merged code violates an architecture decision | `log_architectural_drift` |
| Update a planned task's status | `update_plan` |
| Document a new env variable or config | `upsert_config_entry` |
| Read an existing project doc | Use Resource URI: devbrain://{repo}/docs/{filename} |
| Custom/unstructured docs | `write_custom_doc` |
