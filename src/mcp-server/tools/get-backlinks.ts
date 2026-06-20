import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianConnectionError } from "../../obsidian/client.js";

export interface GetBacklinksInput {
  note_path: string;
}

export async function getBacklinks(ops: VaultOps, input: GetBacklinksInput): Promise<unknown> {
  try {
    const backlinks = await ops.getBacklinks(input.note_path);
    return { note_path: input.note_path, backlinks };
  } catch (err) {
    if (err instanceof ObsidianConnectionError) {
      return { error: "obsidian_unavailable", message: "Obsidian is not running. Start Obsidian and try again." };
    }
    throw err;
  }
}
