import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

function parseCSV(text: string): Record<string, string>[] {
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

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), "data");
    const [nodesRaw, edgesRaw] = await Promise.all([
      readFile(path.join(dataDir, "nodes.csv"), "utf-8"),
      readFile(path.join(dataDir, "edges.csv"), "utf-8"),
    ]);

    const nodeRows = parseCSV(nodesRaw);
    const edgeRows = parseCSV(edgesRaw);

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

    return NextResponse.json({ nodes, links });
  } catch (err) {
    console.error("Failed to load graph data:", err);
    return NextResponse.json(
      { error: "Failed to load graph data" },
      { status: 500 }
    );
  }
}
