import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";

export const logArchitecturalDriftSchema = z.object({
  repo: z.string(),
  description: z.string().describe("Explanation of what contradicts established decisions"),
  decision_ref: z.string().describe("Reference to the DECISIONS.md entry it violates (e.g. '2023-10-27 — Migrate to Postgres')"),
  branch: z.string().describe("Branch name where the drift occurred"),
});

export async function logArchitecturalDriftHandler(
  ops: VaultOps,
  params: z.infer<typeof logArchitecturalDriftSchema>
) {
  await ops.appendDrift(params.repo, {
    description: params.description,
    decision_ref: params.decision_ref,
    branch: params.branch,
  });

  return {
    content: [{ type: "text" as const, text: `Successfully logged architectural drift referencing ${params.decision_ref} to Bug-tracking.md` }],
  };
}
