'use strict';

const bcrypt = require('bcryptjs');

const DEFAULT_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const hashed = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);
    const now = new Date();
    await queryInterface.bulkInsert('users', [
      {
        email: process.env.SEED_ADMIN_EMAIL || 'admin@companyminer.local',
        password: hashed,
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('users', {
      email: process.env.SEED_ADMIN_EMAIL || 'admin@companyminer.local',
    });
  },
};
