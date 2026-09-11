-- Orders vs Spend
-- Saved Metabase question (native SQL). Dual-axis chart: daily ad spend from
-- ad_insight_daily vs daily order count from orders, joined on the date axis
-- only. There is no row-level order-to-ad join (orders.csv has no click id).
--
-- Optional Metabase variables:
--   {{campaign}}     spend-only dropdown of "Name (id)". Empty = all campaigns.
--                    Orders stay account-level on purpose.
--   {{start_date}}   inclusive start
--   {{end_date}}     inclusive end
--
-- `npm run metabase:provision` wires the Campaign dropdown from `campaigns`
-- so the widget shows "Summer Sale 2026 (<id>)" while the query still filters
-- on the stable internal id. Screenshot: app/submission/orders-vs-spend-chart.png

SELECT
  d.date,
  COALESCE(spend.daily_spend, 0)     AS daily_spend,
  COALESCE(ord.daily_order_count, 0) AS daily_order_count
FROM (
  SELECT generate_series(
    (SELECT MIN(date) FROM ad_insight_daily),
    (SELECT MAX(date) FROM ad_insight_daily),
    INTERVAL '1 day'
  )::date AS date
) d
LEFT JOIN (
  SELECT date, SUM(spend) AS daily_spend
  FROM ad_insight_daily
  WHERE 1 = 1
  [[AND campaign_id = {{campaign}}]]
  GROUP BY date
) spend ON spend.date = d.date
LEFT JOIN (
  SELECT ordered_at::date AS date, COUNT(*) AS daily_order_count
  FROM orders
  GROUP BY ordered_at::date
) ord ON ord.date = d.date
WHERE 1 = 1
[[AND d.date >= {{start_date}}]]
[[AND d.date <= {{end_date}}]]
ORDER BY d.date;
