import { describe, expect, it } from 'vitest';
import { openAlertStore } from '../store/db.js';

describe('AlertStore', () => {
  it('marks and dedups by (launchId, lead)', async () => {
    const store = await openAlertStore(':memory:');
    expect(store.isSent('L1', 'T-24h')).toBe(false);
    store.markSent('L1', 'T-24h');
    expect(store.isSent('L1', 'T-24h')).toBe(true);
    expect(store.isSent('L1', 'T-1h')).toBe(false);
    expect(store.isSent('L2', 'T-24h')).toBe(false);
    store.close();
  });

  it('clearForLaunch removes only that launch', async () => {
    const store = await openAlertStore(':memory:');
    store.markSent('L1', 'T-24h');
    store.markSent('L2', 'T-24h');
    store.clearForLaunch('L1');
    expect(store.isSent('L1', 'T-24h')).toBe(false);
    expect(store.isSent('L2', 'T-24h')).toBe(true);
    store.close();
  });
});
