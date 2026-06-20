import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";

export const upsertConfigEntrySchema = z.object({
  repo: z.string(),
  variable_name: z.string().describe("e.g. 'DATABASE_URL'"),
  type: z.string().describe("e.g. 'string', 'number', 'boolean'"),
  default_value: z.string().describe("Default value or 'None'"),
  required: z.boolean(),
  description: z.string(),
  change_summary: z.string().describe("One-line entry for the Change History table"),
  branch: z.string().describe("Branch name for Change History table row"),
});

export async function upsertConfigEntryHandler(
  ops: VaultOps,
  params: z.infer<typeof upsertConfigEntrySchema>
) {
  await ops.upsertConfigRow(params.repo, {
    variable_name: params.variable_name,
    type: params.type,
    default_value: params.default_value,
    required: params.required,
    description: params.description,
    change_summary: params.change_summary,
    branch: params.branch,
  });

  return {
    content: [{ type: "text" as const, text: `Successfully upserted config entry for ${params.variable_name} in Configurations.md` }],
  };
}
