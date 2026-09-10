import { Router } from 'express';
import { ROUTES } from '../../utils/constants/routes.js';
import { getHealth, getStatusPage } from './health.controller.js';

const router = Router();

router.get(ROUTES.health, getHealth);
router.get(ROUTES.root, getStatusPage);

export default router;
