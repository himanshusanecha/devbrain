import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "fs";
import os from "os";
import path from "path";

import { ObsidianClient, ObsidianConfig } from "../obsidian/client.js";
import { isObsidianReachable } from "../obsidian/health.js";
import { VaultOps } from "../obsidian/vault-ops.js";

import { getActiveContext } from "./tools/get-active-context.js";
import { writeHandoff } from "./tools/write-handoff.js";
import { listBranchNotes } from "./tools/list-branch-notes.js";
import { getDecisions } from "./tools/get-decisions.js";

import { searchVault } from "./tools/search-vault.js";
import { getBacklinks } from "./tools/get-backlinks.js";
import { initRepoContext } from "./tools/init-repo-context.js";
import { writeCustomDoc } from "./tools/write-custom-doc.js";
import { updateBranchLog } from "./tools/update-branch-log.js";
import { markBranchMerged } from "./tools/mark-branch-merged.js";
import { verifySourceLinks } from "./tools/verify-source-links.js";

import { writeArchitectureDocHandler, writeArchitectureDocSchema } from "./tools/write-architecture-doc.js";
import { writeFeatureDocHandler, writeFeatureDocSchema } from "./tools/write-feature-doc.js";
import { logBugHandler, logBugSchema } from "./tools/log-bug.js";
import { resolveBugHandler, resolveBugSchema } from "./tools/resolve-bug.js";
import { logArchitecturalDriftHandler, logArchitecturalDriftSchema } from "./tools/log-architectural-drift.js";
import { updatePlanHandler, updatePlanSchema } from "./tools/update-plan.js";
import { upsertConfigEntryHandler, upsertConfigEntrySchema } from "./tools/upsert-config-entry.js";
import { writeSprintPlanHandler, writeSprintPlanSchema } from "./tools/write-sprint-plan.js";
import { readVaultNoteHandler } from "./tools/read-vault-note.js";

export async function startMcpServer() {
  const envFile = path.join(os.homedir(), '.devbrain.env');
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^export\s+([A-Z_]+)="([^"]+)"$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  }

  const apiKey = process.env.OBSIDIAN_API_KEY ?? "";
  const port = parseInt(process.env.OBSIDIAN_PORT ?? "27124", 10);
  const vaultPath = process.env.DEVBRAIN_VAULT_PATH ?? "~/vault";

  if (!apiKey) {
    process.stderr.write("devbrain: OBSIDIAN_API_KEY is not set\n");
  }

  const config: ObsidianConfig = {
    host: "localhost",
    port,
    apiKey,
    ssl: true,
  };

  const client = new ObsidianClient(config);
  const ops = new VaultOps(client);

  const server = new McpServer({
    name: "devbrain",
    version: "1.0.0",
  });

  // --- get_active_context ---
  server.registerTool(
    "get_active_context",
    {
      description: "Load the active branch context from the Obsidian vault. Call this at the start of every session.",
      inputSchema: {
        repo: z.string().optional().describe("Repo name. Omit or leave empty to use the global active context fallback."),
      }
    },
    async (input) => {
      const result = await getActiveContext(ops, input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { success: true }, null, 2) }] };
    }
  );

  // --- write_handoff ---
  server.registerTool(
    "write_handoff",
    {
      description: "Write a session handoff note to the vault. Call this at the end of any session where files were modified.",
      inputSchema: {
        summary: z.string().describe("What was accomplished this session"),
        files_changed: z.array(z.string()).describe("List of files modified"),
        blocked_on: z.string().describe("Current blockers or empty string"),
        next_session_start: z.string().describe("What the next agent should do first"),
        agent_name: z.string().describe("Name of the agent writing the handoff"),
        repo: z.string().optional().describe("Optional repo name. Uses global active context if omitted."),
        doc_impact: z.array(z.object({
          docName: z.string().describe("Name of the document (e.g. ARCHITECTURE.md)"),
          description: z.string().describe("Description of how the document was impacted")
        })).optional().describe("List of project documents impacted by these changes"),
        overview: z.string().optional().describe("Short description of the branch purpose. Updates the Overview section."),
      }
    },
    async (input) => {
      const result = await writeHandoff(ops, input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { success: true }, null, 2) }] };
    }
  );

  // --- list_branch_notes ---
  server.registerTool(
    "list_branch_notes",
    {
      description: "List all branch notes for a repo. Shows status, last agent, and purpose of each branch.",
      inputSchema: {
        repo: z.string().optional().describe("Repo name. Uses active repo if omitted."),
      }
    },
    async (input) => {
      const result = await listBranchNotes(ops, input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { success: true }, null, 2) }] };
    }
  );

  // --- get_decisions ---
  server.registerTool(
    "get_decisions",
    {
      description: "Get logged architectural decisions for a repo. Check this before proposing approaches.",
      inputSchema: {
        repo: z.string().describe("Repo name"),
        limit: z.number().optional().describe("Max decisions to return (default: 10)"),
      }
    },
    async (input) => {
      const result = await getDecisions(ops, input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { success: true }, null, 2) }] };
    }
  );



  // --- init_repo_context ---
  server.registerTool(
    "init_repo_context",
    {
      description: "Initialize vault context for a repo on first use. Writes a purpose description to the branch note and seeds DECISIONS.md with initial architectural decisions. Call this once when starting work on a new repo.",
      inputSchema: {
        repo: z.string().describe("Repo name"),
        branch: z.string().describe("Current branch name"),
        purpose: z.string().describe("2-3 sentence description of what this repo does and its primary goal"),
        decisions: z.array(z.string()).describe("3-5 key architectural decisions or conventions observed in the codebase"),
      }
    },
    async (input) => {
      const result = await initRepoContext(ops, input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { success: true }, null, 2) }] };
    }
  );

  // --- update_branch_log ---
  server.registerTool(
    "update_branch_log",
    {
      description: "Append a timestamped entry to the branch change log. Call this as you make code changes during a session — not just at session end.",
      inputSchema: {
        repo: z.string().describe("Repo name"),
        branch: z.string().describe("Branch name"),
        changes: z.array(z.string()).describe("List of changes made — one bullet per file or logical change"),
        doc_impact: z.array(z.object({
          docName: z.string().describe("Name of the document (e.g. ARCHITECTURE.md)"),
          description: z.string().describe("Description of how the document was impacted")
        })).optional().describe("List of project documents impacted by these changes"),
        overview: z.string().optional().describe("Short description of the branch purpose. Updates the Overview section."),
      }
    },
    async (input) => {
      const result = await updateBranchLog(ops, input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { success: true }, null, 2) }] };
    }
  );

  // --- mark_branch_merged ---
  server.registerTool(
    "mark_branch_merged",
    {
      description: "Mark a branch as merged into release/master. Sets status, merged_into, merged_at, and writes the merge summary. Call this after a merge event.",
      inputSchema: {
        repo: z.string().describe("Repo name"),
        branch: z.string().describe("The branch that was merged"),
        merged_into: z.string().describe("The target branch (main, master, release)"),
        summary: z.string().describe("2-3 sentences describing what this branch accomplished"),
      }
    },
    async (input) => {
      const result = await markBranchMerged(ops, input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { success: true }, null, 2) }] };
    }
  );

  // --- write_custom_doc ---
  server.registerTool(
    "write_custom_doc",
    {
      description: "Write a completely custom unstructured documentation file to the vault (e.g. Index.md). Use specific structured doc tools for standard docs.",
      inputSchema: {
        repo: z.string().describe("Repo name"),
        filename: z.string().describe("Filename, e.g. Index.md"),
        content: z.string().describe("Full markdown content of the file"),
      }
    },
    async (input) => {
      const result = await writeCustomDoc(ops, input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { success: true }, null, 2) }] };
    }
  );

  // --- search_vault ---
  server.registerTool(
    "search_vault",
    {
      description: "Full-text BM25 search across the Obsidian vault. Call before answering architecture questions.",
      inputSchema: {
        query: z.string().describe("Search query"),
        tags: z.array(z.string()).optional().describe("Filter by tags"),
        limit: z.number().optional().describe("Max results (default: 10)"),
      }
    },
    async (input) => {
      const result = await searchVault(ops, input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { success: true }, null, 2) }] };
    }
  );

  // --- get_backlinks ---
  server.registerTool(
    "get_backlinks",
    {
      description: "Find all vault notes that link to a given note. Call before modifying shared utilities.",
      inputSchema: {
        note_path: z.string().describe("Path to the note to find backlinks for"),
      }
    },
    async (input) => {
      const result = await getBacklinks(ops, input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result ?? { success: true }, null, 2) }] };
    }
  );

  // --- verify_source_links ---
  server.registerTool(
    "verify_source_links",
    {
      description: "Extract backticked source code references from the project docs and verify they exist in the repository.",
      inputSchema: {
        repo: z.string().describe("Repo name"),
        docs: z.array(z.string()).optional().describe("List of files to check (e.g., ARCHITECTURE.md, Features.md). Defaults to all core docs."),
      }
    },
    async (input) => {
      const result = await verifySourceLinks(ops, input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- NEW STRUCTURED WRITE TOOLS ---

  server.registerTool("write_architecture_doc", {
    description: "Write or update an Architecture document section by section. Preserves other sections. Use for modules, service designs.",
    inputSchema: writeArchitectureDocSchema
  }, async (input) => writeArchitectureDocHandler(ops, input));

  server.registerTool("write_feature_doc", {
    description: "Write or update a Feature document. Appends edge cases without overwriting existing ones.",
    inputSchema: writeFeatureDocSchema
  }, async (input) => writeFeatureDocHandler(ops, input));

  server.registerTool("log_bug", {
    description: "Append a new active bug to the Bug-tracking.md document.",
    inputSchema: logBugSchema
  }, async (input) => logBugHandler(ops, input));

  server.registerTool("resolve_bug", {
    description: "Mark a bug as resolved in Bug-tracking.md. Moves it from Active to Resolved section.",
    inputSchema: resolveBugSchema
  }, async (input) => resolveBugHandler(ops, input));

  server.registerTool("log_architectural_drift", {
    description: "Log when merged code violates an established architectural decision in DECISIONS.md.",
    inputSchema: logArchitecturalDriftSchema
  }, async (input) => logArchitecturalDriftHandler(ops, input));

  server.registerTool("update_plan", {
    description: "Update task status or add new rows to PLAN.md.",
    inputSchema: updatePlanSchema
  }, async (input) => updatePlanHandler(ops, input));

  server.registerTool("upsert_config_entry", {
    description: "Add or update an environment variable/configuration entry in Configurations.md.",
    inputSchema: upsertConfigEntrySchema
  }, async (input) => upsertConfigEntryHandler(ops, input));

  server.registerTool("write_sprint_plan", {
    description: "Create a detailed sprint or feature plan. Writes Plans/{slug}.md with full technical breakdown and adds all tasks to PLAN.md with links to the detail file. Call this when the user says 'build me X', 'plan this feature', or 'start a sprint'.",
    inputSchema: writeSprintPlanSchema
  }, async (input) => writeSprintPlanHandler(ops, input));

  // --- read_vault_note ---
  server.registerTool(
    "read_vault_note",
    {
      description: "Read the full content of any note in the vault under Projects/{repo}/. Use this to read plan files (Plans/my-plan.md), architecture docs, feature docs, or any custom doc — search_vault only returns snippets, this returns the complete file.",
      inputSchema: {
        repo: z.string().describe("Repo name"),
        path: z.string().describe("Path relative to Projects/{repo}/, e.g. 'Plans/user-auth.md', 'Architecture/System-Overview.md', 'PLAN.md'"),
      }
    },
    async (input) => {
      const result = await readVaultNoteHandler(ops, input);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  // --- RESOURCES API ---

  server.resource(
    "devbrain-doc",
    new ResourceTemplate("devbrain://{repo}/docs/{filename+}", { list: undefined }),
    async (uri, { repo, filename }) => {
      try {
        const content = await ops.getRawProjectDoc(repo, filename);
        return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: content }] };
      } catch (err: any) {
        throw new Error(`Could not read resource: ${err.message}`);
      }
    }
  );

  server.resource(
    "devbrain-branch-note",
    new ResourceTemplate("devbrain://{repo}/branch/{branch}", { list: undefined }),
    async (uri, { repo, branch }) => {
      try {
        const note = await ops.getBranchNote(repo, branch);
        if (!note) throw new Error("Branch note not found");
        return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: note.content }] };
      } catch (err: any) {
        throw new Error(`Could not read resource: ${err.message}`);
      }
    }
  );

  server.resource(
    "devbrain-active-context",
    "devbrain://active-context",
    async (uri) => {
      try {
        const ctx = await ops.getActiveContext();
        if (!ctx) throw new Error("No active context found");
        return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(ctx, null, 2) }] };
      } catch (err: any) {
        throw new Error(`Could not read resource: ${err.message}`);
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const reachable = await isObsidianReachable(config);
  process.stderr.write(`devbrain MCP server started\n`);
  process.stderr.write(`Obsidian: ${reachable ? "✅ reachable" : "⚠️  not reachable"} at localhost:${port}\n`);
  process.stderr.write(`Vault: ${vaultPath}\n`);
}
