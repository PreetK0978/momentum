// Cross-device sync through a file in a private GitHub repository.
//
// Each device keeps a "base": the record ids present after its last successful sync.
// A sync is a three-way merge of local, remote and base, per record:
//   - on both sides       -> the copy with the newer updatedAt wins
//   - only local          -> new here (keep), unless it was in base (deleted remotely -> drop)
//   - only remote         -> new there (keep), unless it was in base (deleted here -> drop)
import { db, DATA_TABLES, withoutChangeEvents, type DataTable } from '@/db/db';
import { DEVICE_SETTINGS, exportAll, type ExportBundle } from '@/db/repo';
import type { Settings, SyncConfig } from '@/db/types';

type Rec = { id: string; updatedAt?: number };
type Base = Partial<Record<DataTable, string[]>>;

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'ok' | 'offline' | 'error';
export interface SyncState { status: SyncStatus; lastSync: number | null; error: string | null }

// ---------- tiny store for the UI ----------

let state: SyncState = { status: 'off', lastSync: null, error: null };
const subs = new Set<() => void>();
const set = (p: Partial<SyncState>) => {
  state = { ...state, ...p };
  subs.forEach((s) => s());
};
export const syncStore = {
  get: () => state,
  subscribe: (fn: () => void) => {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};

// ---------- config ----------

export async function getSyncConfig(): Promise<SyncConfig | null> {
  return ((await db.meta.get('syncConfig'))?.value as SyncConfig | undefined) ?? null;
}

export async function setSyncConfig(cfg: SyncConfig | null) {
  if (cfg) await db.meta.put({ id: 'syncConfig', value: cfg });
  else {
    await db.meta.bulkDelete(['syncConfig', 'syncBase']);
    set({ status: 'off', error: null });
  }
}

// ---------- GitHub contents API ----------

const api = (cfg: SyncConfig, path = '') => `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${path}`;
const headers = (cfg: SyncConfig, accept = 'application/vnd.github+json') => ({ Authorization: `Bearer ${cfg.token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' });

function b64encode(s: string) {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function b64decode(s: string) {
  const bin = atob(s.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

async function ghError(res: Response) {
  if (res.status === 401) return new Error('GitHub rejected the token. Check that it is valid and not expired.');
  if (res.status === 403) return new Error('The token does not have permission for this repository (needs Contents: read and write).');
  if (res.status === 404) return new Error('Repository not found, or the token cannot access it.');
  return new Error(`GitHub error ${res.status}`);
}

/** Checks the repo exists, is private and writable with this token. */
export async function testConnection(cfg: SyncConfig) {
  const res = await fetch(api(cfg), { headers: headers(cfg), cache: 'no-store' });
  if (!res.ok) throw await ghError(res);
  const repo = await res.json();
  if (!repo.private) throw new Error('That repository is public. Use a private repository so your data stays private.');
  if (repo.permissions && !repo.permissions.push) throw new Error('The token can read but not write this repository.');
}

async function pull(cfg: SyncConfig): Promise<{ bundle: ExportBundle | null; sha: string | null }> {
  const url = api(cfg, `/contents/${cfg.path}`);
  const res = await fetch(url, { headers: headers(cfg), cache: 'no-store' });
  if (res.status === 404) return { bundle: null, sha: null };
  if (!res.ok) throw await ghError(res);
  const meta = await res.json();
  let text: string;
  if (meta.content) text = b64decode(meta.content);
  else {
    // files over 1 MB come back without inline content
    const raw = await fetch(url, { headers: headers(cfg, 'application/vnd.github.raw+json'), cache: 'no-store' });
    if (!raw.ok) throw await ghError(raw);
    text = await raw.text();
  }
  return { bundle: JSON.parse(text) as ExportBundle, sha: meta.sha };
}

async function push(cfg: SyncConfig, bundle: ExportBundle, sha: string | null): Promise<'ok' | 'conflict'> {
  const res = await fetch(api(cfg, `/contents/${cfg.path}`), {
    method: 'PUT',
    headers: { ...headers(cfg), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `sync ${new Date().toISOString()}`, content: b64encode(JSON.stringify(bundle)), ...(sha ? { sha } : {}) }),
  });
  if (res.status === 409 || res.status === 422) return 'conflict';
  if (!res.ok) throw await ghError(res);
  return 'ok';
}

// ---------- merge (pure, exported for testing) ----------

export function mergeRecords<T extends Rec>(local: T[], remote: T[], base: Set<string> | null): T[] {
  const L = new Map(local.map((r) => [r.id, r]));
  const R = new Map(remote.map((r) => [r.id, r]));
  const out: T[] = [];
  for (const id of new Set([...L.keys(), ...R.keys()])) {
    const l = L.get(id), r = R.get(id);
    if (l && r) out.push((r.updatedAt ?? 0) > (l.updatedAt ?? 0) ? r : l);
    else if (l) { if (!base?.has(id)) out.push(l); }
    else if (r) { if (!base?.has(id)) out.push(r); }
  }
  return out;
}

export function mergeSettings(local: Settings | undefined, remote: Settings | undefined, firstSync: boolean): Settings | undefined {
  if (!remote) return local;
  if (!local) return remote;
  const remoteWins = firstSync || (remote.updatedAt ?? 0) > (local.updatedAt ?? 0);
  if (!remoteWins) return local;
  const merged = { ...local, ...remote, id: 'app' as const, onboarded: true };
  for (const k of DEVICE_SETTINGS) (merged as Record<string, unknown>)[k] = local[k];
  return merged;
}

const stripDevice = (s: Settings | undefined) => {
  if (!s) return s;
  const c = { ...s } as Record<string, unknown>;
  for (const k of DEVICE_SETTINGS) delete c[k];
  return c;
};

// ---------- sync ----------

let running: Promise<void> | null = null;
let again = false;

/** Runs one sync. Concurrent calls coalesce into one follow-up run. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce(attempt = 0): Promise<void> {
  const cfg = await getSyncConfig();
  if (!cfg) return set({ status: 'off' });
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return set({ status: 'offline' });
  set({ status: 'syncing', error: null });
  try {
    const [{ bundle: remote, sha }, local, baseRow] = await Promise.all([pull(cfg), exportAll(), db.meta.get('syncBase')]);
    const base = (baseRow?.value as Base | undefined) ?? null;
    if (remote && remote.app !== 'momentum') throw new Error('The sync file in that repository is not a Momentum file.');

    const merged = { ...local, data: {} as ExportBundle['data'] };
    for (const t of DATA_TABLES) {
      merged.data[t] = mergeRecords((local.data[t] ?? []) as Rec[], ((remote?.data[t] ?? []) as Rec[]), base ? new Set(base[t] ?? []) : null);
    }
    merged.settings = mergeSettings(local.settings, remote?.settings, !base);

    // apply to this device: only rows that actually changed
    await withoutChangeEvents(() =>
      db.transaction('rw', [...DATA_TABLES.map((t) => db.table(t)), db.settings], async () => {
        for (const t of DATA_TABLES) {
          const before = new Map((local.data[t] as Rec[]).map((r) => [r.id, JSON.stringify(r)]));
          const after = merged.data[t] as Rec[];
          const keep = new Set(after.map((r) => r.id));
          const del = [...before.keys()].filter((id) => !keep.has(id));
          const put = after.filter((r) => before.get(r.id) !== JSON.stringify(r));
          if (del.length) await db.table(t).bulkDelete(del);
          if (put.length) await db.table(t).bulkPut(put);
        }
        if (merged.settings && JSON.stringify(merged.settings) !== JSON.stringify(local.settings)) await db.settings.put(merged.settings);
      }),
    );

    // push if the remote copy is missing anything
    const remoteView = remote ? JSON.stringify({ d: remote.data, s: stripDevice(remote.settings) }) : null;
    const mergedView = JSON.stringify({ d: merged.data, s: stripDevice(merged.settings) });
    if (remoteView !== mergedView) {
      const outgoing: ExportBundle = { ...merged, exportedAt: new Date().toISOString(), settings: stripDevice(merged.settings) as unknown as Settings };
      if ((await push(cfg, outgoing, sha)) === 'conflict') {
        if (attempt < 3) return syncOnce(attempt + 1); // another device pushed first: merge again
        throw new Error('Another device keeps updating at the same moment. Try again.');
      }
    }

    const newBase: Base = {};
    for (const t of DATA_TABLES) newBase[t] = (merged.data[t] as Rec[]).map((r) => r.id);
    await db.meta.put({ id: 'syncBase', value: newBase });
    set({ status: 'ok', lastSync: Date.now(), error: null });
  } catch (e) {
    const offline = e instanceof TypeError; // fetch network failure
    set({ status: offline ? 'offline' : 'error', error: offline ? null : (e as Error).message });
  }
}
