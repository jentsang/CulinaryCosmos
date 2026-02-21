import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { parse } from "csv-parse/sync";

function parseCSVSimple(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j] ?? "";
    });
    rows.push(row);
  }
  return rows;
}

async function loadFlavorPairingsJson(dataDir: string): Promise<{ nodes: { id: string; name: string; group?: number }[]; links: { source: string; target: string; value?: number }[] } | null> {
  try {
    const raw = await readFile(path.join(dataDir, "flavor_pairings.json"), "utf-8");
    const data = JSON.parse(raw) as {
      nodes?: { id: string; label?: string; category?: string }[];
      edges?: { source: string; target: string; weight?: number }[];
    };

    const jsonNodes = data.nodes ?? [];
    const jsonEdges = data.edges ?? [];
    if (!jsonNodes.length && !jsonEdges.length) return null;

    const nodes = jsonNodes.map((n) => ({
      id: n.id,
      name: n.label ?? n.id,
      group: undefined as number | undefined,
      category: n.category,
    }));

    const links = jsonEdges.map((e) => ({
      source: e.source,
      target: e.target,
      value: e.weight,
    }));

    return { nodes, links };
  } catch {
    return null;
  }
}

async function loadFlavorPairingsCsv(dataDir: string): Promise<{ nodes: { id: string; name: string; group?: number }[]; links: { source: string; target: string; value?: number }[] } | null> {
  try {
    const raw = await readFile(path.join(dataDir, "flavor_pairings.csv"), "utf-8");
    const records = parseCSVSimple(raw);

    if (!records.length) return null;

    const nodeIds = new Set<string>();
    const links: { source: string; target: string; value?: number }[] = [];

    for (const row of records) {
      const source = (row.source ?? "").trim();
      const target = (row.target ?? "").trim();
      if (!source || !target) continue;

      nodeIds.add(source);
      nodeIds.add(target);
      const w = row.weight?.trim();
      links.push({
        source,
        target,
        value: w && !Number.isNaN(parseInt(w, 10)) ? parseInt(w, 10) : undefined,
      });
    }

    const nodes = Array.from(nodeIds).map((id) => ({
      id,
      name: id,
      group: undefined as number | undefined,
    }));

    return { nodes, links };
  } catch {
    return null;
  }
}

async function loadBackupNodesEdges(dataDir: string): Promise<{ nodes: { id: string; name: string; group?: number }[]; links: { source: string; target: string; value?: number }[] } | null> {
  try {
    const [nodesRaw, edgesRaw] = await Promise.all([
      readFile(path.join(dataDir, "nodes.csv"), "utf-8"),
      readFile(path.join(dataDir, "edges.csv"), "utf-8"),
    ]);

    const nodeRows = parseCSVSimple(nodesRaw);
    const edgeRows = parseCSVSimple(edgesRaw);

    const nodes = nodeRows.map((row) => ({
      id: row.id,
      name: row.name,
      group: row.group ? parseInt(row.group, 10) : undefined,
    }));

    const links = edgeRows.map((row) => ({
      source: row.source,
      target: row.target,
      value: row.value ? parseInt(row.value, 10) : undefined,
    }));

    return { nodes, links };
  } catch {
    return null;
  }
}

const LITE_NODE_LIMIT = 600;

function toLiteGraph(
  nodes: { id: string; name: string; group?: number; category?: string }[],
  links: { source: string; target: string; value?: number }[]
): { nodes: typeof nodes; links: typeof links } {
  const degree = new Map<string, number>();
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
    degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
  }
  const sorted = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
  const topIds = new Set(sorted.slice(0, LITE_NODE_LIMIT).map((n) => n.id));
  const liteNodes = nodes.filter((n) => topIds.has(n.id));
  const liteLinks = links.filter((l) => topIds.has(l.source) && topIds.has(l.target));
  return { nodes: liteNodes, links: liteLinks };
}

export async function GET(request: Request) {
  const dataDir = path.join(process.cwd(), "data");
  const { searchParams } = new URL(request.url);
  const lite = searchParams.get("lite") === "true";

  const json = await loadFlavorPairingsJson(dataDir);
  if (json) {
    const { nodes, links } = lite ? toLiteGraph(json.nodes, json.links) : { nodes: json.nodes, links: json.links };
    return NextResponse.json(
      { nodes, links, source: "flavor_pairings.json", lite },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } }
    );
  }

  const csv = await loadFlavorPairingsCsv(dataDir);
  if (csv) {
    return NextResponse.json({
      nodes: csv.nodes,
      links: csv.links,
      source: "flavor_pairings.csv",
    });
  }

  const backup = await loadBackupNodesEdges(dataDir);
  if (backup) {
    return NextResponse.json({
      nodes: backup.nodes,
      links: backup.links,
      source: "nodes.csv + edges.csv",
    });
  }

  console.error("Failed to load graph data: main and backup failed");
  return NextResponse.json(
    { error: "Failed to load graph data" },
    { status: 500 }
  );
}
