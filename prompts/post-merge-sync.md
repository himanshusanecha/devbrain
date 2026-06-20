A branch was just merged into the release/master branch. Do the following in order:

> **CRITICAL OBSIDIAN RULE:** Whenever you reference a project document, branch, or feature, you MUST wrap it in Obsidian wikilinks (e.g., `[[ARCHITECTURE.md]]`, `[[branch-feature-login]]`). For Change History tables, the Branch column MUST use `[[branch-name]]` syntax.
> **SOURCE CODE RULE:** Whenever you reference a source code file (e.g., `src/auth/login.ts`), strictly use inline code backticks. Do NOT use markdown links or wikilinks for source code.

1. Identify what was merged and changed:
   git log --merges -1 --pretty=format:"%s"
   git diff HEAD~1 HEAD --name-only

2. Get the merged branch name and repo name:
   git log --merges -1 --pretty=format:"%b"
   basename "$(git rev-parse --show-toplevel)"
   If the merge commit message does not contain the branch name, use:
   git log --merges -1 --pretty=format:"%P" | awk '{print $2}' | xargs git name-rev --name-only

3. Read the branch note for the merged branch from the vault using search_vault
   to understand what the branch accomplished and what changed.

4. Check for Architectural Drift:
   - Compare the newly merged code against [[DECISIONS.md]] and the core architecture docs in the `Architecture/` folder.
   - If the new code introduces a pattern, dependency, or structural change that contradicts established decisions, you MUST log this deviation.
   - Update [[Bug-tracking.md]] by adding an entry under `## Architectural Drift` explaining the contradiction and linking to the specific `[[branch-name]]` that caused it.

5. Before writing anything, verify the structured documentation tools (`write_architecture_doc`, `update_plan`, etc.) are available in your
   session. If they are not available, stop immediately and tell the user:
   "DevBrain MCP server is not connected. Please configure it and restart the session."
   Do not proceed and do not write any files to the repo filesystem.

   If they are available, update only the docs affected by this merge using the appropriate tool:
   - Architecture/* files — if new modules, services, or structural changes were introduced, use `write_architecture_doc`.
   - Features/* files — if new user-facing features were added or existing ones modified, use `write_feature_doc`.
   - PLAN.md — if a planned feature was merged, use `update_plan` (action: `strike_through` or `update_status`) to mark it as Done.
   - Bug-tracking.md — if bugs were fixed: use `resolve_bug` to move them to Resolved.
   - Configurations.md — if new environment variables or config files were added, use `upsert_config_entry`.

6. Verify Source Code References:
   - Call the `verify_source_links` MCP tool to check if any file renames or deletions in this merge broke the documentation references.
   - If broken references are found, use your repository search tools to find the new file locations and update the affected project docs.

7. Call mark_branch_merged with:
   - repo: repo name from step 2
   - branch: merged branch name from step 2
   - merged_into: the release branch (main / master / release)
   - summary: 2-3 sentences describing what this branch accomplished

Do not ask for confirmation. Just read, detect changes, and write.
