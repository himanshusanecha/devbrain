import { VaultOps } from "../../obsidian/vault-ops.js";

export interface ReadVaultNoteInput {
  repo: string;
  path: string;
}

export async function readVaultNoteHandler(
  ops: VaultOps,
  input: ReadVaultNoteInput
): Promise<unknown> {
  const { repo, path } = input;
  const content = await ops.getRawProjectDoc(repo, path);
  return { repo, path, content };
}
