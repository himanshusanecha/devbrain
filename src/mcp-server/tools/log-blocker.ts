import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianConnectionError } from "../../obsidian/client.js";

export const logBlockerSchema = z.object({
  repo: z.string().describe("Repo name"),
  description: z.string().describe("Description of what is blocked and why"),
  branch: z.string().describe("Branch where the blocker exists"),
});

export async function logBlockerHandler(ops: VaultOps, params: z.infer<typeof logBlockerSchema>) {
  try {
    const id = await ops.logBlocker(params.repo, { description: params.description, branch: params.branch });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ success: true, id, message: `Blocker logged as ${id} in BLOCKERS.md` }, null, 2),
      }],
    };
  } catch (err) {
    if (err instanceof ObsidianConnectionError) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "obsidian_unavailable", message: "Obsidian is not running." }) }] };
    }
    throw err;
  }
}
