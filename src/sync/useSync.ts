import { useEffect, useSyncExternalStore } from 'react';
import { onLocalChange } from '@/db/db';
import { getSyncConfig, syncNow, syncStore } from './sync';

/** Keeps this device in sync: on open, shortly after each edit, on focus/online, and every minute. */
export function useSyncScheduler() {
  useEffect(() => {
    let timer: number | undefined;
    const run = () => {
      window.clearTimeout(timer);
      getSyncConfig().then((c) => c && syncNow());
    };
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 2500);
    };
    const onVisible = () => document.visibilityState === 'visible' && run();
    run();
    const off = onLocalChange(soon);
    const tick = window.setInterval(() => document.visibilityState === 'visible' && run(), 60_000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', run);
    window.addEventListener('focus', run);
    return () => {
      off();
      window.clearTimeout(timer);
      window.clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', run);
      window.removeEventListener('focus', run);
    };
  }, []);
}

export function useSyncState() {
  return useSyncExternalStore(syncStore.subscribe, syncStore.get);
}
