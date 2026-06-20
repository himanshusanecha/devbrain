import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianConnectionError } from "../../obsidian/client.js";

export interface GetDecisionsInput {
  repo: string;
  limit?: number;
}

export async function getDecisions(ops: VaultOps, input: GetDecisionsInput): Promise<unknown> {
  try {
    const decisions = await ops.getDecisions(input.repo, input.limit ?? 10);
    return { repo: input.repo, decisions };
  } catch (err) {
    if (err instanceof ObsidianConnectionError) {
      return { error: "obsidian_unavailable", message: "Obsidian is not running. Start Obsidian and try again." };
    }
    throw err;
  }
}
