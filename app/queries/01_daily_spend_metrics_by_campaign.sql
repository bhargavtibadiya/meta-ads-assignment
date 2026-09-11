-- Daily spend, impressions, clicks, purchases and purchase value for a given
-- campaign over a date range.
--
-- Replace :campaign_id / :start_date / :end_date before running (psql variables
-- or a literal UUID / date). campaign_id is campaigns.id, the stable internal
-- id — never the display name.
SELECT
  aid.date,
  SUM(aid.spend)          AS total_spend,
  SUM(aid.impressions)    AS total_impressions,
  SUM(aid.clicks)         AS total_clicks,
  SUM(aid.purchases)      AS total_purchases,
  SUM(aid.purchase_value) AS total_purchase_value
FROM ad_insight_daily aid
WHERE aid.campaign_id = :campaign_id
  AND aid.date BETWEEN :start_date AND :end_date
GROUP BY aid.date
ORDER BY aid.date;
