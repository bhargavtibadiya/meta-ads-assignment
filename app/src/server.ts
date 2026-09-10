import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import healthRoutes from './modules/health/health.routes.js';
import metaSyncRoutes from './modules/meta-sync/meta-sync.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import { ROUTES } from './utils/constants/routes.js';
import { logger } from './utils/helpers/logger.js';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const resourcesDir = path.join(currentDir, 'resources');

const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.static(resourcesDir));

app.use(ROUTES.apiSync, metaSyncRoutes);
app.use(ROUTES.apiOrders, ordersRoutes);
app.use(healthRoutes);

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info('server listening', {
    port: env.PORT,
    dataSource: env.META_DATA_SOURCE,
    nodeEnv: env.NODE_ENV,
  });
});
