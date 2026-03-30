/**
 * LRU-ish texture cache for node previews (Phase 5). Pixi `Texture` instances must be destroyed on eviction.
 */
export class PixiTextureLRU {
  private readonly maxEntries: number;
  private readonly map = new Map<string, { texture: { destroy: () => void }; key: string }>();

  constructor(maxEntries = 32) {
    this.maxEntries = maxEntries;
  }

  get(key: string): unknown | undefined {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.texture;
  }

  set(key: string, texture: { destroy: () => void }): void {
    if (this.map.has(key)) {
      const prev = this.map.get(key)!;
      try {
        prev.texture.destroy();
      } catch {
        /* already destroyed */
      }
      this.map.delete(key);
    }
    while (this.map.size >= this.maxEntries) {
      const first = this.map.keys().next().value as string | undefined;
      if (first === undefined) break;
      const v = this.map.get(first);
      this.map.delete(first);
      try {
        v?.texture.destroy();
      } catch {
        /* */
      }
    }
    this.map.set(key, { texture, key });
  }

  clear(): void {
    for (const [, v] of this.map) {
      try {
        v.texture.destroy();
      } catch {
        /* */
      }
    }
    this.map.clear();
  }
}
