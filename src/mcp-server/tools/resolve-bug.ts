import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";

export const resolveBugSchema = z.object({
  repo: z.string(),
  bug_title: z.string().describe("Exact title of the bug to resolve (matches log_bug title)"),
  resolution: z.string().describe("Detailed explanation of how the bug was fixed"),
  files_changed: z.array(z.string()).describe("Source files modified to fix the bug"),
  branch: z.string().describe("Branch name where the bug was resolved"),
});

export async function resolveBugHandler(
  ops: VaultOps,
  params: z.infer<typeof resolveBugSchema>
) {
  await ops.resolveBug(params.repo, {
    bug_title: params.bug_title,
    resolution: params.resolution,
    files_changed: params.files_changed,
    branch: params.branch,
  });

  return {
    content: [{ type: "text" as const, text: `Successfully marked bug as resolved: ${params.bug_title} in Bug-tracking.md` }],
  };
}
