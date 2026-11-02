import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, AlertCircle, Check, Unplug, ExternalLink } from 'lucide-react';
import { Card, Field } from '@/components/ui';
import { useToast } from '@/hooks/ui';
import { cn } from '@/lib/cn';
import type { SyncConfig } from '@/db/types';
import { getSyncConfig, setSyncConfig, syncNow, testConnection } from './sync';
import { useSyncState } from './useSync';

const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new';

export function SyncBadge({ compact }: { compact?: boolean }) {
  const s = useSyncState();
  if (s.status === 'off') return null;
  const meta = {
    idle: { icon: Cloud, text: 'Sync ready', cls: 'text-subtle' },
    syncing: { icon: RefreshCw, text: 'Syncing…', cls: 'text-accent' },
    ok: { icon: Cloud, text: 'Synced', cls: 'text-success' },
    offline: { icon: CloudOff, text: 'Offline — will sync later', cls: 'text-warning' },
    error: { icon: AlertCircle, text: 'Sync problem', cls: 'text-danger' },
  }[s.status];
  const I = meta.icon;
  return (
    <button onClick={() => syncNow()} title={s.error ?? (s.lastSync ? `Last synced ${new Date(s.lastSync).toLocaleTimeString()}` : meta.text)} className={cn('flex items-center gap-1.5 text-[11px]', meta.cls)}>
      <I className={cn('h-3.5 w-3.5', s.status === 'syncing' && 'animate-spin')} />
      {!compact && meta.text}
    </button>
  );
}

export function SyncCard() {
  const toast = useToast();
  const state = useSyncState();
  const [cfg, setCfg] = useState<SyncConfig | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ owner: 'PreetK0978', repo: 'momentum-data', token: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getSyncConfig().then((c) => {
      setCfg(c);
      setLoaded(true);
    });
  }, []);

  const connect = async () => {
    const c: SyncConfig = { owner: form.owner.trim(), repo: form.repo.trim(), token: form.token.trim(), path: 'momentum.json' };
    if (!c.owner || !c.repo || !c.token) return setErr('Fill in all three fields.');
    setBusy(true);
    setErr(null);
    try {
      await testConnection(c);
      await setSyncConfig(c);
      setCfg(c);
      setForm((f) => ({ ...f, token: '' }));
      await syncNow();
      toast('Sync connected');
    } catch (e) {
      setErr(e instanceof TypeError ? 'Could not reach GitHub. Check your connection.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    await setSyncConfig(null);
    setCfg(null);
    toast('Sync turned off on this device. Your data here is kept.');
  };

  if (!loaded) return null;

  return (
    <Card
      className="lg:col-span-2"
      title="Sync across devices"
      subtitle="Keep Windows and iPhone in step through a private GitHub repository that only you can access."
      action={cfg ? <SyncBadge /> : undefined}
    >
      {cfg ? (
        <div className="grid gap-4">
          <div className="grid gap-3 rounded-xl border border-line bg-bg/40 p-4 text-sm sm:grid-cols-3">
            <div><div className="text-[11px] text-subtle">Repository</div><div className="truncate font-medium">{cfg.owner}/{cfg.repo}</div></div>
            <div><div className="text-[11px] text-subtle">Last synced</div><div className="font-medium">{state.lastSync ? new Date(state.lastSync).toLocaleString() : '—'}</div></div>
            <div><div className="text-[11px] text-subtle">Status</div><div className="font-medium capitalize">{state.status}</div></div>
          </div>
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
          <p className="text-xs text-subtle">Changes sync automatically when the app opens, a few seconds after each edit, and every minute while it is open. When the same item is edited on two devices, the most recent edit wins.</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={state.status === 'syncing'} onClick={() => syncNow()}><RefreshCw className={cn('h-4 w-4', state.status === 'syncing' && 'animate-spin')} /> Sync now</button>
            <button className="btn-ghost" onClick={disconnect}><Unplug className="h-4 w-4" /> Disconnect this device</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <ol className="grid list-decimal content-start gap-2 pl-5 text-sm text-muted">
            <li>Create a <b className="text-fg">private</b> repository on GitHub (for example <code className="text-fg">momentum-data</code>).</li>
            <li>
              Create a fine-grained token:{' '}
              <a className="inline-flex items-center gap-1 text-accent underline" href={TOKEN_URL} target="_blank" rel="noreferrer">GitHub → New token <ExternalLink className="h-3 w-3" /></a>
              . Under <i>Repository access</i> choose <b className="text-fg">Only select repositories</b> → your data repo. Under <i>Permissions → Contents</i> choose <b className="text-fg">Read and write</b>. Set the expiration you're comfortable with.
            </li>
            <li>Paste the token here, then do the same on your other device (you can reuse the same token).</li>
          </ol>
          <form className="grid content-start gap-3" onSubmit={(e) => { e.preventDefault(); connect(); }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="GitHub username"><input className="input" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} autoCapitalize="off" autoCorrect="off" /></Field>
              <Field label="Private data repository"><input className="input" value={form.repo} onChange={(e) => setForm({ ...form, repo: e.target.value })} autoCapitalize="off" autoCorrect="off" /></Field>
            </div>
            <Field label="Access token" hint="Stored only on this device. It can access nothing but the repository you selected.">
              <input className="input font-mono" type="password" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} placeholder="github_pat_…" autoComplete="off" />
            </Field>
            {err && <p className="text-xs text-danger">{err}</p>}
            <button type="submit" className="btn-primary justify-self-start" disabled={busy}>
              {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Connect and sync
            </button>
          </form>
        </div>
      )}
    </Card>
  );
}
