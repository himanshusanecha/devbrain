import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianConnectionError } from "../../obsidian/client.js";

export interface WriteHandoffInput {
  summary: string;
  files_changed: string[];
  blocked_on: string;
  next_session_start: string;
  agent_name: string;
  repo?: string;
  doc_impact?: { docName: string; description: string }[];
  overview?: string;
}

export async function writeHandoff(ops: VaultOps, input: WriteHandoffInput): Promise<unknown> {
  const ctx = await ops.getActiveContext(input.repo);
  if (!ctx) {
    return { error: "no_active_context", message: "No active context. Switch to a branch first." };
  }

  try {
    await ops.writeHandoff({
      repo: ctx.active_repo,
      branch: ctx.active_branch,
      summary: input.summary,
      files_changed: input.files_changed,
      blocked_on: input.blocked_on,
      next_session_start: input.next_session_start,
      agent_name: input.agent_name,
      doc_impact: input.doc_impact,
      overview: input.overview,
    });
  } catch (err) {
    if (err instanceof ObsidianConnectionError) {
      return { error: "obsidian_unavailable", message: "Obsidian is not running. Start Obsidian and try again." };
    }
    throw err;
  }

  return {
    success: true,
    repo: ctx.active_repo,
    branch: ctx.active_branch,
    written_at: new Date().toISOString(),
  };
}
