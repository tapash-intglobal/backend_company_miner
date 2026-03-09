import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface MasterServiceAttributes {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface MasterServiceCreationAttributes
  extends Optional<
    MasterServiceAttributes,
    'id' | 'description' | 'sortOrder' | 'isActive' | 'createdAt' | 'updatedAt'
  > {}

class MasterService
  extends Model<MasterServiceAttributes, MasterServiceCreationAttributes>
  implements MasterServiceAttributes
{
  public id!: number;
  public name!: string;
  public description!: string | null;
  public sortOrder!: number;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static associate(): void {}
}

MasterService.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    sortOrder: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
      field: 'sort_order',
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_active',
    },
  },
  {
    sequelize,
    tableName: 'master_services',
    underscored: true,
    timestamps: true,
  }
);

export default MasterService;
