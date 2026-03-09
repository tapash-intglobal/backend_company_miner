'use strict';

const MASTER_SERVICES = [
  { name: 'Digital Engineering / Software Development', sort_order: 1 },
  { name: 'Customer Experience & Digital Platforms', sort_order: 2 },
  { name: 'AI, Data & Analytics', sort_order: 3 },
  { name: 'Cloud Services & DevOps', sort_order: 4 },
  { name: 'Cybersecurity', sort_order: 5 },
  { name: 'Digital Marketing & Martech', sort_order: 6 },
  { name: 'Managed IT Services', sort_order: 7 },
  { name: 'Enterprise Consulting & Integration', sort_order: 8 },
];

module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    await queryInterface.bulkInsert(
      'master_services',
      MASTER_SERVICES.map((s) => ({
        name: s.name,
        description: null,
        sort_order: s.sort_order,
        is_active: true,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('master_services', null, {});
  },
};
