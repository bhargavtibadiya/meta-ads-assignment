-- Ad-level spend for ads with zero attributed purchases but over ₹5,000
-- spend (threshold in the ad account's own currency -- see AdAccount.currency;
-- this query assumes the account currency is INR per the ₹ in the spec, adjust
-- the literal if the actual test account is in a different currency).
SELECT
  a.id            AS ad_id,
  a.current_name  AS ad_name,
  c.current_name  AS campaign_name,
  SUM(aid.spend)     AS total_spend,
  SUM(aid.purchases) AS total_purchases
FROM ad_insight_daily aid
JOIN ads a       ON a.id = aid.ad_id
JOIN campaigns c ON c.id = aid.campaign_id
GROUP BY a.id, a.current_name, c.current_name
HAVING SUM(aid.purchases) = 0 AND SUM(aid.spend) > 5000
ORDER BY total_spend DESC;
