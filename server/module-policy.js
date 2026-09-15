const MODULES = Object.freeze([
  'crm',
  'hunter',
  'web',
  'designer',
  'automation',
  'analytics',
  'proposal',
  'knowledge'
]);

const DEFAULT_CLIENT_MODULES = Object.freeze(['crm', 'web', 'analytics', 'proposal']);

function normalizeModules(value, fallback = DEFAULT_CLIENT_MODULES) {
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.filter((item) => MODULES.includes(item)))];
}

function modulesForTenant(tenant) {
  if (tenant?.space_type === 'hi_marketing') return [...MODULES];
  return normalizeModules(tenant?.enabled_modules);
}

module.exports = { MODULES, DEFAULT_CLIENT_MODULES, normalizeModules, modulesForTenant };
