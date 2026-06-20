import { VaultOps } from "../../obsidian/vault-ops.js";

export interface WriteCustomDocInput {
  repo: string;
  filename: string;
  content: string;
}

export async function writeCustomDoc(
  ops: VaultOps,
  input: WriteCustomDocInput
): Promise<unknown> {
  const { repo, filename, content } = input;
  await ops.writeCustomDoc(repo, filename, content);
  return { repo, filename, written: true };
}
