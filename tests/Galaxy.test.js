import { describe, expect, it } from 'vitest';

import { Galaxy } from '../js/game/Galaxy.js';
import galaxies from '../js/data/galaxies.js';
import { GameState } from '../js/game/GameState.js';

describe('Galaxy', () => {
  it('requires sequential unlocks and enough resources', () => {
    const gs = new GameState();
    const galaxy = new Galaxy(gs);
    galaxy.loadData(galaxies);

    expect(galaxy.canUnlock(1)).toBe(false);
    gs.resources.iron = 180;
    gs.resources.nickel = 90;
    expect(galaxy.canUnlock(1)).toBe(true);
    expect(galaxy.canUnlock(2)).toBe(false);
  });

  it('unlocks the next galaxy, spends resources, and marks the previous galaxy completed', () => {
    const gs = new GameState();
    const events = [];
    const galaxy = new Galaxy(gs);
    galaxy.loadData(galaxies);
    gs.resources.iron = 240;
    gs.resources.nickel = 100;
    gs.on('galaxyUnlocked', (payload) => events.push(payload.index));

    expect(galaxy.unlock(1)).toBe(true);
    gs.flushNotifications();

    expect(gs.currentGalaxyIndex).toBe(1);
    expect(gs.resources.iron).toBe(60);
    expect(gs.resources.nickel).toBe(10);
    expect(gs.unlockedGalaxies).toEqual([0, 1]);
    expect(gs.completedGalaxies).toEqual([0]);
    expect(events).toEqual([1]);
  });

  it('keeps already unlocked galaxies free to revisit without making the next one free', () => {
    const gs = new GameState();
    const galaxy = new Galaxy(gs);
    galaxy.loadData(galaxies);

    gs.resources.iron = 240;
    gs.resources.nickel = 100;
    expect(galaxy.unlock(1)).toBe(true);
    gs.flushNotifications();

    galaxy.unlock(0);
    gs.flushNotifications();

    expect(galaxy.canUnlock(1)).toBe(true);
    expect(galaxy.canUnlock(2)).toBe(false);

    gs.resources.helium3 = 120;
    gs.resources.star_crystal = 60;
    expect(galaxy.canUnlock(2)).toBe(true);
  });

  it('spawns and resolves boss progression with rewards', () => {
    const gs = new GameState();
    const events = [];
    const galaxy = new Galaxy(gs);
    galaxy.loadData(galaxies);
    gs.on('bossSpawn', () => events.push('spawn'));
    gs.on('bossDefeated', () => events.push('defeat'));

    galaxy.addBossProgress(100);
    gs.flushNotifications();

    expect(events).toContain('spawn');
    expect(galaxy.getBossProgress().active).toBe(true);

    galaxy.setBossDefeated();
    gs.flushNotifications();

    expect(events).toEqual(['spawn', 'defeat']);
    expect(gs.resources.iron).toBe(90);
    expect(gs.resources.nickel).toBe(35);
    expect(gs.statistics.bossesKilled).toBe(1);
    expect(galaxy.getBossProgress().active).toBe(false);
  });
});
