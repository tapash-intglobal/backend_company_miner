'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable(
      'zoho_miner_jobs',
      {
        id: {
          allowNull: false,
          primaryKey: true,
          type: Sequelize.CHAR(36),
        },
        lead_id: {
          type: Sequelize.STRING(64),
          allowNull: false,
        },
        website: {
          type: Sequelize.STRING(2048),
          allowNull: true,
        },
        resolved_website: {
          type: Sequelize.STRING(2048),
          allowNull: true,
        },
        company: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        email: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        first_name: {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
        last_name: {
          type: Sequelize.STRING(100),
          allowNull: true,
        },
        status: {
          type: Sequelize.ENUM('queued', 'processing', 'completed', 'failed'),
          allowNull: false,
          defaultValue: 'queued',
        },
        error_message: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        pdf_filename: {
          type: Sequelize.STRING(512),
          allowNull: true,
        },
        zoho_attachment_id: {
          type: Sequelize.STRING(64),
          allowNull: true,
        },
        started_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        completed_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        created_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          allowNull: false,
          type: Sequelize.DATE,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        },
      },
      {
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
      }
    );

    await queryInterface.addIndex('zoho_miner_jobs', ['lead_id'], {
      name: 'zoho_miner_jobs_lead_id_index',
    });
    await queryInterface.addIndex('zoho_miner_jobs', ['status'], {
      name: 'zoho_miner_jobs_status_index',
    });
    await queryInterface.addIndex('zoho_miner_jobs', ['lead_id', 'status', 'created_at'], {
      name: 'zoho_miner_jobs_lead_status_created_index',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('zoho_miner_jobs');
  },
};
