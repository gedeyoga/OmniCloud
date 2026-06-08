import { Router } from 'express';
import { redactEnv } from '../config/env.js';
import { getLastSyncReport } from '../services/syncService.js';

const router = Router();

router.get('/health', (_req, res) => {
	res.json({
		status: 'ok',
		service: 'omnicloud-api',
		config: redactEnv(),
		sync: getLastSyncReport(),
		timestamp: new Date().toISOString(),
	});
});

export default router;
