import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianConnectionError } from "../../obsidian/client.js";

export async function getActiveContext(ops: VaultOps, input?: { repo?: string }): Promise<unknown> {
  let ctx;
  try {
    ctx = await ops.getActiveContext(input?.repo);
  } catch (err) {
    if (err instanceof ObsidianConnectionError) {
      return { error: "obsidian_unavailable", message: "Obsidian is not running. Start Obsidian and try again." };
    }
    throw err;
  }

  if (!ctx) {
    return { error: "no_active_context", message: "No active context found. Switch to a branch first." };
  }

  const { active_repo: repo, active_branch: branch, switched_at } = ctx;

  const [branchNote, lastHandoff, relatedNotes, openBlockers, historySummary] = await Promise.allSettled([
    ops.getBranchNote(repo, branch),
    ops.getLastHandoff(repo),
    ops.searchVault(`branch:${branch} status:active`),
    ops.getOpenBlockers(repo),
    ops.getHandoffSummaryBlock(repo),
  ]);

  const note = branchNote.status === "fulfilled" ? branchNote.value : null;
  const handoff = lastHandoff.status === "fulfilled" ? lastHandoff.value : null;
  const related = relatedNotes.status === "fulfilled" ? relatedNotes.value : [];
  const blockers = openBlockers.status === "fulfilled" ? openBlockers.value : [];
  const summaryBlock = historySummary.status === "fulfilled" ? historySummary.value : null;

  const fm = note?.frontmatter ?? {};
  const content = note?.content ?? "";

  const overviewSection = extractSection(content, "Overview") || extractSection(content, "Purpose");
  const blockedSection = extractSection(content, "Blocked On");
  const nextSection = extractSection(content, "Next Session");

  const is_initialized = overviewSection.length > 0;

  const result: Record<string, unknown> = {
    repo,
    branch,
    switched_at,
    is_initialized,
    last_session: handoff
      ? {
          agent: handoff.agent,
          summary: handoff.summary,
          files_changed: handoff.files_changed,
          ended_at: handoff.ended_at,
        }
      : null,
    session_history_summary: summaryBlock,
    open_blockers: blockers.map(b => ({
      id: b.id,
      description: b.description,
      branch: b.branch,
      opened_at: b.opened_at,
    })),
    blocked_on: blockedSection || String(fm["blocked_on"] ?? ""),
    next_session_start: nextSection || String(fm["next_session"] ?? ""),
    related_notes: related.slice(0, 5).map((r) => r.filename),
  };

  if (!is_initialized) {
    result.instruction = "This repository context has not been initialized. Please call the init_repo_context tool before proceeding to set the purpose and initial architectural decisions.";
  }

  return result;
}

function extractSection(content: string, heading: string): string {
  const re = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const m = content.match(re);
  if (!m) return "";
  return m[1].replace(/<!--[\s\S]*?-->/g, "").trim();
}
