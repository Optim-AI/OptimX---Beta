/**
 * In-memory production run + manifest stores (persistence-friendly interfaces).
 * Durable DB persistence is pending — no suitable commercial production-run table yet.
 */

import type {
  CampaignProductionRun,
  ProductionManifest,
  ProductionManifestStore,
  ProductionRunStore,
} from "./types";

function key(campaignId: string, generationVersion: string): string {
  return `${campaignId}:${generationVersion}`;
}

export class InMemoryProductionRunStore implements ProductionRunStore {
  private readonly map = new Map<string, CampaignProductionRun>();

  async save(run: CampaignProductionRun): Promise<void> {
    this.map.set(key(run.campaignId, run.generationVersion), structuredClone(run));
  }

  async get(
    campaignId: string,
    generationVersion: string
  ): Promise<CampaignProductionRun | null> {
    const found = this.map.get(key(campaignId, generationVersion));
    return found ? structuredClone(found) : null;
  }

  clear(campaignId?: string): void {
    if (!campaignId) {
      this.map.clear();
      return;
    }
    for (const k of this.map.keys()) {
      if (k.startsWith(`${campaignId}:`)) this.map.delete(k);
    }
  }
}

export class InMemoryProductionManifestStore implements ProductionManifestStore {
  private readonly map = new Map<string, ProductionManifest>();

  async save(manifest: ProductionManifest): Promise<void> {
    this.map.set(key(manifest.campaignId, manifest.generationVersion), structuredClone(manifest));
  }

  async get(
    campaignId: string,
    generationVersion: string
  ): Promise<ProductionManifest | null> {
    const found = this.map.get(key(campaignId, generationVersion));
    return found ? structuredClone(found) : null;
  }

  clear(campaignId?: string): void {
    if (!campaignId) {
      this.map.clear();
      return;
    }
    for (const k of this.map.keys()) {
      if (k.startsWith(`${campaignId}:`)) this.map.delete(k);
    }
  }
}

/** Shared default stores for library process lifetime (tests can inject their own). */
export const defaultRunStore = new InMemoryProductionRunStore();
export const defaultManifestStore = new InMemoryProductionManifestStore();

export function clearOrchestratorStores(campaignId?: string): void {
  defaultRunStore.clear(campaignId);
  defaultManifestStore.clear(campaignId);
}
