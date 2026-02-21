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
    const records = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as { source: string; target: string; weight?: string }[];

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

export async function GET() {
  const dataDir = path.join(process.cwd(), "data");

  const json = await loadFlavorPairingsJson(dataDir);
  if (json) {
    return NextResponse.json({
      nodes: json.nodes,
      links: json.links,
      source: "flavor_pairings.json",
    });
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
