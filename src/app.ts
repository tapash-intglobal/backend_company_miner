import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import config from './config';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimiter';
import logger from './utils/logger';

const app: Application = express();

app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

if (config.env !== 'test') {
  app.use(
    morgan('combined', {
      stream: { write: (msg: string) => logger.info(msg.trim()) },
    })
  );
}

app.use(apiRateLimiter);
app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
