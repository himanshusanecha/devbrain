import fs from 'fs';
import path from 'path';
import os from 'os';

export function buildSchemasCommand() {
  const mcpDir = path.join(os.homedir(), '.gemini', 'antigravity-ide', 'mcp', 'devbrain');
  
  if (!fs.existsSync(mcpDir)) {
    fs.mkdirSync(mcpDir, { recursive: true });
  }

  const tools = [
    {
      name: "get_active_context",
      description: "Load the active branch context from the Obsidian vault. Call this at the start of every session.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {},
        required: []
      }
    },
    {
      name: "write_handoff",
      description: "Write a session handoff note to the vault. Call this at the end of any session where files were modified.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          summary: { type: "string", description: "What was accomplished this session" },
          files_changed: { type: "array", items: { type: "string" }, description: "List of files modified" },
          blocked_on: { type: "string", description: "Current blockers or empty string" },
          next_session_start: { type: "string", description: "What the next agent should do first" },
          agent_name: { type: "string", description: "Name of the agent writing the handoff" },
          repo: { type: "string", description: "Optional repo name. Uses active repo if omitted." },
          doc_impact: { type: "array", items: { type: "object", properties: { docName: { type: "string" }, description: { type: "string" } } }, description: "List of project documents impacted by these changes" },
          overview: { type: "string", description: "Short description of the branch purpose. Updates the Overview section." }
        },
        required: ["summary", "files_changed", "blocked_on", "next_session_start", "agent_name"]
      }
    },
    {
      name: "list_branch_notes",
      description: "List all branch notes for a repo. Shows status, last agent, and purpose of each branch.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name. Uses active repo if omitted." }
        },
        required: []
      }
    },
    {
      name: "get_decisions",
      description: "Get logged architectural decisions for a repo. Check this before proposing approaches.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          limit: { type: "number", description: "Max decisions to return (default: 10)" }
        },
        required: ["repo"]
      }
    },
    {
      name: "init_repo_context",
      description: "Initialize vault context for a repo on first use. Writes a purpose description to the branch note and seeds DECISIONS.md with initial architectural decisions. Call this once when starting work on a new repo.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          branch: { type: "string", description: "Current branch name" },
          purpose: { type: "string", description: "2-3 sentence description of what this repo does and its primary goal" },
          decisions: { type: "array", items: { type: "string" }, description: "3-5 key architectural decisions or conventions observed in the codebase" }
        },
        required: ["repo", "branch", "purpose", "decisions"]
      }
    },
    {
      name: "update_branch_log",
      description: "Append a timestamped entry to the branch change log. Call this as you make code changes during a session — not just at session end.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          branch: { type: "string", description: "Branch name" },
          changes: { type: "array", items: { type: "string" }, description: "List of changes made — one bullet per file or logical change" },
          doc_impact: { type: "array", items: { type: "object", properties: { docName: { type: "string" }, description: { type: "string" } } }, description: "List of project documents impacted by these changes" },
          overview: { type: "string", description: "Short description of the branch purpose. Updates the Overview section." }
        },
        required: ["repo", "branch", "changes"]
      }
    },
    {
      name: "mark_branch_merged",
      description: "Mark a branch as merged into release/master. Sets status, merged_into, merged_at, and writes the merge summary. Call this after a merge event.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          branch: { type: "string", description: "The branch that was merged" },
          merged_into: { type: "string", description: "The target branch (main, master, release)" },
          summary: { type: "string", description: "2-3 sentences describing what this branch accomplished" }
        },
        required: ["repo", "branch", "merged_into", "summary"]
      }
    },
    {
      name: "write_custom_doc",
      description: "Write a completely custom unstructured documentation file to the vault (e.g. Index.md). Use specific structured doc tools for standard docs.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          filename: { type: "string", description: "Filename, e.g. Index.md" },
          content: { type: "string", description: "Full markdown content of the file" }
        },
        required: ["repo", "filename", "content"]
      }
    },
    {
      name: "search_vault",
      description: "Full-text BM25 search across the Obsidian vault. Note: to simply read a document, use the Resources API instead of searching.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string", description: "Search query" },
          tags: { type: "array", items: { type: "string" }, description: "Filter by tags" },
          limit: { type: "number", description: "Max results (default: 10)" }
        },
        required: ["query"]
      }
    },
    {
      name: "get_backlinks",
      description: "Find all vault notes that link to a given note. Call before modifying shared utilities.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          note_path: { type: "string", description: "Path to the note to find backlinks for" }
        },
        required: ["note_path"]
      }
    },
    {
      name: "verify_source_links",
      description: "Extract backticked source code references from the project docs and verify they exist in the repository.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          docs: { type: "array", items: { type: "string" }, description: "List of files to check (e.g., ARCHITECTURE.md, Features.md). Defaults to all core docs." }
        },
        required: ["repo"]
      }
    },
    {
      name: "write_architecture_doc",
      description: "Write or update an Architecture document section by section. Preserves other sections.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          filename: { type: "string", description: "e.g. 'System-Overview.md', 'Data-Flow.md'" },
          sections: { type: "object", additionalProperties: { type: "string" }, description: "Map of heading titles (without ##) to markdown content" },
          change_summary: { type: "string", description: "One-line entry for the Change History table" },
          branch: { type: "string", description: "Branch name for Change History table row" }
        },
        required: ["repo", "filename", "sections", "change_summary", "branch"]
      }
    },
    {
      name: "write_feature_doc",
      description: "Write or update a Feature document. Appends edge cases without overwriting existing ones.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          filename: { type: "string", description: "e.g. 'Authentication.md'" },
          user_goal: { type: "string", description: "Markdown content for ## User Goal" },
          flow_steps: { type: "array", items: { type: "string" }, description: "Numbered list of steps for ## Flow" },
          edge_cases: { type: "array", items: { type: "string" }, description: "Bulleted items to append (not overwrite) to ## Edge Cases" },
          change_summary: { type: "string", description: "One-line entry for the Change History table" },
          branch: { type: "string", description: "Branch name for Change History table row" }
        },
        required: ["repo", "filename", "change_summary", "branch"]
      }
    },
    {
      name: "log_bug",
      description: "Append a new active bug to the Bug-tracking.md document.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          title: { type: "string", description: "Short descriptive title for the bug" },
          description: { type: "string", description: "Detailed description of the bug and how to reproduce" },
          file_refs: { type: "array", items: { type: "string" }, description: "Source files involved" },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Severity of the bug" },
          branch: { type: "string", description: "Branch name where the bug was found or being worked on" }
        },
        required: ["repo", "title", "description", "severity", "branch"]
      }
    },
    {
      name: "resolve_bug",
      description: "Mark a bug as resolved in Bug-tracking.md. Moves it from Active to Resolved section.",
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          bug_title: { type: "string", description: "Exact title of the bug to resolve (matches log_bug title)" },
          resolution: { type: "string", description: "Detailed explanation of how the bug was fixed" },
          files_changed: { type: "array", items: { type: "string" }, description: "Source files modified to fix the bug" },
          branch: { type: "string", description: "Branch name where the bug was resolved" }
        },
        required: ["repo", "bug_title", "resolution", "files_changed", "branch"]
      }
    },
    {
      name: "log_architectural_drift",
      description: "Log when merged code violates an established architectural decision in DECISIONS.md.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          description: { type: "string", description: "Explanation of what contradicts established decisions" },
          decision_ref: { type: "string", description: "Reference to the DECISIONS.md entry it violates" },
          branch: { type: "string", description: "Branch name where the drift occurred" }
        },
        required: ["repo", "description", "decision_ref", "branch"]
      }
    },
    {
      name: "update_plan",
      description: "Update task status or add new rows to PLAN.md.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          action: { type: "string", enum: ["add", "update_status", "strike_through"], description: "Action to perform" },
          task_name: { type: "string", description: "Exact name of the task to update or add" },
          status: { type: "string", enum: ["Todo", "In Progress", "Done", "Blocked"], description: "Status of the task" },
          priority: { type: "string", enum: ["Low", "Medium", "High", "Critical"], description: "Priority of the task" },
          sub_tasks: { type: "string", description: "Sub-tasks" },
          timeline: { type: "string", description: "Timeline" },
          plan_link: { type: "string", description: "Link to Plans/detail.md" },
          branch: { type: "string", description: "Branch name where work is taking place" }
        },
        required: ["repo", "action", "task_name", "branch"]
      }
    },
    {
      name: "upsert_config_entry",
      description: "Add or update an environment variable/configuration entry in Configurations.md.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          variable_name: { type: "string", description: "e.g. 'DATABASE_URL'" },
          type: { type: "string", description: "e.g. 'string', 'number', 'boolean'" },
          default_value: { type: "string", description: "Default value or 'None'" },
          required: { type: "boolean", description: "Is this required?" },
          description: { type: "string", description: "Description of the variable" },
          change_summary: { type: "string", description: "One-line entry for the Change History table" },
          branch: { type: "string", description: "Branch name for Change History table row" }
        },
        required: ["repo", "variable_name", "type", "default_value", "required", "description", "change_summary", "branch"]
      }
    },
    {
      name: "write_sprint_plan",
      description: "Create a detailed sprint or feature plan. Writes Plans/{slug}.md with full technical breakdown and adds all tasks to PLAN.md with links to the detail file. Call this when the user says 'build me X', 'plan this feature', or 'start a sprint'.",
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          branch: { type: "string", description: "Current branch name" },
          plan_name: { type: "string", description: "Human-readable plan name, e.g. 'User Auth System'" },
          slug: { type: "string", description: "Filename slug, e.g. 'user-auth-system' → Plans/user-auth-system.md" },
          goal: { type: "string", description: "What the user wants to achieve — 2-3 sentences" },
          scope_in: { type: "array", items: { type: "string" }, description: "What IS included in this plan" },
          scope_out: { type: "array", items: { type: "string" }, description: "What is explicitly OUT of scope" },
          technical_breakdown: { type: "string", description: "Detailed technical notes, approach, architecture decisions, and implementation strategy" },
          tasks: {
            type: "array",
            description: "Ordered list of tasks — each becomes a PLAN.md row linking back to this plan",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Task name" },
                sub_tasks: { type: "string", description: "Comma-separated sub-tasks" },
                priority: { type: "string", enum: ["Low", "Medium", "High", "Critical"] },
                timeline: { type: "string", description: "e.g. '2 days', 'Week 1'" }
              },
              required: ["name"]
            }
          },
          dependencies: { type: "array", items: { type: "string" }, description: "External dependencies, prerequisites, or blockers" },
          open_questions: { type: "array", items: { type: "string" }, description: "Risks, unknowns, or decisions still to be made" }
        },
        required: ["repo", "branch", "plan_name", "slug", "goal", "scope_in", "technical_breakdown", "tasks"]
      }
    },
    {
      name: "read_vault_note",
      description: "Read the full content of any note in the vault under Projects/{repo}/. Use this to read plan files (Plans/my-plan.md), architecture docs, feature docs, or any custom doc — search_vault only returns snippets, this returns the complete file.",
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      parameters: {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        additionalProperties: false,
        properties: {
          repo: { type: "string", description: "Repo name" },
          path: { type: "string", description: "Path relative to Projects/{repo}/, e.g. 'Plans/user-auth.md', 'Architecture/System-Overview.md', 'PLAN.md'" }
        },
        required: ["repo", "path"]
      }
    }
  ];

  for (const tool of tools) {
    const filePath = path.join(mcpDir, `${tool.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(tool, null, 2) + '\n');
  }

  // Clean up legacy schemas (safe to remove in a few versions)
  for (const oldFile of ['write_project_doc.json']) {
    const oldPath = path.join(mcpDir, oldFile);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  const instructions = `# DevBrain MCP Server

You are connected to \`devbrain\`, an MCP server that integrates with an Obsidian vault to persist context across git branches and agent sessions.

## Best Practices

1. **Always Call \`get_active_context\` First:** When you start a new session, immediately call \`get_active_context\` to understand which repository and branch the user is working on, and read the handoff from the previous session.
2. **Log Progress As You Go:** Do not wait until the end of the session to log your work. Call \`update_branch_log\` frequently to append timestamped entries.
3. **Write Handoffs:** At the end of a session, call \`write_handoff\` to leave notes for the next agent.
4. **Initialization:** If \`get_active_context\` returns that the repository is NOT initialized, call \`init_repo_context\` and use the specific document writing tools below.

## Reading Documents
To read an existing project document, use the **Resources API** via the following URIs:
- \`devbrain://{repo}/docs/{filename}\` (e.g. \`devbrain://{repo}/docs/Architecture/System-Overview.md\`)
- \`devbrain://{repo}/branch/{branch}\`
- \`devbrain://active-context\`

*Do not use \`search_vault\` when you just need to read a specific document.*

## Which Tool to Use for Which Document

| Task | Use Tool |
|---|---|
| Document a module, service, or system design | \`write_architecture_doc\` |
| Document a user-facing feature or flow | \`write_feature_doc\` |
| Log a new bug or TODO found in code | \`log_bug\` |
| Mark a bug as fixed after a merge | \`resolve_bug\` |
| Note that merged code violates an architecture decision | \`log_architectural_drift\` |
| Update a planned task's status | \`update_plan\` |
| Document a new env variable or config | \`upsert_config_entry\` |
| Custom/unstructured docs | \`write_custom_doc\` |
`;

  fs.writeFileSync(path.join(mcpDir, 'instructions.md'), instructions);
  console.log(`✅ Antigravity IDE: configured (${mcpDir})`);
}
