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
  decisions?: string[];
  failed_attempts?: Array<{ approach: string; reason_failed: string; topic_tags: string[] }>;
  blockers_open?: Array<{ description: string; branch: string }>;
  blockers_resolved?: Array<{ id: string; resolution: string }>;
  pin?: boolean;
  pin_reason?: string;
  keep_recent?: number;
}

export async function writeHandoff(ops: VaultOps, input: WriteHandoffInput): Promise<unknown> {
  const ctx = await ops.getActiveContext(input.repo);
  if (!ctx) {
    return { error: "no_active_context", message: "No active context. Switch to a branch first." };
  }

  const newBlockerIds: string[] = [];
  let compressionResult = { compressed: 0, archived: 0 };

  try {
    // 1. Write the session entry to HANDOFF.md
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
      pin: input.pin,
      pin_reason: input.pin_reason,
    });

    // 2. Promote architectural decisions to DECISIONS.md
    if (input.decisions?.length) {
      for (const decision of input.decisions) {
        await ops.appendDecision(ctx.active_repo, decision);
      }
    }

    // 3. Promote failed attempts to FAILED_ATTEMPTS.md
    if (input.failed_attempts?.length) {
      for (const fa of input.failed_attempts) {
        await ops.logFailedAttempt(ctx.active_repo, { ...fa, branch: ctx.active_branch });
      }
    }

    // 4. Log new open blockers to BLOCKERS.md
    if (input.blockers_open?.length) {
      for (const b of input.blockers_open) {
        const id = await ops.logBlocker(ctx.active_repo, b);
        newBlockerIds.push(id);
      }
    }

    // 5. Resolve blockers in BLOCKERS.md
    if (input.blockers_resolved?.length) {
      for (const br of input.blockers_resolved) {
        await ops.resolveBlocker(ctx.active_repo, br.id, br.resolution);
      }
    }

    // 6. Rolling compression — compress old sessions, keep most recent N in full
    compressionResult = await ops.compressAndRollHandoff(ctx.active_repo, input.keep_recent ?? 3);

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
    pinned: input.pin ?? false,
    promoted: {
      decisions: input.decisions?.length ?? 0,
      failed_attempts: input.failed_attempts?.length ?? 0,
      blockers_opened: newBlockerIds,
      blockers_resolved: input.blockers_resolved?.map(b => b.id) ?? [],
    },
    rolling_compression: compressionResult,
  };
}
