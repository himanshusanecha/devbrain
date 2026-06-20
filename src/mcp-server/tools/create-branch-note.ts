import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianClient, ObsidianConnectionError } from "../../obsidian/client.js";

export interface CreateBranchNoteInput {
  repo: string;
  branch: string;
  description?: string;
}

export async function createBranchNote(
  ops: VaultOps,
  client: ObsidianClient,
  input: CreateBranchNoteInput
): Promise<unknown> {
  const safeBranch = input.branch.replace(/\//g, "-");
  const path = `Projects/${input.repo}/branch-${safeBranch}.md`;

  try {
    let created = false;
    const existing = await ops.getBranchNote(input.repo, input.branch);
    if (!existing) {
      await ops.createBranchNote(input.repo, input.branch, input.description);
      created = true;
    }
    await client.openNote(path);
    return { created, path };
  } catch (err) {
    if (err instanceof ObsidianConnectionError) {
      return { error: "obsidian_unavailable", message: "Obsidian is not running. Start Obsidian and try again." };
    }
    throw err;
  }
}
