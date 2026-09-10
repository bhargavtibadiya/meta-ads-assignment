import { Router } from 'express';
import { SYNC_PATHS } from '../../utils/constants/routes.js';
import { getStatus, runSync } from './meta-sync.controller.js';

const router = Router();

router.post(SYNC_PATHS.run, runSync);
router.get(SYNC_PATHS.status, getStatus);

export default router;
