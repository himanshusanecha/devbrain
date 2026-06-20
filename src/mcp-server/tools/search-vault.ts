import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianConnectionError } from "../../obsidian/client.js";

export interface SearchVaultInput {
  query: string;
  tags?: string[];
  limit?: number;
}

export async function searchVault(ops: VaultOps, input: SearchVaultInput): Promise<unknown> {
  try {
    const results = await ops.searchVault(input.query, input.tags);
    const limited = results.slice(0, input.limit ?? 10);
    return {
      query: input.query,
      count: limited.length,
      results: limited.map((r) => ({
        filename: r.filename,
        score: r.score,
        excerpts: r.matches.slice(0, 3).map((m) => m.context),
      })),
    };
  } catch (err) {
    if (err instanceof ObsidianConnectionError) {
      return { error: "obsidian_unavailable", message: "Obsidian is not running. Start Obsidian and try again." };
    }
    throw err;
  }
}
