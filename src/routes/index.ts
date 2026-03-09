import { Router } from 'express';
import config from '../config';
import v1Routes from './v1';
import { notFoundHandler } from '../middleware/errorHandler';

const router = Router();

router.use(`/api/${config.apiVersion}`, v1Routes);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use(notFoundHandler);

export default router;
