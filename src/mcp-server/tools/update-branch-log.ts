import { VaultOps } from "../../obsidian/vault-ops.js";

export interface UpdateBranchLogInput {
  repo: string;
  branch: string;
  changes: string[];
  doc_impact?: { docName: string; description: string }[];
  overview?: string;
}

export async function updateBranchLog(
  ops: VaultOps,
  input: UpdateBranchLogInput
): Promise<unknown> {
  const { repo, branch, changes, doc_impact, overview } = input;
  
  if (overview) {
    await ops.updateBranchNotePurpose(repo, branch, overview);
  }

  const valid = changes.filter((c) => c.trim().length > 0);
  
  if (valid.length) {
    await ops.appendToBranchChangesLog(repo, branch, valid);
  }

  if (doc_impact && doc_impact.length > 0) {
    for (const impact of doc_impact) {
      await ops.logDocImpact(repo, branch, impact.docName, impact.description);
    }
  }

  return { repo, branch, entries_written: valid.length, doc_impacts_logged: doc_impact?.length || 0 };
}
