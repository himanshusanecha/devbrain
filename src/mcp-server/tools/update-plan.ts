import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";

export const updatePlanSchema = z.object({
  repo: z.string(),
  action: z.enum(["add", "update_status", "strike_through"]),
  task_name: z.string().describe("Exact name of the task to update or add"),
  status: z.enum(["Todo", "In Progress", "Done", "Blocked"]).optional(),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  sub_tasks: z.string().optional(),
  timeline: z.string().optional(),
  plan_link: z.string().optional().describe("Link to Plans/detail.md"),
  branch: z.string().describe("Branch name where work is taking place"),
});

export async function updatePlanHandler(
  ops: VaultOps,
  params: z.infer<typeof updatePlanSchema>
) {
  if (params.action === "add") {
    await ops.appendPlanRow(params.repo, {
      task_name: params.task_name,
      status: params.status ?? "Todo",
      priority: params.priority,
      sub_tasks: params.sub_tasks,
      timeline: params.timeline,
      plan_link: params.plan_link,
      branch: params.branch
    });
    return {
      content: [{ type: "text" as const, text: `Successfully added plan row: ${params.task_name} to PLAN.md` }],
    };
  } else if (params.action === "update_status") {
      if (!params.status) {
          throw new Error("status is required for update_status action");
      }
      await ops.updatePlanRowStatus(params.repo, params.task_name, params.status, false);
      return {
          content: [{ type: "text" as const, text: `Successfully updated plan row status to ${params.status} for: ${params.task_name} in PLAN.md` }],
      };
  } else if (params.action === "strike_through") {
      await ops.updatePlanRowStatus(params.repo, params.task_name, params.status ?? "Done", true);
      return {
          content: [{ type: "text" as const, text: `Successfully struck through plan row: ${params.task_name} in PLAN.md` }],
      };
  }
  
  throw new Error("Invalid action");
}
