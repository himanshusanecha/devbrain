import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";

export const writeArchitectureDocSchema = z.object({
  repo: z.string(),
  filename: z.string().describe("e.g. 'System-Overview.md', 'Data-Flow.md'"),
  sections: z.record(z.string(), z.string()).describe("Map of heading titles (without ##) to markdown content"),
  change_summary: z.string().describe("One-line entry for the Change History table"),
  branch: z.string().describe("Branch name for Change History table row"),
});

export async function writeArchitectureDocHandler(
  ops: VaultOps,
  params: z.infer<typeof writeArchitectureDocSchema>
) {
  const { repo, filename, sections, change_summary, branch } = params;
  const path = `Architecture/${filename}`;

  // Patch each section individually
  for (const [heading, content] of Object.entries(sections)) {
    await ops.patchDocSection(repo, path, heading, content);
  }

  // Append change history
  const date = new Date().toISOString().slice(0, 10);
  await ops.appendChangeHistoryRow(repo, path, date, branch, change_summary);

  return {
    content: [{ type: "text" as const, text: `Successfully updated Architecture doc: ${path}` }],
  };
}
