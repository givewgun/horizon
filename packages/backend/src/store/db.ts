/**
 * SQLite store for alert dedup.
 *
 * Tries better-sqlite3 first (fast, sync API). If that import fails (e.g. native
 * build problems on ARM64), falls back to Node's built-in node:sqlite (Node 22+).
 * If neither is available we fall back to an in-memory store so dev never blocks;
 * Phase 3 promotes this from a stub to a real persistence layer.
 */

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export interface SentAlertRow {
  launchId: string;
  lead: string;
  sentAt: number;
}

export interface AlertStore {
  isSent(launchId: string, lead: string): boolean;
  markSent(launchId: string, lead: string, at?: number): void;
  clearForLaunch(launchId: string): void;
  close(): void;
}

interface NativeDbLike {
  pragma?(stmt: string): unknown;
  exec(sql: string): void;
  prepare<P extends unknown[] = unknown[]>(sql: string): {
    get: (...params: P) => unknown;
    run: (...params: P) => unknown;
    all: (...params: P) => unknown[];
  };
  close(): void;
}

function ensureDir(path: string): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    /* directory may already exist */
  }
}

async function tryBetterSqlite3(path: string): Promise<NativeDbLike | null> {
  try {
    const mod = (await import('better-sqlite3')) as { default: new (path: string) => NativeDbLike };
    return new mod.default(path);
  } catch {
    return null;
  }
}

async function tryNodeSqlite(path: string): Promise<NativeDbLike | null> {
  try {
    // Non-literal specifier defeats TS module resolution; the import is optional at runtime.
    const specifier = 'node:sqlite';
    const mod = (await import(specifier).catch(() => null)) as
      | { DatabaseSync: new (path: string) => NativeDbLike }
      | null;
    if (!mod) return null;
    return new mod.DatabaseSync(path);
  } catch {
    return null;
  }
}

function makeMemoryStore(): AlertStore {
  const seen = new Map<string, number>();
  const key = (l: string, x: string): string => `${l}::${x}`;
  return {
    isSent: (l, x) => seen.has(key(l, x)),
    markSent: (l, x, at = Date.now()) => {
      seen.set(key(l, x), at);
    },
    clearForLaunch: (l) => {
      for (const k of Array.from(seen.keys())) if (k.startsWith(`${l}::`)) seen.delete(k);
    },
    close: () => seen.clear(),
  };
}

function makeNativeStore(db: NativeDbLike): AlertStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sent_alerts (
      launch_id TEXT NOT NULL,
      lead TEXT NOT NULL,
      sent_at INTEGER NOT NULL,
      PRIMARY KEY (launch_id, lead)
    );
  `);
  const selIsSent = db.prepare<[string, string]>(
    'SELECT 1 AS x FROM sent_alerts WHERE launch_id = ? AND lead = ? LIMIT 1',
  );
  const insOrReplace = db.prepare<[string, string, number]>(
    'INSERT OR REPLACE INTO sent_alerts(launch_id, lead, sent_at) VALUES (?, ?, ?)',
  );
  const delByLaunch = db.prepare<[string]>('DELETE FROM sent_alerts WHERE launch_id = ?');
  return {
    isSent: (l, x) => selIsSent.get(l, x) !== undefined && selIsSent.get(l, x) !== null,
    markSent: (l, x, at = Date.now()) => {
      insOrReplace.run(l, x, at);
    },
    clearForLaunch: (l) => {
      delByLaunch.run(l);
    },
    close: () => db.close(),
  };
}

export async function openAlertStore(path: string): Promise<AlertStore> {
  ensureDir(path);
  const native = (await tryBetterSqlite3(path)) ?? (await tryNodeSqlite(path));
  if (native) return makeNativeStore(native);
  return makeMemoryStore();
}
