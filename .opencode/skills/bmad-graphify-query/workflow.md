# Graphify Query Workflow

**Goal:** Provide BMAD-aware graph queries against the project knowledge graph.

**Your Role:** Graph query engine that enriches BMAD workflows with cross-artifact context.

## Principles

- **Never block.** If `graphify-out/graph.json` does not exist, print a one-liner and exit.
- **Graceful degradation.** If a query returns no results, say so — do not hallucinate edges.
- **BMAD-aware.** Understand PRD requirement IDs (FR1-FR45), story IDs (1-1, 2-3), epic IDs, and how they map to graph nodes.

## Activation

Determine the query mode from the user's request:

| Mode | Trigger Pattern | Description |
|------|----------------|-------------|
| `query` | `/graphify-query <question>` or general question | BFS traversal for broad context |
| `path` | `/graphify-path "A" "B"` | Shortest path traceability between two concepts |
| `explain` | `/graphify-explain "concept"` | Explain a node and all its connections |
| `coverage` | `/graphify-coverage` | Find PRD requirements with no story or code edges (gap analysis) |
| `impact` | `/graphify-impact <story-id>` | What code/artifacts does this story touch? |
| `drift` | `/graphify-drift` | Find code nodes with no PRD backing (drift detection) |

## Pre-Flight Check

Before any query, verify the graph exists:

```bash
if [ ! -f graphify-out/graph.json ]; then
  echo "No graphify graph found at graphify-out/graph.json. Skip graph context."
  exit 0
fi
```

If the graph does not exist, output: "Graph not found. Skipping graph context. Run graphify to build one if needed." and **stop**. Do not block the calling workflow.

## Query Execution

### Mode: query (BFS traversal)

Run `/graphify query "<question>"` using the graphify skill's query protocol:

```bash
$(cat graphify-out/.graphify_python) -c "
import json, sys
import networkx as nx
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text())
G = json_graph.node_link_graph(data, edges='links')

question = 'QUESTION'
terms = [t.lower() for t in question.split() if len(t) > 3]

scored = []
for nid, ndata in G.nodes(data=True):
    label = ndata.get('label', '').lower()
    score = sum(1 for t in terms if t in label)
    if score > 0:
        scored.append((score, nid))
scored.sort(reverse=True)
start_nodes = [nid for _, nid in scored[:3]]

if not start_nodes:
    print('No matching nodes found for query terms:', terms)
    sys.exit(0)

subgraph_nodes = set(start_nodes)
subgraph_edges = []
frontier = set(start_nodes)
for _ in range(3):
    next_frontier = set()
    for n in frontier:
        for neighbor in G.neighbors(n):
            if neighbor not in subgraph_nodes:
                next_frontier.add(neighbor)
                subgraph_edges.append((n, neighbor))
    subgraph_nodes.update(next_frontier)
    frontier = next_frontier

def relevance(nid):
    label = G.nodes[nid].get('label', '').lower()
    return sum(1 for t in terms if t in label)

ranked_nodes = sorted(subgraph_nodes, key=relevance, reverse=True)

lines = [f'Traversal: BFS | Start: {[G.nodes[n].get(\"label\",n) for n in start_nodes]} | {len(subgraph_nodes)} nodes']
for nid in ranked_nodes:
    d = G.nodes[nid]
    lines.append(f'  NODE {d.get(\"label\", nid)} [src={d.get(\"source_file\",\"\")} loc={d.get(\"source_location\",\"\")}]')
for u, v in subgraph_edges:
    if u in subgraph_nodes and v in subgraph_nodes:
        d = G.edges[u, v]
        lines.append(f'  EDGE {G.nodes[u].get(\"label\",u)} --{d.get(\"relation\",\"\")} [{d.get(\"confidence\",\"\")}]--> {G.nodes[v].get(\"label\",v)}')

output = chr(10).join(lines)
if len(output) > 8000:
    output = output[:8000] + chr(10) + '... (truncated)'
print(output)
"
```

Replace `QUESTION` with the user's actual question. Present results as a structured summary.

### Mode: path (shortest path)

Run `/graphify path "NODE_A" "NODE_B"` using the graphify skill's path protocol:

```bash
$(cat graphify-out/.graphify_python) -c "
import json, sys
import networkx as nx
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text())
G = json_graph.node_link_graph(data, edges='links')

a_term = 'NODE_A'
b_term = 'NODE_B'

def find_node(term):
    term = term.lower()
    scored = sorted(
        [(sum(1 for w in term.split() if w in G.nodes[n].get('label','').lower()), n)
         for n in G.nodes()],
        reverse=True
    )
    return scored[0][1] if scored and scored[0][0] > 0 else None

src = find_node(a_term)
tgt = find_node(b_term)

if not src or not tgt:
    print(f'Could not find nodes matching: {a_term!r} or {b_term!r}')
    sys.exit(0)

try:
    path = nx.shortest_path(G, src, tgt)
    print(f'Shortest path ({len(path)-1} hops):')
    for i, nid in enumerate(path):
        label = G.nodes[nid].get('label', nid)
        if i < len(path) - 1:
            edge = G.edges[nid, path[i+1]]
            rel = edge.get('relation', '')
            conf = edge.get('confidence', '')
            print(f'  {label} --{rel}--> [{conf}]')
        else:
            print(f'  {label}')
except nx.NetworkXNoPath:
    print(f'No path found between {a_term!r} and {b_term!r}')
"
```

Replace `NODE_A` and `NODE_B`. Explain the path in plain language.

### Mode: explain (node connections)

Run `/graphify explain "NODE_NAME"` using the graphify skill's explain protocol:

```bash
$(cat graphify-out/.graphify_python) -c "
import json, sys
import networkx as nx
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text())
G = json_graph.node_link_graph(data, edges='links')

term = 'NODE_NAME'
term_lower = term.lower()

scored = sorted(
    [(sum(1 for w in term_lower.split() if w in G.nodes[n].get('label','').lower()), n)
     for n in G.nodes()],
    reverse=True
)
if not scored or scored[0][0] == 0:
    print(f'No node matching {term!r}')
    sys.exit(0)

nid = scored[0][1]
data_n = G.nodes[nid]
print(f'NODE: {data_n.get(\"label\", nid)}')
print(f'  source: {data_n.get(\"source_file\",\"unknown\")}')
print(f'  type: {data_n.get(\"file_type\",\"unknown\")}')
print(f'  degree: {G.degree(nid)}')
print()
print('CONNECTIONS:')
for neighbor in G.neighbors(nid):
    edge = G.edges[nid, neighbor]
    nlabel = G.nodes[neighbor].get('label', neighbor)
    rel = edge.get('relation', '')
    conf = edge.get('confidence', '')
    src_file = G.nodes[neighbor].get('source_file', '')
    print(f'  --{rel}--> {nlabel} [{conf}] ({src_file})')
"
```

Replace `NODE_NAME`. Write a 3-5 sentence explanation.

### Mode: coverage (gap analysis)

Find PRD requirement nodes (typically matching pattern `FR\d+`) that have no outgoing edges to stories or code:

```bash
$(cat graphify-out/.graphify_python) -c "
import json, re
import networkx as nx
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text())
G = json_graph.node_link_graph(data, edges='links')

fr_pattern = re.compile(r'^FR\d+', re.IGNORECASE)
story_edge_types = {'implements', 'satisfies', 'references', 'conceptually_related_to'}
code_edge_types = {'implements', 'calls', 'references', 'shares_data_with'}

orphaned = []
for nid, ndata in G.nodes(data=True):
    label = ndata.get('label', '')
    if fr_pattern.match(label) or fr_pattern.match(nid):
        neighbors = list(G.neighbors(nid))
        has_story = any('story' in G.nodes[n].get('source_file', '').lower() or
                       'implementation' in G.nodes[n].get('source_file', '').lower()
                       for n in neighbors)
        has_code = any(G.nodes[n].get('file_type', '') == 'code'
                      for n in neighbors)
        if not has_story and not has_code:
            orphaned.append((nid, label, len(neighbors)))

if orphaned:
    print(f'COVERAGE GAPS: {len(orphaned)} PRD requirements with no story or code edges')
    for nid, label, degree in orphaned:
        print(f'  {label} (degree={degree}, id={nid})')
else:
    print('No coverage gaps found — all FR requirements have story or code connections')
"
```

### Mode: impact (change analysis)

Find all code and artifact nodes connected to a specific story:

```bash
$(cat graphify-out/.graphify_python) -c "
import json, sys
import networkx as nx
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text())
G = json_graph.node_link_graph(data, edges='links')

story_id = 'STORY_ID'

scored = sorted(
    [(sum(1 for w in story_id.replace('-',' ').split() if w in G.nodes[n].get('label','').lower() or w in G.nodes[n].get('source_file','').lower()), n)
     for n in G.nodes()],
    reverse=True
)
start = [nid for s, nid in scored[:3] if s > 0]

if not start:
    print(f'No nodes found for story: {story_id}')
    sys.exit(0)

visited = set()
stack = start[:]
while stack:
    node = stack.pop()
    if node in visited:
        continue
    visited.add(node)
    for neighbor in G.neighbors(node):
        if neighbor not in visited:
            stack.append(neighbor)

code_nodes = []
doc_nodes = []
test_nodes = []
for nid in visited:
    ndata = G.nodes[nid]
    ft = ndata.get('file_type', '')
    sf = ndata.get('source_file', '')
    if 'test' in sf.lower():
        test_nodes.append((nid, ndata.get('label', nid), sf))
    elif ft == 'code':
        code_nodes.append((nid, ndata.get('label', nid), sf))
    else:
        doc_nodes.append((nid, ndata.get('label', nid), sf))

print(f'IMPACT ANALYSIS for {story_id}: {len(visited)} connected nodes')
if code_nodes:
    print(f'  Code ({len(code_nodes)}):')
    for _, label, sf in code_nodes[:15]:
        print(f'    {label} ({sf})')
if test_nodes:
    print(f'  Tests ({len(test_nodes)}):')
    for _, label, sf in test_nodes[:10]:
        print(f'    {label} ({sf})')
if doc_nodes:
    print(f'  Docs ({len(doc_nodes)}):')
    for _, label, sf in doc_nodes[:10]:
        print(f'    {label} ({sf})')
"
```

Replace `STORY_ID` with the actual story identifier (e.g., "2-3").

### Mode: drift (drift detection)

Find code nodes that have no path back to any PRD requirement:

```bash
$(cat graphify-out/.graphify_python) -c "
import json, re
import networkx as nx
from networkx.readwrite import json_graph
from pathlib import Path

data = json.loads(Path('graphify-out/graph.json').read_text())
G = json_graph.node_link_graph(data, edges='links')

fr_nodes = set()
fr_pattern = re.compile(r'^FR\d+', re.IGNORECASE)
for nid, ndata in G.nodes(data=True):
    label = ndata.get('label', '')
    if fr_pattern.match(label) or fr_pattern.match(nid):
        fr_nodes.add(nid)

code_nodes = [(nid, ndata) for nid, ndata in G.nodes(data=True) if ndata.get('file_type') == 'code']

drifted = []
for nid, ndata in code_nodes:
    has_prd_path = False
    for fr in fr_nodes:
        try:
            nx.shortest_path(G, nid, fr)
            has_prd_path = True
            break
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            continue
    if not has_prd_path:
        drifted.append((nid, ndata.get('label', nid), ndata.get('source_file', '')))

if drifted:
    print(f'DRIFT: {len(drifted)} code nodes with no path to PRD requirements')
    for nid, label, sf in drifted[:20]:
        print(f'  {label} ({sf})')
else:
    print('No drift detected — all code traces back to PRD requirements')
"
```

## Output Format

After running any query, present results as:

1. **Structured summary** of what the graph shows
2. **Specific source citations** (file paths, line references from `source_location`)
3. **Confidence notes** — flag any AMBIGUOUS edges
4. **Actionable insight** — what should the caller do with this information

## Integration with BMAD Skills

Other BMAD skills reference this skill's modes via their graph pre/post step sections:

- `bmad-create-story` uses `query` and `path` modes
- `bmad-dev-story` uses `impact` and `query` modes
- `bmad-check-implementation-readiness` uses `coverage` and `drift` modes
- `bmad-validate-prd` uses `coverage` mode
- `bmad-testarch-trace` uses `path` mode (FR → story → code → test)
