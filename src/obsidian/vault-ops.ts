import { ObsidianClient, ObsidianNotFoundError, SearchResult } from "./client.js";

export interface BranchNoteSummary {
  branch: string;
  status: string;
  last_modified: string;
  agent_sessions: number;
  last_agent: string;
  purpose: string;
}

export interface ActiveContext {
  active_repo: string;
  active_branch: string;
  switched_at: string;
  branch_note: string;
}

export interface HandoffParams {
  repo: string;
  branch: string;
  summary: string;
  files_changed: string[];
  blocked_on: string;
  next_session_start: string;
  agent_name: string;
  doc_impact?: { docName: string; description: string }[];
  overview?: string;
}

export interface HandoffRecord {
  agent: string;
  summary: string;
  files_changed: string[];
  blocked_on: string;
  next_session_start: string;
  ended_at: string;
}

export interface Decision {
  title: string;
  date: string;
  body: string;
}

export interface BugEntry {
  title: string;
  description: string;
  file_refs?: string[];
  severity: "low" | "medium" | "high" | "critical";
  branch: string;
}

export interface ResolutionEntry {
  bug_title: string;
  resolution: string;
  files_changed: string[];
  branch: string;
}

export interface DriftEntry {
  description: string;
  decision_ref: string;
  branch: string;
}

export interface PlanRow {
  task_name: string;
  sub_tasks?: string;
  status: string;
  priority?: string;
  timeline?: string;
  plan_link?: string;
  branch: string;
}

export interface ConfigEntry {
  variable_name: string;
  type: string;
  default_value: string;
  required: boolean;
  description: string;
  change_summary: string;
  branch: string;
}

function branchNotePath(repo: string, branch: string): string {
  const safeBranch = branch.replace(/\//g, "-");
  return `Projects/${repo}/branch-${safeBranch}.md`;
}

function branchNoteTemplate(repo: string, branch: string, description = ""): string {
  const now = new Date().toISOString();
  return `---
repo: ${repo}
branch: ${branch}
created: ${now}
status: active
merged_into: ""
merged_at: ""
agent-sessions: 0
last-agent: ""
last-session: ${now}
tags:
  - devbrain
  - project/${repo}
---

## Overview
${description || "<!-- describe the goal of this branch -->"}

## Changes Log
<!-- appended by AI agent as it codes — each entry timestamped -->

## Impact on Project Docs
<!-- logged when ARCHITECTURE/Features/Bug-tracking/Configurations are updated -->

## Progress Log
<!-- auto-updated by post-commit hook -->

## Blocked On
<!-- describe any blockers or leave blank -->

## Next Session
<!-- what should the next agent do first -->

## Merge Summary
<!-- written at merge time by the agent -->
`;
}

function activeContextContent(repo: string, branch: string): string {
  const now = new Date().toISOString();
  const safeBranch = branch.replace(/\//g, "-");
  const noteRef = `Projects/${repo}/branch-${safeBranch}`;
  return `---
active_repo: ${repo}
active_branch: ${branch}
switched_at: ${now}
branch_note: "[[${noteRef}]]"
---

> Auto-updated by devbrain on branch switch.

See [[${noteRef}]] for full context.
`;
}

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    result[key] = val;
  }
  return result;
}

function parseSection(content: string, heading: string): string {
  const re = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const m = content.match(re);
  if (!m) return "";
  return m[1].replace(/<!--[\s\S]*?-->/g, "").trim();
}

export class VaultOps {
  constructor(private client: ObsidianClient) {}

  // --- Branch notes ---

  async createBranchNote(repo: string, branch: string, description?: string): Promise<void> {
    const path = branchNotePath(repo, branch);
    try {
      await this.client.getNote(path);
      // already exists — skip
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        await this.client.putNote(path, branchNoteTemplate(repo, branch, description));
      } else {
        throw err;
      }
    }
  }

  async updateBranchNotePurpose(repo: string, branch: string, purpose: string): Promise<void> {
    const path = branchNotePath(repo, branch);
    let content: string;
    try {
      const note = await this.client.getNote(path);
      content = note.content;
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        await this.client.putNote(path, branchNoteTemplate(repo, branch, purpose));
        return;
      }
      throw err;
    }
    // Support both old "## Purpose" and new "## Overview" section names
    const updated = content.replace(
      /(## (?:Overview|Purpose)\n)([\s\S]*?)(?=\n## |\n*$)/,
      `$1${purpose}\n`
    );
    await this.client.putNote(path, updated);
  }

  async getBranchNote(repo: string, branch: string): Promise<{ content: string; frontmatter: Record<string, unknown> } | null> {
    try {
      const note = await this.client.getNote(branchNotePath(repo, branch));
      return { content: note.content, frontmatter: parseFrontmatter(note.content) };
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) return null;
      throw err;
    }
  }

  async listBranchNotes(repo: string): Promise<BranchNoteSummary[]> {
    let files: string[];
    try {
      files = await this.client.listFolder(`Projects/${repo}`);
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) return [];
      throw err;
    }

    const branchFiles = files.filter((f) => f.match(/branch-.+\.md$/));
    const results: BranchNoteSummary[] = [];

    for (const file of branchFiles) {
      try {
        const note = await this.client.getNote(`Projects/${repo}/${file}`);
        const fm = parseFrontmatter(note.content);
        const purpose = parseSection(note.content, "Purpose");
        results.push({
          branch: String(fm["branch"] ?? ""),
          status: String(fm["status"] ?? "unknown"),
          last_modified: String(fm["last-session"] ?? ""),
          agent_sessions: Number(fm["agent-sessions"] ?? 0),
          last_agent: String(fm["last-agent"] ?? ""),
          purpose: purpose.slice(0, 120),
        });
      } catch {
        // skip unreadable notes
      }
    }
    return results;
  }

  async appendToProgressLog(repo: string, branch: string, entry: string): Promise<void> {
    const path = branchNotePath(repo, branch);
    try {
      const note = await this.client.getNote(path);
      const updated = note.content.replace(
        /(## Progress Log\n(?:<!--[\s\S]*?-->\n)?)/,
        `$1${entry}\n`
      );
      await this.client.putNote(path, updated);
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        await this.client.appendNote(path, `\n${entry}`);
      } else {
        throw err;
      }
    }
  }

  // --- Active context ---

  async updateActiveContext(repo: string, branch: string): Promise<void> {
    const content = activeContextContent(repo, branch);
    await this.client.putNote("ACTIVE_CONTEXT.md", content);
    await this.client.putNote(`Projects/${repo}/ACTIVE_CONTEXT.md`, content);
  }

  async getActiveContext(repo?: string): Promise<ActiveContext | null> {
    try {
      let note;
      if (repo) {
        try {
          note = await this.client.getNote(`Projects/${repo}/ACTIVE_CONTEXT.md`);
        } catch (err) {
          if (err instanceof ObsidianNotFoundError) {
            note = await this.client.getNote("ACTIVE_CONTEXT.md");
          } else {
            throw err;
          }
        }
      } else {
        note = await this.client.getNote("ACTIVE_CONTEXT.md");
      }
      
      const fm = parseFrontmatter(note.content);
      return {
        active_repo: String(fm["active_repo"] ?? ""),
        active_branch: String(fm["active_branch"] ?? ""),
        switched_at: String(fm["switched_at"] ?? ""),
        branch_note: String(fm["branch_note"] ?? ""),
      };
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) return null;
      throw err;
    }
  }

  async getRawNote(path: string): Promise<string> {
    const note = await this.client.getNote(path);
    return note.content;
  }

  // --- Handoff ---

  async updateBranchHandoffStatus(repo: string, branch: string, blockedOn: string, nextSession: string): Promise<void> {
    const path = branchNotePath(repo, branch);
    try {
      const note = await this.client.getNote(path);
      let updated = note.content;
      
      // Replace content under ## Blocked On until the next heading or EOF
      updated = updated.replace(
        /(## Blocked On\n)([\s\S]*?)(?=\n## |\n*$)/,
        `$1${blockedOn || "<!-- describe any blockers or leave blank -->"}\n`
      );
      
      // Replace content under ## Next Session until the next heading or EOF
      updated = updated.replace(
        /(## Next Session\n)([\s\S]*?)(?=\n## |\n*$)/,
        `$1${nextSession || "<!-- what should the next agent do first -->"}\n`
      );
      
      if (updated !== note.content) {
        await this.client.putNote(path, updated);
      }
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        // Branch note missing — skip silently
      } else {
        throw err;
      }
    }
  }

  async writeHandoff(params: HandoffParams): Promise<void> {
    const { repo, branch, summary, files_changed, blocked_on, next_session_start, agent_name, doc_impact } = params;
    const now = new Date().toISOString();

    const handoffEntry = `
## Session — ${now} (${agent_name})

**Summary:** ${summary}

**Files changed:**
${files_changed.map((f) => `- ${f}`).join("\n")}

**Blocked on:** ${blocked_on}

**Next session start:** ${next_session_start}

---
`;

    const handoffPath = `Projects/${repo}/HANDOFF.md`;
    try {
      await this.client.appendNote(handoffPath, handoffEntry);
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        await this.client.putNote(handoffPath, `# Handoff Log\n${handoffEntry}`);
      } else {
        throw err;
      }
    }

    const progressEntry = `- \`session\` ${now} — ${summary} (agent: ${agent_name})`;
    try {
      await this.appendToProgressLog(repo, branch, progressEntry);
      await this.updateBranchHandoffStatus(repo, branch, blocked_on, next_session_start);
      if (params.overview) {
        await this.updateBranchNotePurpose(repo, branch, params.overview);
      }
      if (doc_impact) {
        for (const doc of doc_impact) {
          await this.logDocImpact(repo, branch, doc.docName, doc.description);
        }
      }
    } catch {
      // non-fatal: branch note may not exist yet
    }

    await this.updateActiveContext(repo, branch);
  }

  async getLastHandoff(repo: string): Promise<HandoffRecord | null> {
    try {
      const note = await this.client.getNote(`Projects/${repo}/HANDOFF.md`);
      const sections = note.content.split(/^## Session/m).filter(Boolean);
      if (!sections.length) return null;
      const last = sections[sections.length - 1];
      const dateAgentMatch = last.match(/^[— ]+(.+?) \((.+?)\)/);
      const summaryMatch = last.match(/\*\*Summary:\*\* (.+)/);
      const blockedMatch = last.match(/\*\*Blocked on:\*\* (.+)/);
      const nextMatch = last.match(/\*\*Next session start:\*\* (.+)/);
      const filesMatch = [...last.matchAll(/^- (.+)$/gm)].map((m) => m[1]);

      return {
        ended_at: dateAgentMatch?.[1]?.trim() ?? "",
        agent: dateAgentMatch?.[2]?.trim() ?? "",
        summary: summaryMatch?.[1]?.trim() ?? "",
        files_changed: filesMatch,
        blocked_on: blockedMatch?.[1]?.trim() ?? "",
        next_session_start: nextMatch?.[1]?.trim() ?? "",
      };
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) return null;
      throw err;
    }
  }

  // --- Decisions ---

  async getDecisions(repo: string, limit = 10): Promise<Decision[]> {
    try {
      const note = await this.client.getNote(`Projects/${repo}/DECISIONS.md`);
      const sections = note.content.split(/^## /m).filter(Boolean);
      return sections
        .reverse()
        .slice(0, limit)
        .map((s) => {
          const lines = s.split("\n");
          const title = lines[0].trim();
          const dateMatch = title.match(/(\d{4}-\d{2}-\d{2})/);
          return {
            title,
            date: dateMatch?.[1] ?? "",
            body: lines.slice(1).join("\n").trim(),
          };
        });
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) return [];
      throw err;
    }
  }

  async appendDecision(repo: string, decision: string): Promise<void> {
    const path = `Projects/${repo}/DECISIONS.md`;
    const date = new Date().toISOString().slice(0, 10);
    const entry = `\n## ${date} — ${decision}\n`;
    try {
      await this.client.appendNote(path, entry);
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        await this.client.putNote(path, `# Decisions\n${entry}`);
      } else {
        throw err;
      }
    }
  }

  // --- Search ---

  async searchVault(query: string, tags?: string[]): Promise<SearchResult[]> {
    const results = await this.client.searchSimple(query);
    if (!tags?.length) return results;

    const tagResults = await this.client.searchJsonLogic({
      "and": tags.map((tag) => ({ "glob": [{ "var": "tags" }, `*${tag}*`] })),
    });
    const tagFiles = new Set(tagResults.map((r) => r.filename));
    return results.filter((r) => tagFiles.has(r.filename));
  }

  async getBacklinks(notePath: string): Promise<string[]> {
    const noteName = notePath.replace(/\.md$/, "");
    const results = await this.client.searchJsonLogic({
      "glob": [{ "var": "content" }, `*[[${noteName}]]*`],
    });
    return results.map((r) => r.filename).filter((f) => f !== notePath);
  }

  // --- Branch change tracking ---

  async appendToBranchChangesLog(repo: string, branch: string, entries: string[]): Promise<void> {
    const path = branchNotePath(repo, branch);
    const now = new Date().toISOString();
    const block = `### ${now}\n${entries.map((e) => `- ${e}`).join("\n")}\n\n`;
    try {
      const note = await this.client.getNote(path);
      const updated = note.content.replace(
        /(## Changes Log\n(?:<!--[\s\S]*?-->\n)?)/,
        `$1${block}`
      );
      await this.client.putNote(path, updated);
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        await this.createBranchNote(repo, branch);
        await this.appendToBranchChangesLog(repo, branch, entries);
      } else {
        throw err;
      }
    }
  }

  async logDocImpact(repo: string, branch: string, docName: string, description: string): Promise<void> {
    const path = branchNotePath(repo, branch);
    const now = new Date().toISOString();
    const entry = `- [${now}] ${docName} — ${description}\n`;
    try {
      const note = await this.client.getNote(path);
      const updated = note.content.replace(
        /(## Impact on Project Docs\n(?:<!--[\s\S]*?-->\n)?)/,
        `$1${entry}`
      );
      await this.client.putNote(path, updated);
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        // Branch note missing — skip silently, doc impact is non-fatal
      } else {
        throw err;
      }
    }
  }

  async markBranchMerged(repo: string, branch: string, mergedInto: string, summary: string): Promise<void> {
    const path = branchNotePath(repo, branch);
    const now = new Date().toISOString();
    let content: string;
    try {
      const note = await this.client.getNote(path);
      content = note.content;
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) return;
      throw err;
    }
    // Update frontmatter fields
    content = content
      .replace(/^status: active$/m, "status: merged")
      .replace(/^merged_into: ""$/m, `merged_into: ${mergedInto}`)
      .replace(/^merged_at: ""$/m, `merged_at: ${now}`);
    // Write merge summary section
    content = content.replace(
      /(## Merge Summary\n)([\s\S]*?)(\n*$)/,
      `$1Merged into \`${mergedInto}\` on ${now}.\n\n${summary}\n`
    );
    await this.client.putNote(path, content);
  }

  // --- Project docs ---

  async writeCustomDoc(repo: string, filename: string, content: string): Promise<void> {
    // Allow path separators (/) but prevent directory traversal (..)
    if (filename.includes('..')) throw new Error("Directory traversal is not allowed");
    const safe = filename.replace(/[^a-zA-Z0-9._ \/-]/g, "-").replace(/^-+/, "");
    if (!safe) throw new Error("Invalid filename");
    await this.client.putNote(`Projects/${repo}/${safe}`, content);
  }

  async getRawProjectDoc(repo: string, filename: string): Promise<string> {
    if (filename.includes('..')) throw new Error("Directory traversal is not allowed");
    const safe = filename.replace(/[^a-zA-Z0-9._ \/-]/g, "-").replace(/^-+/, "");
    const note = await this.client.getNote(`Projects/${repo}/${safe}`);
    return note.content;
  }

  /**
   * Patch (or create) a named `## Heading` section in a project doc.
   * Leaves all other sections untouched. Appends section if not present.
   */
  async patchDocSection(repo: string, filename: string, heading: string, content: string): Promise<void> {
    if (filename.includes('..')) throw new Error("Directory traversal is not allowed");
    const safe = filename.replace(/[^a-zA-Z0-9._ \/-]/g, "-").replace(/^-+/, "");
    const notePath = `Projects/${repo}/${safe}`;
    let existing: string;
    try {
      const note = await this.client.getNote(notePath);
      existing = note.content;
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) existing = "";
      else throw err;
    }
    const sectionRe = new RegExp(`(## ${heading}\\n)([\\s\\S]*?)(?=\\n## |\\n*$)`);
    if (sectionRe.test(existing)) {
      const updated = existing.replace(sectionRe, `$1${content}\n`);
      await this.client.putNote(notePath, updated);
    } else {
      // Section doesn't exist — append it before Change History or at EOF
      const chIdx = existing.lastIndexOf("## Change History");
      const insertAt = chIdx !== -1 ? chIdx : existing.length;
      const updated = existing.slice(0, insertAt) +
        `\n## ${heading}\n${content}\n\n` +
        existing.slice(insertAt);
      await this.client.putNote(notePath, updated);
    }
  }

  /**
   * Append a row to the Change History table at the bottom of a project doc.
   * Creates the table if it doesn't exist.
   */
  async appendChangeHistoryRow(
    repo: string,
    filename: string,
    date: string,
    branch: string,
    summary: string
  ): Promise<void> {
    if (filename.includes('..')) throw new Error("Directory traversal is not allowed");
    const safe = filename.replace(/[^a-zA-Z0-9._ \/-]/g, "-").replace(/^-+/, "");
    const notePath = `Projects/${repo}/${safe}`;
    const row = `| ${date} | [[${branch}]] | ${summary} |`;
    try {
      const note = await this.client.getNote(notePath);
      const content = note.content;
      // Find the last table row and append after it
      const tableRowRe = /(\|.+\|\n?)(?!\|)/g;
      let lastMatch: RegExpExecArray | null = null;
      let m: RegExpExecArray | null;
      while ((m = tableRowRe.exec(content)) !== null) lastMatch = m;
      if (lastMatch) {
        const pos = lastMatch.index + lastMatch[0].length;
        const updated = content.slice(0, pos) + row + "\n" + content.slice(pos);
        await this.client.putNote(notePath, updated);
      } else {
        // No table exists — append one
        const table = `\n## Change History\n| Date | Branch | Change |\n|------|--------|--------|\n${row}\n`;
        await this.client.putNote(notePath, content + table);
      }
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        const table = `# ${safe}\n\n## Change History\n| Date | Branch | Change |\n|------|--------|--------|\n${row}\n`;
        await this.client.putNote(notePath, table);
      } else {
        throw err;
      }
    }
  }

  // --- Bug-tracking.md structured methods ---

  private bugTrackingPath(repo: string): string {
    return `Projects/${repo}/Bug-tracking.md`;
  }

  async appendBug(repo: string, bug: BugEntry): Promise<void> {
    const path = this.bugTrackingPath(repo);
    const date = new Date().toISOString().slice(0, 10);
    const fileList = bug.file_refs?.length
      ? `\n**Files:** ${bug.file_refs.map((f) => `\`${f}\``).join(", ")}`
      : "";
    const entry = `\n### ${bug.title}\n**Severity:** ${bug.severity}  |  **Branch:** [[${bug.branch}]]  |  **Date:** ${date}${fileList}\n\n${bug.description}\n`;
    try {
      const note = await this.client.getNote(path);
      const updated = note.content.replace(
        /(## Active Known Issues\n)/,
        `$1${entry}`
      );
      await this.client.putNote(path, updated);
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        const init = `# Bug Tracking\n\n## Active Known Issues\n${entry}\n## Architectural Drift\n\n## Resolved Bugs\n\n## Change History\n| Date | Branch | Bug Fixed |\n|------|--------|-----------|\n`;
        await this.client.putNote(path, init);
      } else {
        throw err;
      }
    }
  }

  async resolveBug(repo: string, res: ResolutionEntry): Promise<void> {
    const path = this.bugTrackingPath(repo);
    const date = new Date().toISOString().slice(0, 10);
    let content: string;
    try {
      const note = await this.client.getNote(path);
      content = note.content;
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) return;
      throw err;
    }
    // Remove the bug from Active Known Issues
    const bugRe = new RegExp(`### ${res.bug_title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?(?=\\n### |\\n## |$)`);
    content = content.replace(bugRe, "");
    // Append to Resolved
    const fileList = res.files_changed.map((f) => `- \`${f}\``).join("\n");
    const resolvedEntry = `\n### ~~${res.bug_title}~~\n**Resolved:** ${date}  |  **Branch:** [[${res.branch}]]\n\n${res.resolution}\n\n${fileList}\n`;
    content = content.replace(
      /(## Resolved Bugs\n)/,
      `$1${resolvedEntry}`
    );
    await this.client.putNote(path, content);
  }

  async appendDrift(repo: string, drift: DriftEntry): Promise<void> {
    const path = this.bugTrackingPath(repo);
    const date = new Date().toISOString().slice(0, 10);
    const entry = `\n### ${date} — Drift from [[${drift.decision_ref}]]\n**Branch:** [[${drift.branch}]]\n\n${drift.description}\n`;
    try {
      const note = await this.client.getNote(path);
      const updated = note.content.replace(
        /(## Architectural Drift\n)/,
        `$1${entry}`
      );
      await this.client.putNote(path, updated);
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        const init = `# Bug Tracking\n\n## Active Known Issues\n\n## Architectural Drift\n${entry}\n## Resolved Bugs\n\n## Change History\n| Date | Branch | Bug Fixed |\n|------|--------|-----------|\n`;
        await this.client.putNote(path, init);
      } else {
        throw err;
      }
    }
  }

  // --- PLAN.md structured methods ---

  private planPath(repo: string): string {
    return `Projects/${repo}/PLAN.md`;
  }

  async appendPlanRow(repo: string, row: PlanRow): Promise<void> {
    const path = this.planPath(repo);
    const link = row.plan_link ? `[[${row.plan_link}]]` : "";
    const tableRow = `| | ${row.task_name} | ${row.sub_tasks ?? ""} | ${row.status} | ${row.priority ?? "Medium"} | ${row.timeline ?? ""} | ${link} |`;
    try {
      const note = await this.client.getNote(path);
      await this.client.putNote(path, note.content.trimEnd() + "\n" + tableRow + "\n");
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        const init = `# Project Plan & Roadmap\n\n| S.No | Task | Sub-tasks | Status | Priority | Timeline | Link to Detailed Implementation |\n|------|------|-----------|--------|----------|----------|---------------------------------|\n${tableRow}\n`;
        await this.client.putNote(path, init);
      } else {
        throw err;
      }
    }
  }

  async updatePlanRowStatus(repo: string, taskName: string, newStatus: string, strikeThrough = false): Promise<void> {
    const path = this.planPath(repo);
    const note = await this.client.getNote(path);
    const escapedName = taskName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const displayName = strikeThrough ? `~~${taskName}~~` : taskName;
    // Match table row containing task name and replace Status column (4th pipe-delimited cell)
    const rowRe = new RegExp(`(\\|[^|]*\\|[^|]*${escapedName}[^|]*\\|[^|]*\\|)([^|]*)(\\|.*)`);
    const updated = note.content.replace(rowRe, (_, pre, _old, post) => {
      const withStatus = `${pre} ${newStatus} ${post}`;
      if (strikeThrough) {
        return withStatus.replace(taskName, displayName);
      }
      return withStatus;
    });
    await this.client.putNote(path, updated);
  }

  // --- Configurations.md structured methods ---

  async upsertConfigRow(repo: string, entry: ConfigEntry): Promise<void> {
    const path = `Projects/${repo}/Configurations.md`;
    const date = new Date().toISOString().slice(0, 10);
    const required = entry.required ? "Yes" : "No";
    const tableRow = `| \`${entry.variable_name}\` | ${entry.type} | ${entry.default_value} | ${required} | ${entry.description} |`;
    try {
      const note = await this.client.getNote(path);
      let content = note.content;
      // Try to find and update existing row
      const existingRowRe = new RegExp(`\\|[^|]*\\\`${entry.variable_name}\\\`[^|]*\\|.*`);
      if (existingRowRe.test(content)) {
        content = content.replace(existingRowRe, tableRow);
      } else {
        // Append after the last env var table row
        const envSection = content.indexOf("## Environment Variables");
        const nextSection = content.indexOf("\n## ", envSection + 1);
        const insertAt = nextSection !== -1 ? nextSection : content.length;
        const varTable = content.slice(envSection, insertAt);
        const lastRow = varTable.lastIndexOf("\n|");
        const absInsert = envSection + lastRow + 1;
        content = content.slice(0, absInsert) + tableRow + "\n" + content.slice(absInsert);
      }
      // Append Change History row
      const chRow = `| ${date} | [[${entry.branch}]] | ${entry.change_summary} |`;
      const chRe = /(## Change History\n(?:\|.+\n)*)(?=\n|$)/;
      if (chRe.test(content)) {
        content = content.replace(chRe, (m) => m.trimEnd() + "\n" + chRow + "\n");
      }
      await this.client.putNote(path, content);
    } catch (err) {
      if (err instanceof ObsidianNotFoundError) {
        const init = `# Configurations\n\n## Environment Variables\n| Variable Name | Type | Default | Required? | Description |\n|---|---|---|---|---|\n${tableRow}\n\n## Static Configs\n\n## Change History\n| Date | Branch | Configuration Added/Changed |\n|------|--------|------------------------------|\n| ${date} | [[${entry.branch}]] | ${entry.change_summary} |\n`;
        await this.client.putNote(path, init);
      } else {
        throw err;
      }
    }
  }
}

