import { z } from "zod";
import { VaultOps } from "../../obsidian/vault-ops.js";

export const writeSprintPlanSchema = z.object({
  repo: z.string().describe("Repo name"),
  branch: z.string().describe("Current branch name"),
  plan_name: z.string().describe("Human-readable plan name, e.g. 'User Auth System'"),
  slug: z.string().describe("Filename slug for Plans/ file, e.g. 'user-auth-system' → Plans/user-auth-system.md"),
  goal: z.string().describe("What the user wants to achieve — 2-3 sentences"),
  scope_in: z.array(z.string()).describe("What IS included in this plan"),
  scope_out: z.array(z.string()).optional().describe("What is explicitly OUT of scope"),
  technical_breakdown: z.string().describe("Detailed technical notes, approach, architecture decisions, and implementation strategy"),
  tasks: z.array(z.object({
    name: z.string().describe("Task name — will become a PLAN.md row"),
    sub_tasks: z.string().optional().describe("Comma-separated sub-tasks"),
    priority: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
    timeline: z.string().optional().describe("e.g. '2 days', 'Week 1'"),
  })).describe("Ordered list of tasks — each becomes a PLAN.md row linking back to this plan"),
  dependencies: z.array(z.string()).optional().describe("External dependencies, prerequisites, or blockers"),
  open_questions: z.array(z.string()).optional().describe("Risks, unknowns, or decisions still to be made"),
});

function buildPlanDoc(params: z.infer<typeof writeSprintPlanSchema>, filename: string): string {
  const now = new Date().toISOString();
  const date = now.slice(0, 10);

  const scopeInLines = params.scope_in.map((s) => `- ${s}`).join("\n");
  const scopeOutLines = params.scope_out?.length
    ? params.scope_out.map((s) => `- ${s}`).join("\n")
    : "- Not specified";

  const taskTableRows = params.tasks
    .map((t, i) => `| ${i + 1} | ${t.name} | ${t.priority ?? "Medium"} | ${t.sub_tasks ?? ""} |`)
    .join("\n");

  const dependenciesSection = params.dependencies?.length
    ? params.dependencies.map((d) => `- ${d}`).join("\n")
    : "None";

  const openQuestionsSection = params.open_questions?.length
    ? params.open_questions.map((q) => `- ${q}`).join("\n")
    : "None";

  return `---
repo: ${params.repo}
plan_name: ${params.plan_name}
created: ${now}
branch: "[[${params.branch}]]"
status: active
tags:
  - devbrain
  - project/${params.repo}
  - plan
---

## Goal
${params.goal}

## Scope

**In scope:**
${scopeInLines}

**Out of scope:**
${scopeOutLines}

## Technical Breakdown
${params.technical_breakdown}

## Tasks

| # | Task | Priority | Notes |
|---|------|----------|-------|
${taskTableRows}

## Dependencies
${dependenciesSection}

## Open Questions
${openQuestionsSection}

## Change History

| Date | Branch | Change |
|------|--------|--------|
| ${date} | [[${params.branch}]] | Initial plan created |
`;
}

export async function writeSprintPlanHandler(
  ops: VaultOps,
  params: z.infer<typeof writeSprintPlanSchema>
) {
  const safeSlug = params.slug.replace(/[^a-zA-Z0-9-_]/g, "-").replace(/^-+/, "");
  const filename = `Plans/${safeSlug}.md`;
  const planDoc = buildPlanDoc(params, filename);

  await ops.writeCustomDoc(params.repo, filename, planDoc);

  for (const task of params.tasks) {
    await ops.appendPlanRow(params.repo, {
      task_name: task.name,
      sub_tasks: task.sub_tasks,
      status: "Todo",
      priority: task.priority,
      timeline: task.timeline,
      plan_link: `Plans/${safeSlug}`,
      branch: params.branch,
    });
  }

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        success: true,
        plan_file: `Projects/${params.repo}/${filename}`,
        tasks_added: params.tasks.length,
        plan_link: `devbrain://${params.repo}/docs/${filename}`,
      }, null, 2),
    }],
  };
}
