import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianConnectionError } from "../../obsidian/client.js";

export const getFailedAttemptsSchema = z.object({
  repo: z.string().describe("Repo name"),
  topic: z.string().optional().describe("Filter by topic keyword — matches approach name, tags, or failure reason. Omit to get all."),
});

export async function getFailedAttemptsHandler(ops: VaultOps, params: z.infer<typeof getFailedAttemptsSchema>) {
  try {
    const results = await ops.getFailedAttempts(params.repo, params.topic);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ repo: params.repo, topic: params.topic ?? null, failed_attempts: results }, null, 2),
      }],
    };
  } catch (err) {
    if (err instanceof ObsidianConnectionError) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "obsidian_unavailable", message: "Obsidian is not running." }) }] };
    }
    throw err;
  }
}
