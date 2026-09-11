# Take-Home Assignment: Meta Ads → Database → Metabase

**Timebox:** ~5–6 hours. Submit within 4 days as a private GitHub repo.

---

## The problem

We run performance marketing for D2C brands. Ad spend sits inside Meta Ads Manager. Orders sit in our own database. The two never meet, so nobody can answer a question as basic as *"what did this campaign actually make us last month?"* without someone exporting CSVs by hand.

Your job is to build the layer that connects them, and then prove it works by charting it.

---

## What we expect

**1. Pull Meta Ads data into PostgreSQL.**
Insights at `ad` level, `time_increment=1` — one row per ad per day.

**2. Design the schema yourself.**
We're deliberately not giving you one. How you model the campaign → ad set → ad hierarchy, and how you handle names and statuses changing over time, is most of what we're evaluating.

**3. Make the sync re-runnable.**
Running it twice must not double-count. Running it after a week of downtime must catch up correctly.

**4. Handle restated data.**
Meta keeps revising conversion numbers for a given day for up to 28 days afterward, as delayed and view-through conversions attribute back. A pipeline that writes each day once and never revisits it will drift out of sync with Ads Manager permanently. Your design must account for this.

**5. Join it to orders.**
Match Meta data against the `orders.csv` we provide. Where the join is imperfect, say so in writing rather than papering over it.

**6. Build one chart in Metabase: Orders vs Spend.**

Point Metabase at your database and build a single question: **daily ad spend and daily order count on the same time axis**, filterable by campaign, over a date range.

Submit:

- a screenshot of the chart,
- the SQL or query definition behind it,
- `docker-compose.yml` or equivalent so we can run Metabase against your DB ourselves.

This chart is the actual test. If your schema is modeled well, it takes ten minutes. If it isn't, you'll find yourself writing something ugly to force it out — and that's the signal we're reading.

**Out of scope:** frontend, auth, deployment, CI. Don't spend time there.

---

## Queries to include as `.sql` files

1. Daily spend, impressions, clicks, purchases and purchase value for a given campaign over a date range.
2. ROAS by campaign for last month, ranked.
3. Total spend for a campaign whose name changed mid-flight — correctly totalled across the rename.
4. Ad-level spend for ads with zero attributed purchases but over ₹5,000 spend.
5. Day-by-day comparison of Meta's reported purchases against our actual order count from `orders.csv`.

Query 3 isn't a trick, but it's the one most submissions get wrong.

---

## README

Under two pages. Cover:

- How to run it, end to end.
- Your schema, and why you modeled it that way.
- How you handled the 28-day restatement problem.
- Which attribution window you report on, and why.
- Anything you got wrong or didn't finish.

That last point is not a formality. Candidates who name their gaps honestly score higher than ones who imply the assignment was straightforward.

**On AI tools:** use them, we do too. Just say what you used them for, and be ready to defend every line — including the ones you didn't write.

---

## Notes

Don't ask us for production credentials. Create your own Meta developer app and test ad account, or work entirely from the sample payloads in `/fixtures` — either is fine, just tell us which.

We'd rather see four of these six done properly with the gaps named than all six done approximately.
