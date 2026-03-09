import config from './config';
import logger from './utils/logger';
import sequelize from './config/database';
import './models';
import app from './app';

const startServer = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port} (${config.env})`);
      logger.info(`API: http://localhost:${config.port}/api/${config.apiVersion}`);
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to start server', { message });
    process.exit(1);
  }
};

startServer();

const shutdown = async (): Promise<void> => {
  logger.info('Shutting down');
  try {
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Error during shutdown', { message });
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
