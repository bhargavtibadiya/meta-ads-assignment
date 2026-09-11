export const DEFAULT_INSIGHTS_LOOKBACK_DAYS = 28;
export const DEFAULT_ATTRIBUTION_WINDOWS = '7d_click,1d_view';

export const PURCHASE_ACTION_TYPES: readonly string[] = [
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'purchase',
];

export const META_RATE_LIMIT_ERROR_CODES: readonly number[] = [4, 17, 32, 613];
export const META_MAX_RETRIES = 3;
export const META_LIST_PAGE_LIMIT = 100;
export const META_INSIGHTS_PAGE_LIMIT = 500;
