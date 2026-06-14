import sequelize from '../config/database';
import User from './User';
import MasterService from './MasterService';
import ZohoMinerJob from './ZohoMinerJob';

export interface Models {
  User: typeof User;
  MasterService: typeof MasterService;
  ZohoMinerJob: typeof ZohoMinerJob;
  sequelize: typeof sequelize;
}

const models: Models = { User, MasterService, ZohoMinerJob, sequelize };

Object.values(models).forEach((model: unknown) => {
  const m = model as { associate?: (models: Models) => void };
  if (typeof m.associate === 'function') m.associate(models);
});

export default models;
