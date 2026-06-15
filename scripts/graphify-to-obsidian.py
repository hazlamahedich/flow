#!/usr/bin/env python3
"""
graphify-to-obsidian.py
Convert graphify-out/graph.json into an Obsidian vault.

Scope (configurable below):
  - concepts/   one note per concept node (high-signal)
  - files/      one note per source_file (aggregated symbols + edges)
  - communities/ one MOC per community cluster

Usage:
  python3 scripts/graphify-to-obsidian.py [--graph graphify-out/graph.json]
                                          [--out graphify-out/obsidian-vault]
                                          [--include code,document,rationale,concept]
                                          [--max-file-notes 5000]

Re-run any time after `graphify update` to refresh the vault.
"""
from __future__ import annotations
import argparse
import json
import os
import re
import shutil
import sys
import time
from collections import defaultdict
from pathlib import Path

SAFE = re.compile(r"[^A-Za-z0-9._\- ]+")


def slug(label: str) -> str:
    """Obsidian-safe filename. Preserves path structure via visible separator
    so apps/web/foo.ts != packages/foo.ts. Strips trailing .md to avoid .md.md."""
    s = str(label)
    s = re.sub(r"\.md$", "", s, flags=re.IGNORECASE)
    s = s.replace("/", " · ").replace("\\", " · ")
    s = SAFE.sub(" ", s).strip()
    s = re.sub(r"\s+", " ", s)
    return s[:180] or "untitled"


def clean_appledouble(base: Path) -> int:
    """Remove macOS ._ AppleDouble files (proliferate on exFAT/network drives).
    Returns count removed."""
    n = 0
    for p in base.rglob("._*"):
        try:
            p.unlink()
            n += 1
        except OSError:
            pass
    return n


def note_path(base: Path, folder: str, slug_name: str) -> Path:
    p = base / folder / f"{slug_name}.md"
    return p


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--graph", default="graphify-out/graph.json")
    ap.add_argument("--out", default="graphify-out/obsidian-vault")
    ap.add_argument("--include", default="code,document,rationale,concept",
                    help="comma list of node file_type values to keep for file notes")
    ap.add_argument("--max-file-notes", type=int, default=5000,
                    help="cap number of file notes (largest files first by node count)")
    ap.add_argument("--force", action="store_true",
                    help="run even if graph.json is older than the vault")
    args = ap.parse_args()

    graph_path = Path(args.graph)
    out = Path(args.out)
    if not graph_path.exists():
        print(f"graph not found: {graph_path}", file=sys.stderr)
        return 1

    # Skip if vault is already up-to-date with graph.json (unless --force).
    index_md = out / "INDEX.md"
    if not args.force and index_md.exists():
        try:
            if graph_path.stat().st_mtime <= index_md.stat().st_mtime:
                print(f"vault already current with {graph_path.name} (use --force to rebuild)",
                      file=sys.stderr)
                return 0
        except OSError:
            pass

    # Lockfile: prevent concurrent runs (e.g. rapid commits firing the hook).
    lock = out / ".refresh.lock"
    out.mkdir(parents=True, exist_ok=True)
    if lock.exists():
        try:
            age = time.time() - lock.stat().st_mtime
            if age < 600:  # <10min: assume another run is active
                pid = lock.read_text().strip() or "?"
                print(f"refresh already running (pid {pid}, {int(age)}s ago) — skipping",
                      file=sys.stderr)
                return 0
        except OSError:
            pass
    try:
        lock.write_text(str(os.getpid()))
    except OSError:
        pass

    print(f"loading {graph_path} ...", flush=True)
    g = json.loads(graph_path.read_text())
    nodes = g.get("nodes", [])
    links = g.get("links", [])
    print(f"  {len(nodes):,} nodes, {len(links):,} links", flush=True)

    include_types = {t.strip() for t in args.include.split(",")}

    # ---- index nodes ----
    nodes_by_id: dict[str, dict] = {}
    concept_nodes: list[dict] = []
    file_to_nodes: dict[str, list[dict]] = defaultdict(list)
    community_to_nodes: dict[int, list[dict]] = defaultdict(list)

    for n in nodes:
        nid = n.get("id")
        if not nid:
            continue
        nodes_by_id[nid] = n
        ft = n.get("file_type")
        if ft == "concept":
            concept_nodes.append(n)
        if ft in include_types:
            sf = n.get("source_file") or n.get("label") or "(unknown)"
            file_to_nodes[sf].append(n)
        comm = n.get("community")
        if comm is not None:
            try:
                community_to_nodes[int(comm)].append(n)
            except (TypeError, ValueError):
                pass

    print(f"  concepts: {len(concept_nodes)}", flush=True)
    print(f"  unique source files (in-scope): {len(file_to_nodes)}", flush=True)
    print(f"  communities: {len(community_to_nodes)}", flush=True)

    # ---- cap file notes: keep largest by node count ----
    file_items = sorted(file_to_nodes.items(), key=lambda kv: -len(kv[1]))
    if len(file_items) > args.max_file_notes:
        print(f"  capping file notes to {args.max_file_notes} (was {len(file_items)})",
              flush=True)
        file_items = file_items[: args.max_file_notes]
    file_set = {sf for sf, _ in file_items}

    # ---- resolve a note target per node ----
    # concept -> concept note; else -> its file note (if in file_set); else None
    def note_target(n: dict) -> str | None:
        ft = n.get("file_type")
        if ft == "concept":
            return slug(n.get("label") or n.get("id"))
        sf = n.get("source_file")
        if sf and sf in file_set:
            return slug(sf)
        return None

    node_to_note: dict[str, str] = {}
    for n in nodes:
        tgt = note_target(n)
        if tgt:
            node_to_note[n["id"]] = tgt

    # ---- aggregate edges between notes (deduped) ----
    # forward adjacency + reverse for backlinks (Obsidian computes backlinks itself,
    # but we also surface a count and top neighbors inline)
    adj: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    edge_meta: dict[tuple[str, str], set[str]] = defaultdict(set)
    for e in links:
        s = e.get("source")
        t = e.get("target")
        if not s or not t:
            continue
        sn = node_to_note.get(s)
        tn = node_to_note.get(t)
        if not sn or not tn or sn == tn:
            continue
        rel = e.get("relation") or "related"
        adj[sn][tn].add(rel)
        edge_meta[(sn, tn)].add(rel)

    # ---- write vault ----
    # Wipe content subdirs for idempotent re-runs (preserve .obsidian/ user config).
    for folder in ("concepts", "files", "communities"):
        sub = out / folder
        if sub.exists():
            shutil.rmtree(sub)
        sub.mkdir(parents=True, exist_ok=True)

    written = 0

    def write_note(folder: str, name: str, body: str) -> None:
        nonlocal written
        p = note_path(out, folder, name)
        # avoid collision overwrites silently dropping context — prefix folder
        p.write_text(body, encoding="utf-8")
        written += 1

    # --- concept notes ---
    for n in concept_nodes:
        name = slug(n.get("label") or n.get("id"))
        nid = n["id"]
        outs = adj.get(name, {})
        lines = [
            f"# {n.get('label', name)}",
            "",
            f"- **type**: concept",
            f"- **graph id**: `{nid}`",
            f"- **source**: `{n.get('source_file','')}`  `{n.get('source_location','')}`",
            f"- **community**: {n.get('community')}",
            "",
        ]
        if outs:
            lines.append("## Links")
            lines.append("")
            # sort neighbors by number of relation types, then alpha
            for tgt in sorted(outs, key=lambda x: (-len(outs[x]), x))[:60]:
                rels = ", ".join(sorted(outs[tgt]))
                lines.append(f"- [[{tgt}]] — {rels}")
            lines.append("")
        write_note("concepts", name, "\n".join(lines))

    # --- file notes ---
    for sf, fnodes in file_items:
        name = slug(sf)
        # tally file_types, communities, sample labels
        ft_count: dict[str, int] = defaultdict(int)
        comm_count: dict[int, int] = defaultdict(int)
        for n in fnodes:
            ft_count[n.get("file_type", "?")] += 1
            c = n.get("community")
            if c is not None:
                try:
                    comm_count[int(c)] += 1
                except (TypeError, ValueError):
                    pass
        lines = [
            f"# `{sf}`",
            "",
            f"- **nodes**: {len(fnodes)}",
            f"- **file types**: {dict(ft_count)}",
            f"- **top communities**: {sorted(comm_count.items(), key=lambda x:-x[1])[:5]}",
            "",
        ]
        # outgoing links to other notes
        outs = adj.get(name, {})
        if outs:
            lines.append("## References")
            lines.append("")
            for tgt in sorted(outs, key=lambda x: (-len(outs[x]), x))[:80]:
                rels = ", ".join(sorted(outs[tgt]))
                lines.append(f"- [[{tgt}]] — {rels}")
            lines.append("")
        # sample of symbols in this file
        lines.append("## Symbols (sample)")
        lines.append("")
        for n in fnodes[:40]:
            lbl = n.get("label", n.get("id"))
            lines.append(f"- `{n.get('source_location','')}` {lbl}")
        if len(fnodes) > 40:
            lines.append(f"- _…and {len(fnodes)-40} more_")
        lines.append("")
        write_note("files", name, "\n".join(lines))

    # --- community MOCs ---
    for comm, members in sorted(community_to_nodes.items()):
        name = f"community-{comm:05d}"
        ft_count: dict[str, int] = defaultdict(int)
        for n in members:
            ft_count[n.get("file_type", "?")] += 1
        # member file targets
        member_notes: dict[str, int] = defaultdict(int)
        for n in members:
            tgt = node_to_note.get(n.get("id"))
            if tgt:
                member_notes[tgt] += 1
        lines = [
            f"# Community {comm}",
            "",
            f"- **size**: {len(members)}",
            f"- **file types**: {dict(ft_count)}",
            "",
            "## Members",
            "",
        ]
        for tgt in sorted(member_notes, key=lambda x: -member_notes[x])[:100]:
            lines.append(f"- [[{tgt}]] ×{member_notes[tgt]}")
        if len(member_notes) > 100:
            lines.append(f"- _…and {len(member_notes)-100} more_")
        lines.append("")
        write_note("communities", name, "\n".join(lines))

    # --- INDEX / MOC ---
    index_lines = [
        "# Flow OS — Knowledge Graph",
        "",
        f"Generated from `{graph_path}`.",
        f"Run `python3 scripts/graphify-to-obsidian.py` after `graphify update` to refresh.",
        "",
        "## Entry points",
        "",
        f"- [[concepts/]] — {len(concept_nodes)} high-signal concept notes",
        f"- [[files/]] — {len(file_items)} source-file notes (capped at {args.max_file_notes})",
        f"- [[communities/]] — {len(community_to_nodes)} community MOCs",
        "",
        "## Largest communities",
        "",
    ]
    big = sorted(community_to_nodes.items(), key=lambda kv: -len(kv[1]))[:20]
    for comm, members in big:
        index_lines.append(f"- [[community-{comm:05d}]] — {len(members)} nodes")
    index_lines.append("")
    (out / "INDEX.md").write_text("\n".join(index_lines), encoding="utf-8")
    written += 1

    # --- minimal .obsidian config for nicer first-open ---
    obs = out / ".obsidian"
    obs.mkdir(exist_ok=True)
    (obs / "app.json").write_text(json.dumps({
        "alwaysUpdateLinks": True,
        "newFileFolderPath": "concepts",
        "attachmentFolderPath": "attachments",
        "useMarkdownLinks": False,
    }), encoding="utf-8")
    (obs / "core-plugins.json").write_text(json.dumps([
        "graph", "backlink", "outgoing-link", "tag-pane",
        "command-palette", "switcher", "page-preview", "search"
    ]), encoding="utf-8")

    # --- .gitignore so vault isn't tracked ---
    (out / ".gitignore").write_text(
        "# Obsidian vault — regenerated from graphify-out/graph.json\n"
        "*\n!.gitignore\n", encoding="utf-8")

    # --- strip macOS AppleDouble companions (exFAT/SMB drives create ._foo for foo) ---
    ab = clean_appledouble(out)
    if ab:
        print(f"  removed {ab:,} AppleDouble (._*) files", flush=True)

    # Release lock.
    try:
        lock.unlink()
    except OSError:
        pass

    print(f"\ndone: {written:,} notes written to {out}/", flush=True)
    print(f"open in Obsidian: File > Open vault > {out.resolve()}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())