-- Total spend for a campaign whose name changed mid-flight, correctly
-- totalled across the rename.
--
-- The "trick" the spec warns about: if insights were ever keyed/grouped by
-- campaign NAME instead of the campaign's stable internal id, a rename would
-- silently split one campaign's history into two buckets. Our schema avoids
-- this entirely -- ad_insight_daily.campaign_id is the immutable internal id
-- (campaigns.id), which never changes on rename. So the correct query is
-- just a plain sum by that id -- no special-case UNION or name-matching
-- logic is needed, which is the point of modeling it this way.
--
-- This also surfaces every name the campaign has ever had, for context.
-- Replace :campaign_id with campaigns.id (for the fixture rename, that is
-- the campaign currently named "Summer Sale 2026" / previously "June Promo 2026").
SELECT
  c.id                                                        AS campaign_id,
  (SELECT string_agg(DISTINCT cv.name, ' -> ' ORDER BY cv.name)
     FROM campaign_versions cv WHERE cv.campaign_id = c.id)    AS all_known_names,
  SUM(aid.spend)                                               AS total_spend_across_all_names
FROM ad_insight_daily aid
JOIN campaigns c ON c.id = aid.campaign_id
WHERE c.id = :campaign_id
GROUP BY c.id;
