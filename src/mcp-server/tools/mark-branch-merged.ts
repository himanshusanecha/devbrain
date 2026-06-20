import { VaultOps } from "../../obsidian/vault-ops.js";

export interface MarkBranchMergedInput {
  repo: string;
  branch: string;
  merged_into: string;
  summary: string;
}

export async function markBranchMerged(
  ops: VaultOps,
  input: MarkBranchMergedInput
): Promise<unknown> {
  const { repo, branch, merged_into, summary } = input;
  await ops.markBranchMerged(repo, branch, merged_into, summary);
  return { repo, branch, merged_into, marked_merged: true };
}
