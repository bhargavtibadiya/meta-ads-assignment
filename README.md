# Meta Ads → Database → Metabase

Fixture-backed pipeline: Meta Ads hierarchy + daily ad insights into PostgreSQL, orders.csv imported as-is, one Metabase chart. Prisma 8 + Express. No live Meta account.

## How to run it, end to end

1. `cp app/.env.example app/.env` (`META_DATA_SOURCE=fixtures` needs no Meta token).
2. `docker compose up -d` — Postgres, Metabase (`:3000`), backend (`:4000`). Host Postgres port defaults to **5433** so a local 5432 server can keep running; containers still use `postgres:5432`. Day-to-day commands after code changes: `docs/runbook/commands.md`.
3. Backend applies Prisma 8 migrations on boot (`prisma db migrate --yes`). Check `docker compose logs backend`.
4. Sync: open http://localhost:4000 and click **Run sync**, or `curl -X POST http://localhost:4000/api/sync/run`.
5. Orders: click **Import orders**, or `curl -X POST http://localhost:4000/api/orders/import`.
6. Metabase: http://localhost:3000. Either click through setup (Postgres host `postgres`, db `meta_ads`, user/pass `postgres`) **or** `cd app && npm run metabase:provision` (creates admin `admin@example.com` / `MetaAdsAdmin1`, adds **Meta Ads Data**, saves **Orders vs Spend**).
7. Question SQL: `docs/submission/orders-vs-spend-question.sql`. Screenshot (human): `docs/submission/orders-vs-spend-chart.png`.
8. Five graded queries: `app/queries/*.sql`.

## Schema, and why I modeled it that way

Campaigns, ad sets, and ads are stable rows keyed by Meta's id. Insights foreign-key the **internal** id, never a name. Rename a campaign and spend still sums to one campaign (Query 3). Name and status live in SCD2 version tables (`validTo` null = current); entity tables denormalize `currentName` for display. Field notes: `docs/db/schema-fields.md`.

Daily facts are `ad_insight_daily` unique on `(ad_id, date)`. Re-running the sync upserts; it does not append.

## How I handled the 28-day restatement problem

Every insights run re-fetches `[min(cursor, today) - 28 days, today]` and upserts `(ad_id, date)`. Delayed conversions overwrite the same row. `SyncCursor` extends the window after downtime. Attribution window is stored per row.

## Attribution window

`7d_click,1d_view` (`META_ATTRIBUTION_WINDOWS`), passed explicitly on live insights calls. That is Meta's long-standing Ads Manager default; leaving the window implicit is a common source of UI mismatches.

## The orders join, honestly

`orders.csv` is a store export. It has no Meta click id, ad id, or campaign id, so there is **no reliable row-level join** to an ad. Inventing one (timestamp windows, fuzzy `utm_campaign` vs `current_name`) would look precise and be wrong.

What we do: import the CSV keyed by `externalOrderId` (idempotent). The chart and Query 5 join on the **date axis** only: daily spend vs daily order count. `utm_campaign` is stored as an optional, weaker soft join and is **not** the chart default. Filtering the chart by campaign_id filters **spend only**; order counts stay account-level.

## AI tools used

Cursor agent (Grok 4.6) implemented schema, Prisma 8 client usage, fixture sync, CSV import, SQL, Docker, and Metabase provisioning from `docs/plans/2026-09-10-meta-ads-integration/`. I specified Option B fixtures, reviewed the schema, and own the Metabase screenshot.

## What I got wrong or didn't finish

- Fixtures, not a live Ads account.
- SCD2 `validFrom`/`validTo` are sync observation times; Meta does not expose the real rename timestamp.
- Single account currency (INR in fixtures); no FX.
- Metabase API provisioning **is** built (`npm run metabase:provision`); first-run still depends on Metabase being up.
- Chart screenshot is a human capture at `docs/submission/orders-vs-spend-chart.png`.
- Host Postgres maps to 5433 by default because 5432 was already in use locally.
