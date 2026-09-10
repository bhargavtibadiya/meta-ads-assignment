-- ROAS by campaign for last calendar month, ranked highest first.
-- ROAS computed as SUM(purchase_value) / SUM(spend); campaigns with zero
-- spend in the period are excluded to avoid a divide-by-zero.
SELECT
  c.id                                AS campaign_id,
  c.current_name                      AS campaign_name,
  SUM(aid.spend)                      AS total_spend,
  SUM(aid.purchase_value)             AS total_purchase_value,
  ROUND(SUM(aid.purchase_value) / SUM(aid.spend), 4) AS roas
FROM ad_insight_daily aid
JOIN campaigns c ON c.id = aid.campaign_id
WHERE aid.date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
  AND aid.date <  date_trunc('month', CURRENT_DATE)
GROUP BY c.id, c.current_name
HAVING SUM(aid.spend) > 0
ORDER BY roas DESC;
