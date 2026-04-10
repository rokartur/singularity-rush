import { describe, expect, it } from 'vitest';

import { GameState } from '../js/game/GameState.js';

describe('GameState', () => {
  it('levels up, restores hp, and tracks expedition xp without bonus point currencies', () => {
    const gs = new GameState();
    const received = [];
    gs.on('levelUp', (payload) => received.push(payload));
    gs.startExpedition();

    gs.addXP(20);
    gs.flushNotifications();

    expect(gs.level).toBe(2);
    expect(gs.xp).toBe(0);
    expect(gs.maxHp).toBe(110);
    expect(gs.hp).toBe(110);
    expect(gs.expeditionState.xpGained).toBe(20);
    expect(received).toEqual([{ level: 2 }]);
  });

  it('spends shield before HP and emits playerDied at zero HP', () => {
    const gs = new GameState();
    const events = [];
    gs.shield = 25;
    gs.on('playerDied', () => events.push('dead'));

    gs.takeDamage(20);
    expect(gs.shield).toBe(5);
    expect(gs.hp).toBe(100);

    gs.takeDamage(110);
    gs.flushNotifications();

    expect(gs.shield).toBe(0);
    expect(gs.hp).toBe(0);
    expect(events).toEqual(['dead']);
  });

  it('adds and removes resources safely', () => {
    const gs = new GameState();

    gs.addResource('helium3', 12);
    expect(gs.resources.helium3).toBe(12);
    expect(gs.statistics.resourcesCollected).toBe(12);

    expect(gs.removeResource('helium3', 5)).toBe(true);
    expect(gs.resources.helium3).toBe(7);
    expect(gs.removeResource('helium3', 10)).toBe(false);
    expect(gs.resources.helium3).toBe(7);
  });
});
