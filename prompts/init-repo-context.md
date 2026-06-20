You are initializing DevBrain context for this repo for the first time. Do the following in order:

> **CRITICAL OBSIDIAN RULE:** Whenever you reference a project document, branch, or feature, you MUST wrap it in Obsidian wikilinks (e.g., `[[ARCHITECTURE.md]]`, `[[branch-feature-login]]`). For Change History tables, the Branch column MUST use `[[branch-name]]` syntax.
> **SOURCE CODE RULE:** Whenever you reference a source code file (e.g., `src/auth/login.ts`), strictly use inline code backticks. Do NOT use markdown links or wikilinks for source code.

1. Read the codebase exhaustively to understand this project:
   - README.md (if it exists)
   - package.json, pyproject.toml, go.mod, or equivalent manifest
   - Top-level directory structure
   - Config files that reveal the stack (tsconfig.json, .env.example, docker-compose.yml, etc.)
   - Do not stop reading after 2 files. You must trace the execution path of the primary application flow.
   - Read all major configuration files, routing definitions, database schemas, and core utilities.
   - Be completely exhaustive. Do not limit the length of your analysis. Include every relevant detail you discover.

2. Identify the default branch by running:
   git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'
   If that returns nothing, check which of these exists: main, master, release.
   Use whichever you find as the target branch.

3. Get the repo name:
   basename "$(git rev-parse --show-toplevel)"

4. Before writing any files, verify the structured documentation tools (`write_architecture_doc`, `write_feature_doc`, `log_bug`, `upsert_config_entry`, `update_plan`) are available in your
   session. If they are not available, stop immediately and tell the user:
   "DevBrain MCP server is not connected. Please configure it and restart the session."
   Do not proceed and do not write any files to the repo filesystem.

   If they are available, call them to create the following structure:

   Architecture Documents
   Use `write_architecture_doc` to create multiple files for system design granularly.
   - `System-Overview.md`: Exhaustive description of the system design, core purpose.
   - `Core-Components.md`: Deep dive into critical classes, modules, and services.
   - `Data-Flow.md`: Comprehensive ASCII diagrams showing data movement.
   - `External-Integrations.md`: List of all APIs, databases, or services.
   (Pass the content for each file as a map of heading titles to markdown content via the `sections` argument).

   Feature Documents
   Use `write_feature_doc` to create multiple feature files, one for each major feature.
   For each feature (e.g., `Authentication.md`), provide `user_goal`, `flow_steps`, and `edge_cases`.

   Bug Tracking
   Use `log_bug` for any TODOs, FIXMEs, architectural debt, or obvious unhandled errors you discovered in your exhaustive reading. Provide full detail. (If none, no action needed).

   Configurations
   Use `upsert_config_entry` to log every single environment variable found. For static configs, you can use `write_custom_doc` to write a custom section if needed.

   Project Plan & Roadmap
   Use `update_plan` (action: "add") to log the upcoming tasks based on the codebase's state. If a task is complex, you can write a detailed plan file to `Plans/` using `write_custom_doc` and link to it.

   Project Hub (Index.md)
   Use `write_custom_doc` to create `Index.md`.
   Content:
   # Project Hub
   Welcome to the central Map of Content (MOC) for this project.
   
   ## Core Documentation
   - [[Architecture/System-Overview.md]] (and other architecture files)
   - [[Features/Core-Workflows.md]] (and other feature files)
   - [[Configurations.md]]
   
   ## Project Management
   - [[PLAN.md]]
   - [[Bug-tracking.md]]
   - [[DECISIONS.md]]

Do not ask for confirmation. Just read, generate, and write all files.
