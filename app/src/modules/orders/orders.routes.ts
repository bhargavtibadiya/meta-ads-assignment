import { Router } from 'express';
import { ORDERS_PATHS } from '../../utils/constants/routes.js';
import { importOrders, listOrders } from './orders.controller.js';

const router = Router();

router.post(ORDERS_PATHS.import, importOrders);
router.get(ORDERS_PATHS.list, listOrders);

export default router;
