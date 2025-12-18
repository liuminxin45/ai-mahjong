import type { RulePack } from './RulePack';

export class RuleRegistry {
  private readonly packs = new Map<string, RulePack>();

  register(pack: RulePack): void {
    this.packs.set(pack.id, pack);
  }

  get(id: string): RulePack {
    const pack = this.packs.get(id);
    if (!pack) {
      throw new Error(`RulePack not found: ${id}`);
    }
    return pack;
  }

  list(): RulePack[] {
    return Array.from(this.packs.values());
  }
}
