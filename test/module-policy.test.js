const test = require('node:test');
const assert = require('node:assert/strict');
const {MODULES,normalizeModules,modulesForTenant}=require('../server/module-policy');

test('HI MARKETING always receives every module',()=>{
  assert.deepEqual(modulesForTenant({space_type:'hi_marketing',enabled_modules:[]}),MODULES);
});

test('client modules are filtered, unique and ordered by assignment',()=>{
  assert.deepEqual(normalizeModules(['crm','unknown','crm','proposal']),['crm','proposal']);
});

test('client tenant receives only its enabled modules',()=>{
  assert.deepEqual(modulesForTenant({space_type:'client',enabled_modules:['web','analytics']}),['web','analytics']);
});
