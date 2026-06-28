import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianConnectionError } from "../../obsidian/client.js";

export const getFullHistorySchema = z.object({
  repo: z.string().describe("Repo name"),
  from: z.string().optional().describe("ISO date to start from, e.g. '2026-06-01'. Returns all archived sessions if omitted."),
});

export async function getFullHistoryHandler(ops: VaultOps, params: z.infer<typeof getFullHistorySchema>) {
  try {
    const history = await ops.getFullHistory(params.repo, params.from);
    return { content: [{ type: "text" as const, text: history }] };
  } catch (err) {
    if (err instanceof ObsidianConnectionError) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "obsidian_unavailable", message: "Obsidian is not running." }) }] };
    }
    throw err;
  }
}
