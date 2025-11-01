// lib/integrationStore.ts
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "integrations.json");
export const PLATFORMS = ["meta", "google-ads", "whatsapp", "linkedin", "twitter"];

async function ensureFile() {
  try {
    await fs.access(DATA_FILE);
  } catch {
    const initial: Record<string, boolean> = {};
    PLATFORMS.forEach((p) => (initial[p] = false));
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
  }
}

export async function getStatuses(): Promise<Record<string, boolean>> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const data = JSON.parse(raw || '{}');
  PLATFORMS.forEach((p) => { if (typeof data[p] === 'undefined') data[p] = false; });
  return data;
}

export async function setStatus(platformId: string, connected: boolean): Promise<void> {
  const statuses = await getStatuses();
  statuses[platformId] = connected;
  await fs.writeFile(DATA_FILE, JSON.stringify(statuses, null, 2), 'utf8');
}
