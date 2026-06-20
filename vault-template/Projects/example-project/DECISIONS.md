# Decisions

## 2026-01-01 — Use Obsidian Local REST API instead of direct fs reads
All vault I/O goes through the Obsidian Local REST API. Never use fs.readFile on vault files directly — that bypasses the graph, backlinks, Dataview, and Omnisearch.
