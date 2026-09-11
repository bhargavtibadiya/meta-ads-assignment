-- Day-by-day comparison of Meta's reported purchases against our actual
-- order count from orders.csv. This is a date-axis comparison only -- see
-- docs/plans/2026-09-10-meta-ads-integration/06-orders-import-and-sql-queries.md
-- section 5.1 for why we do not attempt a row-level order-to-ad join.
SELECT
  d.date,
  COALESCE(meta.reported_purchases, 0) AS meta_reported_purchases,
  COALESCE(ord.actual_order_count, 0)  AS actual_order_count
FROM (
  SELECT generate_series(
    (SELECT MIN(date) FROM ad_insight_daily),
    (SELECT MAX(date) FROM ad_insight_daily),
    INTERVAL '1 day'
  )::date AS date
) d
LEFT JOIN (
  SELECT date, SUM(purchases) AS reported_purchases
  FROM ad_insight_daily
  GROUP BY date
) meta ON meta.date = d.date
LEFT JOIN (
  SELECT ordered_at::date AS date, COUNT(*) AS actual_order_count
  FROM orders
  GROUP BY ordered_at::date
) ord ON ord.date = d.date
ORDER BY d.date;
