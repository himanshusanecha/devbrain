import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianConnectionError } from "../../obsidian/client.js";

export interface ListBranchNotesInput {
  repo?: string;
}

export async function listBranchNotes(ops: VaultOps, input: ListBranchNotesInput): Promise<unknown> {
  let repo = input.repo;

  if (!repo) {
    const ctx = await ops.getActiveContext();
    if (!ctx) {
      return { error: "no_repo", message: "Provide a repo name or switch to a branch first." };
    }
    repo = ctx.active_repo;
  }

  try {
    const notes = await ops.listBranchNotes(repo);
    return { repo, branches: notes };
  } catch (err) {
    if (err instanceof ObsidianConnectionError) {
      return { error: "obsidian_unavailable", message: "Obsidian is not running. Start Obsidian and try again." };
    }
    throw err;
  }
}
