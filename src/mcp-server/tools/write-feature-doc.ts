import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";

export const writeFeatureDocSchema = z.object({
  repo: z.string(),
  filename: z.string().describe("e.g. 'Authentication.md'"),
  user_goal: z.string().optional().describe("Markdown content for ## User Goal"),
  flow_steps: z.array(z.string()).optional().describe("Numbered list of steps for ## Flow"),
  edge_cases: z.array(z.string()).optional().describe("Bulleted items to append (not overwrite) to ## Edge Cases"),
  change_summary: z.string().describe("One-line entry for the Change History table"),
  branch: z.string().describe("Branch name for Change History table row"),
});

export async function writeFeatureDocHandler(
  ops: VaultOps,
  params: z.infer<typeof writeFeatureDocSchema>
) {
  const { repo, filename, user_goal, flow_steps, edge_cases, change_summary, branch } = params;
  const path = `Features/${filename}`;

  if (user_goal) {
    await ops.patchDocSection(repo, path, "User Goal", user_goal);
  }
  
  if (flow_steps && flow_steps.length > 0) {
    const flowMd = flow_steps.map((step, i) => `${i + 1}. ${step}`).join("\\n");
    await ops.patchDocSection(repo, path, "Flow", flowMd);
  }

  if (edge_cases && edge_cases.length > 0) {
    let existingContent = "";
    try {
        const rawDoc = await ops.getRawProjectDoc(repo, path);
        const sectionRe = new RegExp(`(## Edge Cases\\n)([\\s\\S]*?)(?=\\n## |\\n*$)`);
        const match = sectionRe.exec(rawDoc);
        if (match) {
            existingContent = match[2].trimEnd();
        }
    } catch {
        // Doc might not exist, or section might not exist, ignore
    }
    
    const newEdges = edge_cases.map(edge => `- ${edge}`).join("\\n");
    const updatedEdges = existingContent ? `${existingContent}\\n${newEdges}` : newEdges;
    await ops.patchDocSection(repo, path, "Edge Cases", updatedEdges);
  }

  const date = new Date().toISOString().slice(0, 10);
  await ops.appendChangeHistoryRow(repo, path, date, branch, change_summary);

  return {
    content: [{ type: "text" as const, text: `Successfully updated Feature doc: ${path}` }],
  };
}
