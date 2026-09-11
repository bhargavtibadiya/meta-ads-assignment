export const ROUTES = {
  root: '/',
  health: '/health',
  apiSync: '/api/sync',
  apiOrders: '/api/orders',
} as const;

export const SYNC_PATHS = {
  run: '/run',
  status: '/status',
} as const;

export const ORDERS_PATHS = {
  import: '/import',
  list: '/',
} as const;
