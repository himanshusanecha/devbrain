import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianConnectionError } from "../../obsidian/client.js";

export const logFailedAttemptSchema = z.object({
  repo: z.string().describe("Repo name"),
  approach: z.string().describe("Name of the approach that was tried"),
  reason_failed: z.string().describe("Why it failed — enough detail that a future agent won't repeat it"),
  topic_tags: z.array(z.string()).describe("Tags for searching, e.g. ['retries', 'queue', 'workers']"),
  branch: z.string().describe("Branch where this was attempted"),
});

export async function logFailedAttemptHandler(ops: VaultOps, params: z.infer<typeof logFailedAttemptSchema>) {
  try {
    await ops.logFailedAttempt(params.repo, {
      approach: params.approach,
      reason_failed: params.reason_failed,
      topic_tags: params.topic_tags,
      branch: params.branch,
    });
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ success: true, message: `Failed attempt logged to FAILED_ATTEMPTS.md` }, null, 2),
      }],
    };
  } catch (err) {
    if (err instanceof ObsidianConnectionError) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "obsidian_unavailable", message: "Obsidian is not running." }) }] };
    }
    throw err;
  }
}
