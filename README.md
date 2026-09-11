# Meta Ads → Database → Metabase

Fixture-backed pipeline: daily ad-level Meta insights into PostgreSQL, `orders.csv` imported as-is, one Metabase chart. No live Meta account.

## How to run

1. `cp app/.env.example app/.env` (`META_DATA_SOURCE=fixtures` needs no Meta token).
2. `docker compose up -d` — Postgres, Metabase (`:3000`), backend (`:4000`). Host Postgres is **5433** so a local 5432 can keep running.
3. Sync: [http://localhost:4000](http://localhost:4000) → **Run sync**, or `curl -X POST http://localhost:4000/api/sync/run`.
4. Orders: **Import orders**, or `curl -X POST http://localhost:4000/api/orders/import`.
5. Chart: `cd app && npm run metabase:provision`, then [http://localhost:3000](http://localhost:3000) (`admin@example.com` / `MetaAdsAdmin1`).
6. Question SQL: `app/submission/orders-vs-spend-question.sql`. Screenshot goes next to it as `app/submission/orders-vs-spend-chart.png`.
7. Five graded queries: `app/queries/*.sql`.

## Schema, and why

Campaigns, ad sets, and ads are stable rows keyed by Meta's id. Insights foreign-key that internal id, never a name. Rename a campaign and spend still totals as one campaign (Query 3). Name and status history is SCD2 (`validTo` null = current); `currentName` is display-only.

Daily facts are `ad_insight_daily`, unique on `(ad_id, date)`. Re-running the sync upserts; it does not append.

## 28-day restatement

Every insights run re-fetches `[min(cursor, today) - 28 days, today]` and upserts `(ad_id, date)`. Delayed conversions overwrite the same row. `SyncCursor` extends the window after downtime.

## Attribution window

`7d_click,1d_view` (`META_ATTRIBUTION_WINDOWS`), passed explicitly on live insights calls. That is Ads Manager's default. Leaving the window implicit is a common source of UI mismatches.

## The orders join

`orders.csv` has no Meta click id, ad id, or campaign id, so there is no reliable row-level join. Inventing one would look precise and be wrong.

We import the CSV keyed by `externalOrderId` (idempotent). The chart and Query 5 join on the **date axis** only. Campaign filter on the chart filters spend only; order counts stay account-level.

## AI tools

Cursor agent (Opus5, Sonnet 5, Grok 4.6)

## What I got wrong or didn't finish

- Fixtures, not a live Ads account.
- SCD2 `validFrom` / `validTo` are sync observation times; Meta does not expose the real rename timestamp.
- Single account currency (INR in fixtures); no FX.
