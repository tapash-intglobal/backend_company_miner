import sequelize from '../config/database';
import User from './User';
import MasterService from './MasterService';

export interface Models {
  User: typeof User;
  MasterService: typeof MasterService;
  sequelize: typeof sequelize;
}

const models: Models = { User, MasterService, sequelize };

Object.values(models).forEach((model: unknown) => {
  const m = model as { associate?: (models: Models) => void };
  if (typeof m.associate === 'function') m.associate(models);
});

export default models;
