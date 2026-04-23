import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "planner.json");

function readData(): Record<string, Block[]> {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeData(data: Record<string, Block[]>) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

interface Block {
  id: string;
  type: "text" | "todo" | "h1" | "h2" | "h3";
  content: string;
  checked?: boolean;
}

export const dynamic = "force-dynamic";

export async function GET() {
  const data = readData();
  return Response.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date, blocks } = body as { date: string; blocks: Block[] };

  if (!date) {
    return Response.json({ error: "date is required" }, { status: 400 });
  }

  const data = readData();
  data[date] = blocks;
  writeData(data);

  return Response.json({ success: true });
}
