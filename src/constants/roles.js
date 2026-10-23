// User roles allowed in the system.

const ROLES = {
  MANAGER: 'manager',
  SUPPORT: 'support',
  TECHNICIAN: 'technician',
};

const ALL_ROLES = Object.values(ROLES);

module.exports = { ROLES, ALL_ROLES };
