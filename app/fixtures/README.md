# Fixture payloads (Option B)

These files stand in for live Meta Marketing API responses because a Meta developer app / test ad account could not be created. They are shaped like Graph API list payloads (`{ "data": [ ... ] }`).

## Files

| File | Mimics |
| --- | --- |
| `account.json` | `GET /act_{id}?fields=name,currency,timezone_name` |
| `campaigns.json` | `GET /act_{id}/campaigns` |
| `adsets.json` | `GET /act_{id}/adsets` |
| `ads.json` | `GET /act_{id}/ads` |
| `insights.json` | `GET /act_{id}/insights?level=ad&time_increment=1` |
| `orders.csv` | Synthetic store orders (the assignment's `orders.csv` was not provided) |
| `campaign-rename.json` | Documented SCD2 rename for Query 3 |

## Campaign rename (Query 3)

Campaign `23811111111111111` is currently named **Summer Sale 2026**. Until 2026-08-27 it was named **June Promo 2026**. Insights rows keep using the same `campaign_id`; the name change lives in `campaign_versions` after the hierarchy sync observes it (see `campaign-rename.json`).

## Zero-purchase high-spend ad (Query 4)

Ad `23853333333333331` (Awareness Static) reports spend and zero `omni_purchase` actions. Across the fixture window its spend is above ₹5,000.

## Attribution window

All insight rows assume `7d_click,1d_view`, matching `META_ATTRIBUTION_WINDOWS`.
