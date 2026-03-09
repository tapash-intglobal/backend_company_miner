import { Sequelize } from 'sequelize';
import config from './index';
import logger from '../utils/logger';

const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'mysql',
  pool: { min: config.db.poolMin, max: config.db.poolMax, acquire: 30000, idle: 10000 },
  logging: config.env === 'development' ? (sql: string) => logger.debug(sql) : false,
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true,
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
  },
  dialectOptions: { charset: 'utf8mb4', connectTimeout: 60000 },
  timezone: '+00:00',
});

export async function testConnection(): Promise<boolean> {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Database connection failed', { message });
    return false;
  }
}

export async function closeConnection(): Promise<void> {
  try {
    await sequelize.close();
    logger.info('Database connection closed');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Error closing database', { message });
  }
}

export default sequelize;
