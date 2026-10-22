import { describe, expect, it } from 'vitest';
import { parseHand } from '../src/engine/index.js';
import { scoreHand } from '../src/decision/score.js';
import { DECISION_MODEL, remainingBag, solveDecision } from '../src/decision/solver.js';

describe('MIL two-suit hand value', () => {
  const score = (hand: string) => scoreHand({ hand: parseHand(hand) });
  it('recognizes ordinary, seven pairs, roots and the cap without double-counting seven-pair aliases', () => {
    expect(score('123456789p23455s')?.points).toBe(1);
    expect(score('112233445566p77s')?.items.map(x => x.id)).toEqual(['seven']);
    expect(score('11112233445566p')?.fan).toBe(5);
    expect(score('11112233445566p')?.points).toBe(8);
    expect(score('111222333p44455s')?.items.map(x => x.id)).toEqual(['pungs']);
    expect(score('123456789p23456s')).toBeNull();
  });
  it('counts physical roots and golden single wait with fixed triplets/quads', () => {
    const r = scoreHand({ hand: ['5s', '5s'], fixedSets: [{ kind: 'quad', tile: '1p' }, { kind: 'triplet', tile: '3p' }, { kind: 'triplet', tile: '6s' }, { kind: 'triplet', tile: '9s' }] });
    expect(r?.items.map(x => x.id)).toEqual(['root', 'pungs', 'single']);
    expect(r?.points).toBe(8);
    expect(() => scoreHand({ hand: parseHand('11111234567p123s') })).toThrow();
  });
  it('keeps a discarded tile out of the pool and uses exact finite probabilities', () => {
    const ctx = { hand: parseHand('123456789p22569s') };
    const certificate = solveDecision(ctx, { version: DECISION_MODEL, kind: 'explicit', bag: ['4s', '7s'], horizon: 1 });
    expect(certificate.accepted).toContain('9s');
    expect(certificate.denominator).toBe('2');
    for (const option of certificate.options) expect(BigInt(option.value.wins)).toBeLessThanOrEqual(2n);
    expect(remainingBag(ctx).filter(t => t === '2s')).toHaveLength(2);
  });
  it('matches hand-counted duplicate-copy paths and absorbing completion times', () => {
    const ctx={hand:parseHand('123456789p22569s')},bag=parseHand('1447s');
    const one=solveDecision(ctx,{version:DECISION_MODEL,kind:'explicit',bag,horizon:1});
    expect(one.denominator).toBe('4');expect(one.options.find(o=>o.tile==='9s')!.value).toMatchObject({score:'3',wins:'3',winTime:'5',ready:'4',readyTime:'0',fans:['3','0','0','0']});
    const two=solveDecision(ctx,{version:DECISION_MODEL,kind:'explicit',bag,horizon:2});
    expect(two.denominator).toBe('12');expect(two.options.find(o=>o.tile==='9s')!.value).toMatchObject({score:'12',wins:'12',winTime:'15',ready:'12',readyTime:'0'});
  });
});
