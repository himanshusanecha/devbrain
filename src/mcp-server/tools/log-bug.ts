import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";

export const logBugSchema = z.object({
  repo: z.string(),
  title: z.string().describe("Short descriptive title for the bug"),
  description: z.string().describe("Detailed description of the bug and how to reproduce"),
  file_refs: z.array(z.string()).optional().describe("Source files involved"),
  severity: z.enum(["low", "medium", "high", "critical"]),
  branch: z.string().describe("Branch name where the bug was found or being worked on"),
});

export async function logBugHandler(
  ops: VaultOps,
  params: z.infer<typeof logBugSchema>
) {
  await ops.appendBug(params.repo, {
    title: params.title,
    description: params.description,
    file_refs: params.file_refs,
    severity: params.severity,
    branch: params.branch,
  });

  return {
    content: [{ type: "text" as const, text: `Successfully logged bug: ${params.title} to Bug-tracking.md` }],
  };
}
