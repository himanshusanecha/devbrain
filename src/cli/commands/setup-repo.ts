import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

export async function setupRepoCommand(repoPathStr: string) {
  let repoPath: string;
  try {
    repoPath = path.resolve(repoPathStr || ".");
  } catch (e: any) {
    if (e.code === 'ENOENT' && e.syscall === 'uv_cwd') {
      console.error(`❌ The current working directory no longer exists. Please cd into a valid directory.`);
      process.exit(1);
    }
    throw e;
  }

  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    console.error(`❌ Not a git repo: ${repoPath}`);
    process.exit(1);
  }

  let vaultPath = process.env.DEVBRAIN_VAULT_PATH;
  if (!vaultPath) {
    const envFile = path.join(os.homedir(), '.devbrain.env');
    if (fs.existsSync(envFile)) {
      const content = fs.readFileSync(envFile, 'utf8');
      const match = content.match(/DEVBRAIN_VAULT_PATH="?([^"\n]+)"?/);
      if (match) vaultPath = match[1];
    }
  }

  if (!vaultPath) {
    console.error("❌ DEVBRAIN_VAULT_PATH is not set. Run: devbrain init");
    process.exit(1);
  }

  let repoName = path.basename(repoPath);
  try {
    repoName = path.basename(execSync('git rev-parse --show-toplevel', { cwd: repoPath }).toString().trim());
  } catch { }

  let hooksDir = path.join(repoPath, '.git', 'hooks');
  try {
    const gitPath = execSync('git rev-parse --git-path hooks', { cwd: repoPath }).toString().trim();
    hooksDir = path.resolve(repoPath, gitPath);
  } catch { }

  const vaultDir = path.join(vaultPath.replace(/^~/, os.homedir()), 'Projects', repoName);

  console.log(`Setting up DevBrain for: ${repoName}`);

  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  for (const hook of ['post-checkout', 'post-commit', 'post-merge']) {
    const dst = path.join(hooksDir, hook);

    let exists = false;
    try {
      fs.lstatSync(dst);
      exists = true;
    } catch { }

    if (exists) {
      try {
        const existing = fs.readFileSync(dst, 'utf8');
        if (!existing.includes('devbrain hook')) {
          console.log(`⚠️  Existing ${hook} hook found — backing up to ${hook}.pre-devbrain`);
          fs.renameSync(dst, `${dst}.pre-devbrain`);
        } else {
          continue; // Already installed
        }
      } catch (e) {
        // If readFileSync fails (e.g. dangling symlink), back it up anyway
        console.log(`⚠️  Dangling ${hook} symlink found — backing up to ${hook}.pre-devbrain`);
        fs.renameSync(dst, `${dst}.pre-devbrain`);
      }
    }

    const script = `#!/bin/sh\ndevbrain hook ${hook} "$@"\n`;
    fs.writeFileSync(dst, script, { mode: 0o755 });
    console.log(`✅ Installed ${hook} hook`);
  }

  if (!fs.existsSync(vaultDir)) {
    fs.mkdirSync(vaultDir, { recursive: true });

    fs.writeFileSync(path.join(vaultDir, 'DECISIONS.md'), `# Architecture & Decisions\n\n## YYYY-MM-DD — Initial Setup\nInitialized DevBrain context for this repo.\n`);
    fs.writeFileSync(path.join(vaultDir, 'HANDOFF.md'), `# Handoff Log\n`);
    console.log(`✅ Created vault folder: ${vaultDir}`);
  } else {
    console.log(`✅ Vault folder already exists: ${vaultDir}`);
  }

  let currentBranch = "";
  try {
    currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoPath }).toString().trim();
  } catch { }

  if (currentBranch) {
    const now = new Date().toISOString();
    const safeBranch = currentBranch.replace(/[/\\\\:]/g, "-");
    const branchNoteName = `branch-${safeBranch}.md`;
    const branchNotePath = path.join(vaultDir, branchNoteName);

    if (!fs.existsSync(branchNotePath)) {
      const branchNoteContent = `---
repo: ${repoName}
branch: ${currentBranch}
created: ${now}
status: active
merged_into: ""
merged_at: ""
agent-sessions: 0
last-agent: ""
last-session: ${now}
tags:
  - devbrain
  - project/${repoName}
---

## Overview
<!-- describe the goal of this branch -->

## Changes Log
<!-- appended by AI agent as it codes — each entry timestamped -->

## Impact on Project Docs
<!-- Remove the comment tags and log what you updated:
- Updated [[ARCHITECTURE.md]]
- Updated [[PLAN.md]]
- Updated [[Features.md]]
- Updated [[Bug-tracking.md]]
- Updated [[Configurations.md]]
-->

## Progress Log
<!-- auto-updated by post-commit hook -->

## Blocked On
<!-- describe any blockers or leave blank -->

## Next Session
<!-- what should the next agent do first -->

## Merge Summary
<!-- written at merge time by the agent -->
`;
      fs.writeFileSync(branchNotePath, branchNoteContent);
      console.log(`✅ Created branch note: ${branchNoteName}`);
    }

    const noteRef = `Projects/${repoName}/branch-${safeBranch}`;
    const activeContextContent = `---
active_repo: ${repoName}
active_branch: ${currentBranch}
switched_at: ${now}
branch_note: "[[${noteRef}]]"
---

> Auto-updated by devbrain on branch switch.
`;

    // Local Active Context
    fs.writeFileSync(path.join(vaultDir, 'ACTIVE_CONTEXT.md'), activeContextContent);

    // Global Active Context
    fs.writeFileSync(path.join(vaultPath.replace(/^~/, os.homedir()), 'ACTIVE_CONTEXT.md'), activeContextContent);

    console.log(`✅ Initialized ACTIVE_CONTEXT.md for branch: ${currentBranch}`);
  }

  const mcpJsonPath = path.join(repoPath, '.mcp.json');
  if (!fs.existsSync(mcpJsonPath)) {
    const mcpConfig = {
      mcpServers: {
        "devbrain": {
          command: "devbrain",
          args: ["mcp"]
        }
      }
    };
    fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + "\n");
    console.log(`✅ Generated .mcp.json for Claude Code (safe to commit)`);
  } else {
    console.log(`✅ .mcp.json already exists`);
  }

  console.log("\n🧠 DevBrain is set up for " + repoName);
  console.log("Make sure Obsidian is running with the Local REST API plugin enabled.");
  console.log("Switching to any branch will auto-update its context note.\n");

  console.log("=========================================================================");
  console.log("INITIALIZATION PROMPT");
  console.log("Copy and paste the following prompt into your AI agent to build");
  console.log("the initial project documentation in your Obsidian vault:");
  console.log("=========================================================================\n");
  
  console.log(`You are initializing DevBrain context for this repo for the first time. Do the following in order:

> **CRITICAL OBSIDIAN RULE:** Whenever you reference a project document, branch, or feature, you MUST wrap it in Obsidian wikilinks (e.g., \`[[ARCHITECTURE.md]]\`, \`[[branch-feature-login]]\`). For Change History tables, the Branch column MUST use \`[[branch-name]]\` syntax.
> **SOURCE CODE RULE:** Whenever you reference a source code file (e.g., \`src/auth/login.ts\`), strictly use inline code backticks. Do NOT use markdown links or wikilinks for source code.

1. Read the codebase exhaustively to understand this project:
   - README.md (if it exists)
   - package.json, pyproject.toml, go.mod, or equivalent manifest
   - Top-level directory structure
   - Config files that reveal the stack (tsconfig.json, .env.example, docker-compose.yml, etc.)
   - Do not stop reading after 2 files. You must trace the execution path of the primary application flow.
   - Read all major configuration files, routing definitions, database schemas, and core utilities.
   - Be completely exhaustive. Do not limit the length of your analysis. Include every relevant detail you discover.

2. Identify the default branch by running:
   git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's|refs/remotes/origin/||'
   If that returns nothing, check which of these exists: main, master, release.
   Use whichever you find as the target branch.

3. Get the repo name:
   basename "$(git rev-parse --show-toplevel)"

4. Before writing any files, verify the write_custom_doc and write_architecture_doc MCP tools are available in your
   session. If they are not available, stop immediately and tell the user:
   "vault-bridge MCP server is not connected. Please configure it and restart the session."
   Do not write any files to the repo filesystem under any circumstances.

   If tools are available, call them as many times as necessary to create the following structure. Use \`write_architecture_doc\` for Architecture docs, \`write_feature_doc\` for features, etc.

   Folder 1 — "Architecture/"
   Create multiple Markdown files inside this folder to document the system design granularly. For example:
   - \`Architecture/System-Overview.md\`: Exhaustive description of the system design, core purpose, design patterns, and directory structure.
   - \`Architecture/Core-Components.md\`: Deep dive into critical classes, modules, and services.
   - \`Architecture/Data-Flow.md\`: Comprehensive ASCII diagrams showing data movement and state lifecycles.
   - \`Architecture/External-Integrations.md\`: List of all APIs, databases, or services.
   Every file in this folder must have a Change History table at the bottom:
   | Date | Branch | Change |
   |------|--------|--------|

   Folder 2 — "Features/"
   Create multiple Markdown files inside this folder, one for each major feature or workflow.
   For each feature file (e.g., \`Features/Authentication.md\`), provide:
   1. User Goal
   2. Step-by-Step Flow
   3. Edge Cases & Error Handling
   Every file in this folder must have a Change History table at the bottom:
   | Date | Branch | Feature Added/Changed |
   |------|--------|-----------------------|

   File 3 — filename: "Bug-tracking.md"
   Content:
   # Bug Tracking
   ## Active Known Issues
   (If you discovered any TODOs, FIXMEs, architectural debt, or obvious unhandled errors in your exhaustive reading, list them here in full detail. Otherwise state "No known issues".)
   ## Architectural Drift
   (If you discovered merged code that contradicts [[DECISIONS.md]] or [[ARCHITECTURE.md]], log the violation here for future review.)
   ## Resolved Bugs
   (Empty on init)
   ## Change History
   | Date | Branch | Bug Fixed |
   |------|--------|-----------|

   File 4 — filename: "Configurations.md"
   Content:
   # Configurations
   ## Environment Variables
   (Exhaustive Markdown table containing: Variable Name | Type | Default | Required? | Description)
   ## Static Configs
   (Complete breakdown of tsconfig, package.json scripts, infrastructure configs, or feature flags)
   ## Change History
   | Date | Branch | Configuration Added/Changed |
   |------|--------|-----------------------------|

   Each file must be specific and accurate — use real file paths, real variable names, and real service names from the codebase. No placeholder content.

   File 5 — filename: "PLAN.md"
   Content:
   # Project Plan & Roadmap
   When mapping out the project plan, if a task is complex, create a detailed markdown file for it in the \`Plans/\` directory and link to it in the 'Link to Detailed Implementation' column.
   | S.No | Task | Sub-tasks | Status | Priority | Timeline | Link to Detailed Implementation |
   |------|------|-----------|--------|----------|----------|---------------------------------|

   File 6 — filename: "Index.md"
   Content:
   # Project Hub
   Welcome to the central Map of Content (MOC) for this project.
   
   ## Core Documentation
   - [[Architecture/System-Overview.md]] (and other architecture files)
   - [[Features/Core-Workflows.md]] (and other feature files)
   - [[Configurations.md]]
   
   ## Project Management
   - [[PLAN.md]]
   - [[Bug-tracking.md]]
   - [[DECISIONS.md]]

Do not ask for confirmation. Just read, generate, and write all files.
`);
}
