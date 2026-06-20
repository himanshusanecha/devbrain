import { VaultOps } from "../../obsidian/vault-ops.js";

export interface InitRepoContextInput {
  repo: string;
  branch: string;
  purpose: string;
  decisions: string[];
}

export async function initRepoContext(
  ops: VaultOps,
  input: InitRepoContextInput
): Promise<unknown> {
  const { repo, branch, purpose, decisions } = input;

  await ops.updateBranchNotePurpose(repo, branch, purpose);

  const validDecisions = decisions.filter((d) => d.trim().length > 0 && d.length <= 300);
  for (const decision of validDecisions.slice(0, 5)) {
    await ops.appendDecision(repo, decision);
  }

  return {
    repo,
    branch,
    purpose_written: true,
    decisions_written: validDecisions.slice(0, 5).length,
  };
}
