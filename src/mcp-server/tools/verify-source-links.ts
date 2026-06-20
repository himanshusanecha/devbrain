import fs from "fs";
import path from "path";
import { VaultOps } from "../../obsidian/vault-ops.js";
import { ObsidianNotFoundError } from "../../obsidian/client.js";

export interface VerifySourceLinksInput {
  repo: string;
  docs?: string[];
}

export async function verifySourceLinks(
  ops: VaultOps,
  input: VerifySourceLinksInput
): Promise<unknown> {
  const { repo } = input;
  const docsToCheck = input.docs || ["ARCHITECTURE.md", "Features.md", "PLAN.md"];
  const brokenLinks: string[] = [];

  for (const docName of docsToCheck) {
    let content: string;
    try {
      content = await ops.getRawNote(`Projects/${repo}/${docName}`);
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        continue; // skip missing docs
      }
      throw err;
    }

    // Extract all strings wrapped in backticks
    const backtickRegex = /`([^`]+)`/g;
    let match;
    while ((match = backtickRegex.exec(content)) !== null) {
      const extractedPath = match[1];
      
      // Filter heuristic: does it look like a file path?
      // Simple heuristic: contains a slash or ends with common code extensions
      if (extractedPath.includes("/") || /\.(ts|js|jsx|tsx|py|go|md|rs|c|cpp|h|json|yml|yaml|sh)$/i.test(extractedPath)) {
        
        // We assume the MCP server is running in the repo root
        // (devbrain handles this in CWD)
        const absolutePath = path.resolve(process.cwd(), extractedPath);
        
        if (!fs.existsSync(absolutePath)) {
          brokenLinks.push(`${docName}: Reference to '${extractedPath}' is broken (File not found)`);
        }
      }
    }
  }

  if (brokenLinks.length === 0) {
    return { status: "success", message: "All source code references are valid." };
  }

  return { 
    status: "broken_links_found", 
    message: "Found broken source code references in the wiki.",
    broken_links: brokenLinks 
  };
}
