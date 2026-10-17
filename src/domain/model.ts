export type Kind = 'xyz' | 'fusion' | 'other';
export type Quality = 'confirmed' | 'manual' | 'unknown';
export interface Card { id: number; name: string; kind: Kind; value: number }
export interface Stock { id: number; count: number; face: 'up' | 'down' | 'unknown' }
export interface Deck { id: string; name: string; main: Record<string, number>; extra: Record<string, number>; readAt: number; revision?:number }
export interface DeckSelection {id:string;name:string;revision:number;cacheId?:string;localizedName?:boolean}
export interface Counts { myHand: number | null; opponentHand: number | null; myField: number | null; opponentField: number | null }
export interface Monster { uid: number; kind: 'level' | 'rank' | 'none'; value: number | null; faceUp: boolean }
export interface Move { key: string; index: number; action: number; cardId: number; player: number; from: number; to: number | null; targetPlayer: number | null; face: 'up' | 'down' | 'unknown'; affectsInventory: boolean }
export interface Snapshot {
  status: 'waiting' | 'menu' | 'duel' | 'error'; session: string | null; timestamp: number;
  counts: Counts; monsters: Monster[]; myTeam: number; extraCount: number | null;
  banishedCount: number | null; moves: Move[]; logLength: number;
  completeLog: boolean; deck: Deck | null; reason?: string; version?: string;
  busy?: boolean;
  /** duel means the local player's initial deck was read from this duel's settings. */
  deckSource?: 'editor' | 'duel' | 'preparation';
  deckSelection?:DeckSelection|null;
  cachedPreparationDeck?:Deck;
}
export interface Inventory { extra: Stock[]; banished: Stock[]; quality: Quality; reasons: string[] }
export interface Plan { rank: number; level: number; targetKind: 'level' | 'rank'; target: number; returnRank: number; returnLevel: number; usesPrevious: boolean }
export interface SolveResult { status: 'ready' | 'none' | 'uncertain'; reason: string; plans: Plan[] }
export const emptyCounts = (): Counts => ({ myHand: null, opponentHand: null, myField: null, opponentField: null });
export function countTotal(counts: Counts): number | null {
  const values = Object.values(counts);
  return values.some(v => v === null || !Number.isInteger(v) || v < 0 || v > 200) ? null : values.reduce<number>((a, b) => a + (b ?? 0), 0);
}
export function targetKinds(monsters: Monster[]) {
  const map = new Map<string, { kind: 'level' | 'rank'; value: number }>();
  for (const m of monsters) if (m.faceUp && m.kind !== 'none' && m.value !== null && Number.isInteger(m.value) && m.value > 0)
    map.set(`${m.kind}:${m.value}`, { kind: m.kind, value: m.value });
  return [...map.values()].sort((a,b) => a.value-b.value || a.kind.localeCompare(b.kind));
}
export function validateDeck(value: unknown): value is Deck {
  if (!value || typeof value !== 'object') return false;
  const deck = value as Deck;
  if (typeof deck.id !== 'string' || typeof deck.name !== 'string' || !Number.isFinite(deck.readAt)) return false;
  return !!deck.id && [deck.main, deck.extra].every(part => !!part && typeof part === 'object' && !Array.isArray(part) && Object.entries(part).every(([id, n]) => Number.isInteger(Number(id)) && Number(id) > 0 && Number.isInteger(n) && n > 0 && n <= 3))
    && Object.values(deck.main).reduce((a,b)=>a+b,0) >= 40
    && Object.values(deck.main).reduce((a,b)=>a+b,0) <= 60
    && Object.values(deck.extra).reduce((a,b)=>a+b,0) <= 15;
}
