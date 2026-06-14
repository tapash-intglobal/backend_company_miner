import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import { ZohoMinerJobStatus } from '../types/zoho';

interface ZohoMinerJobAttributes {
  id: string;
  leadId: string;
  website: string | null;
  resolvedWebsite: string | null;
  company: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  status: ZohoMinerJobStatus;
  errorMessage: string | null;
  pdfFilename: string | null;
  zohoAttachmentId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ZohoMinerJobCreationAttributes
  extends Optional<
    ZohoMinerJobAttributes,
    | 'id'
    | 'website'
    | 'resolvedWebsite'
    | 'company'
    | 'email'
    | 'firstName'
    | 'lastName'
    | 'status'
    | 'errorMessage'
    | 'pdfFilename'
    | 'zohoAttachmentId'
    | 'startedAt'
    | 'completedAt'
    | 'createdAt'
    | 'updatedAt'
  > {}

class ZohoMinerJob
  extends Model<ZohoMinerJobAttributes, ZohoMinerJobCreationAttributes>
  implements ZohoMinerJobAttributes
{
  public id!: string;
  public leadId!: string;
  public website!: string | null;
  public resolvedWebsite!: string | null;
  public company!: string | null;
  public email!: string | null;
  public firstName!: string | null;
  public lastName!: string | null;
  public status!: ZohoMinerJobStatus;
  public errorMessage!: string | null;
  public pdfFilename!: string | null;
  public zohoAttachmentId!: string | null;
  public startedAt!: Date | null;
  public completedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static associate(): void {}
}

ZohoMinerJob.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    leadId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: 'lead_id',
    },
    website: {
      type: DataTypes.STRING(2048),
      allowNull: true,
    },
    resolvedWebsite: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      field: 'resolved_website',
    },
    company: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'first_name',
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: 'last_name',
    },
    status: {
      type: DataTypes.ENUM(...Object.values(ZohoMinerJobStatus)),
      allowNull: false,
      defaultValue: ZohoMinerJobStatus.QUEUED,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message',
    },
    pdfFilename: {
      type: DataTypes.STRING(512),
      allowNull: true,
      field: 'pdf_filename',
    },
    zohoAttachmentId: {
      type: DataTypes.STRING(64),
      allowNull: true,
      field: 'zoho_attachment_id',
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'started_at',
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
    },
  },
  {
    sequelize,
    tableName: 'zoho_miner_jobs',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['lead_id'] },
      { fields: ['status'] },
      { fields: ['lead_id', 'status', 'created_at'] },
    ],
  }
);

export default ZohoMinerJob;
