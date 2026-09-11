# Schema Field Documentation

Source of truth: `app/prisma/schema.prisma` (Prisma 8 PSL contract; Prisma 8 still emits `contract.json` / `contract.d.ts` beside it).

Excludes `id`, `createdAt`, and `updatedAt` on every model unless a field needs a special note. Prisma 8 does not support `@updatedAt`; `updatedAt` is `temporal.updatedAtString()`, an application-side write default. IDs use `@default(cuid(2))` because Prisma 8 rejects legacy `cuid()`.

Physical column names are snake_case via `@map`, so the required `.sql` files can read `campaign_id`, `current_name`, `purchase_value`, and so on.

---

## AdAccount

| Field | Why it exists |
| --- | --- |
| `metaAdAccountId` | **Idempotency key.** Meta's `act_...` id, stored as text because Meta ids are not safe as JS numbers and are never arithmetic. Upserts this table by this value. |
| `name` | Display name at last sync. Not versioned; account renames are out of scope. |
| `currency` | ISO 4217 code (fixture account is `INR`). Every spend/value figure on this account is in this currency. No conversion anywhere. |
| `timezoneName` | IANA timezone Meta uses for insight dates (fixture: `Asia/Kolkata`). Storing it avoids off-by-one-day bugs when comparing to `orders.ordered_at`. |

---

## Campaign

| Field | Why it exists |
| --- | --- |
| `metaCampaignId` | **Idempotency key.** Meta's campaign id. Never changes for the campaign's life, even across renames. Hierarchy sync upserts on this. Insights never group by name. |
| `adAccountId` | FK to `AdAccount`. Scopes campaigns to one ad account. |
| `objective` | Meta objective (e.g. `OUTCOME_SALES`). Informational; Meta rarely lets this change mid-flight, so it is not SCD2-versioned. |
| `currentName` | Denormalized latest name for fast display. Source of truth for history is `CampaignVersion`. |
| `currentStatus` | Denormalized latest configured status. Same reasoning as `currentName`. |
| `metaCreatedTime` | When the campaign was created in Ads Manager, not when we first saw it. Useful for sanity-checking sync completeness. |

---

## CampaignVersion

| Field | Why it exists |
| --- | --- |
| `campaignId` | FK to the stable `Campaign` row. All versions of one campaign share one parent id. |
| `name` | Name during this period. Query 3 can list every name a campaign ever had, while totals still sum by `campaignId`. |
| `status` | Configured status from Meta during this period. |
| `effectiveStatus` | Effective status from Meta (can differ if a parent object pauses delivery). |
| `validFrom` | When this (name, status) combination started being true **as observed by our sync**, not Meta's exact change timestamp. Precision is bounded by sync frequency. |
| `validTo` | `null` means current. Set the moment the next sync observes a change. |

---

## AdSet

| Field | Why it exists |
| --- | --- |
| `metaAdSetId` | **Idempotency key** for this table's upserts. |
| `campaignId` | FK to parent `Campaign`. |
| `currentName` | Latest name; history lives in `AdSetVersion`. |
| `currentStatus` | Latest status; history lives in `AdSetVersion`. |
| `optimizationGoal` | e.g. `OFFSITE_CONVERSIONS`. Informational. |
| `billingEvent` | e.g. `IMPRESSIONS`. Informational. |
| `dailyBudget` | Daily budget in account-currency units. Meta returns this in the account's minor-unit * 100 for some fields on write APIs; insights `spend` is already in whole currency units. This column stores the ad-set budget value as a decimal. Null when the ad set uses lifetime budget or campaign-level CBO. |
| `lifetimeBudget` | Lifetime budget when used instead of daily. |
| `metaCreatedTime` | Created-in-Meta timestamp. |

---

## AdSetVersion

| Field | Why it exists |
| --- | --- |
| `adSetId` | FK to the stable `AdSet` row. |
| `name` | Name during this period. |
| `status` | Configured status during this period. |
| `effectiveStatus` | Effective status during this period (e.g. `CAMPAIGN_PAUSED`). |
| `validFrom` / `validTo` | SCD2 window, same observation-time semantics as `CampaignVersion`. |

---

## Ad

| Field | Why it exists |
| --- | --- |
| `metaAdId` | **Idempotency key** for this table's upserts. Insights rows resolve to the internal `id` through this. |
| `adSetId` | FK to parent `AdSet`. |
| `campaignId` | Denormalized FK straight to `Campaign`. Every required query needs ad → campaign; avoiding a two-hop join through `ad_sets` is deliberate for a reporting-shaped schema. |
| `currentName` | Latest ad name. |
| `currentStatus` | Latest ad status. |
| `creativeMetaId` | Meta creative id, informational only. No local Creative table (creative-level reporting is out of scope). |
| `metaCreatedTime` | Created-in-Meta timestamp. |

---

## AdVersion

| Field | Why it exists |
| --- | --- |
| `adId` | FK to the stable `Ad` row. |
| `name` | Name during this period. |
| `status` | Configured status during this period. |
| `effectiveStatus` | Effective status during this period. |
| `validFrom` / `validTo` | SCD2 window, same observation-time semantics as campaign/ad-set versions. |

---

## AdInsightDaily

| Field | Why it exists |
| --- | --- |
| `adId` | FK to `Ad`. Part of the **idempotency key** `(adId, date)`. |
| `campaignId` | Denormalized FK to `Campaign` so campaign filters/group-bys do not join through `ads`. |
| `adSetId` | Denormalized FK to `AdSet`, same reasoning. |
| `date` | The day this row is for, in the ad account timezone. At `time_increment=1`, Meta's `date_start` equals `date_stop`; we store the single calendar date. |
| `impressions` | Daily impressions for this ad. |
| `clicks` | Daily clicks for this ad. |
| `spend` | Daily spend in account-currency units as Meta returns it (decimal string of whole units, not paise). No `/100` conversion. |
| `purchases` | Count extracted from the `actions` array (`omni_purchase` / `offsite_conversion.fb_pixel_purchase` / `purchase`). |
| `purchaseValue` | Value extracted from `action_values` the same way as `purchases`. |
| `attributionWindows` | e.g. `7d_click,1d_view`, recorded per row. If `META_ATTRIBUTION_WINDOWS` changes later, old rows still document which window produced their numbers. |
| `rawActionsJson` | Full unprocessed `actions` + `action_values` payload so unmapped action types are not lost. |
| `syncedAt` | Last time this exact row was written or overwritten. Answers "how stale is this number" without a separate audit table. |

**Idempotency:** `@@unique([adId, date])`. Every sync upserts on that pair, so re-running never double-counts and restated conversion numbers overwrite the same row.

---

## SyncCursor

| Field | Why it exists |
| --- | --- |
| `adAccountId` | **Idempotency key** (one cursor per ad account). Independent catch-up windows if we ever sync more than one account. |
| `lastSuccessfulSyncAt` | Wall-clock time the last successful run finished. Observability only; not used to compute the fetch window. |
| `lastSyncedThroughDate` | Last calendar date we successfully synced insights through. Combined with `META_INSIGHTS_LOOKBACK_DAYS` (28) this is how the catch-up window is computed, including after downtime. |

---

## SyncRun

| Field | Why it exists |
| --- | --- |
| `entityType` | `HIERARCHY` or `INSIGHTS`. Logged separately because they run as two steps. |
| `status` | `RUNNING` / `SUCCESS` / `FAILED`. |
| `windowStart` / `windowEnd` | Date window for insights runs. Null for hierarchy runs (no date window). |
| `rowsUpserted` | How many rows the run wrote. A second identical run should upsert the same count without growing the table. |
| `errorMessage` | Failure reason when `status = FAILED`. |
| `startedAt` / `finishedAt` | Run duration. `finishedAt` is null while `RUNNING`. |

---

## Order

| Field | Why it exists |
| --- | --- |
| `externalOrderId` | **Idempotency key** from `orders.csv` (`order_id`). Re-running the importer upserts instead of duplicating. |
| `orderedAt` | Order timestamp. **This is the only join axis to Meta data** (truncated to a calendar date). There is no click id / ad id in the CSV, so we do not fabricate a row-level match. |
| `totalAmount` | Order total from the CSV. |
| `currency` | Populated because the synthetic CSV has a currency column (`INR`). Nullable in the schema in case a real export omits it. |
| `utmCampaign` | Optional, imperfect soft join to `campaigns.current_name`. Never used as the default for the Metabase chart. Some fixture rows are blank on purpose. |
| `rawRowJson` | Full original CSV row, so unexpected columns are retained. |
| `importedAt` | When the importer last wrote this row. |
