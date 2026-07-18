import { strict as assert } from 'node:assert';
import { validateImportDocument } from '../utils/importValidation';

const valid = {
  backup: { app: 'Ders Rotasi', schemaVersion: 2 },
  appData: {
    courses: [{ id: 'c1', name: 'Matematik' }],
    tasks: [{ id: 't1', courseId: 'c1' }],
    rewards: [], badges: [], successPoints: 0,
    curriculum: {}, weeklySchedule: {},
  },
};
assert.equal(validateImportDocument(valid).ok, true);
assert.equal(validateImportDocument({ ...valid, backup: { ...valid.backup, schemaVersion: 1 } }).ok, false);
assert.equal(validateImportDocument({ ...valid, appData: { ...valid.appData, tasks: [{ id: 't1', courseId: 'missing' }] } }).ok, false);
assert.equal(validateImportDocument({ ...valid, appData: { ...valid.appData, tasks: [{ id: 't1', courseId: 'c1' }, { id: 't1', courseId: 'c1' }] } }).ok, false);
assert.equal(validateImportDocument({ ...valid, appData: { ...valid.appData, successPoints: -1 } }).ok, false);
console.log('IMPORT_VALIDATION_TESTS_OK');
