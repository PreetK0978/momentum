# Momentum

A personal performance OS: habits, tasks, goals, scores and analytics. Everything is stored locally in IndexedDB.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build into dist/
```

## Structure

```
src/
  db/          Dexie schema (db.ts), types, defaults, repository (all writes), sample data
  lib/         date keys (timezone-safe), scheduling rules, ScoreEngine, goal progress
  hooks/       DataProvider (live queries + engine), routing, toasts, theme colors
  components/  Shell (sidebar / mobile nav), UI primitives, charts, forms, Check
  pages/       Overview, Planner, Tracker, Calendar, Analytics, Goals, Reports, Settings
```

## Notes

- **Dates** are stored as local `YYYY-MM-DD` keys, never as timestamps, so a check-in can't drift to another day across time zones or DST.
- **No duplicates**: habit logs are keyed `habitId|date` and recurring completions `taskId|date`; imports upsert by id.
- **Scoring** rules live in `src/lib/scoring.ts` and are explained in-app (Analytics → "How scores work").
- **Sync-ready**: every record has a string id and `updatedAt`, and all writes go through `src/db/repo.ts`, so a sync adapter or auth layer can hook in there.
- **Backups**: an automatic snapshot is taken daily and before every import, restore or erase (Settings → Data).
- **PDF export** of monthly reports uses the browser's print dialog ("Save as PDF"), printed in light mode.
- Keyboard: press `N` anywhere to quick-add.

## Live app & devices

- **Live:** https://preetk0978.github.io/momentum/ (redeploys automatically on every push to `main`)
- **iPhone:** open the link in Safari → Share → **Add to Home Screen**. It runs full-screen with its own icon and works offline.
- **Sync (Windows ↔ iPhone):** Settings → *Sync across devices*. Data is stored as `momentum.json` in a **private** repo
  (`momentum-data`) using a fine-grained token limited to that repo (Contents: read & write). Each device does a
  three-way merge per record (newest edit wins; deletions propagate). See `src/sync/sync.ts`.
