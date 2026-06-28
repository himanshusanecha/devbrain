import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianConnectionError } from "../../obsidian/client.js";

export const resolveBlockerSchema = z.object({
  repo: z.string().describe("Repo name"),
  id: z.string().describe("Blocker ID to resolve, e.g. B1"),
  resolution: z.string().describe("How the blocker was resolved — enough detail to understand it if it reopens"),
});

export async function resolveBlockerHandler(ops: VaultOps, params: z.infer<typeof resolveBlockerSchema>) {
  try {
    await ops.resolveBlocker(params.repo, params.id, params.resolution);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ success: true, message: `Blocker ${params.id} marked as resolved in BLOCKERS.md` }, null, 2),
      }],
    };
  } catch (err) {
    if (err instanceof ObsidianConnectionError) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "obsidian_unavailable", message: "Obsidian is not running." }) }] };
    }
    throw err;
  }
}
