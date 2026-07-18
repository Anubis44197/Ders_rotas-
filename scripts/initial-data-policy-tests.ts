import assert from 'node:assert/strict';
import { shouldRestoreBundledCurriculum, shouldRunLegacyCleanup } from '../utils/initialDataPolicy';

assert.equal(shouldRestoreBundledCurriculum(''), false);
assert.equal(shouldRestoreBundledCurriculum('?quick=analysis'), false);
assert.equal(shouldRestoreBundledCurriculum('?e2e=1&qaRecords=manual'), false);
assert.equal(shouldRestoreBundledCurriculum('?reset=other'), false);
assert.equal(shouldRestoreBundledCurriculum('?reset=math'), true);
assert.equal(shouldRestoreBundledCurriculum('?quick=planning&reset=math'), true);
assert.equal(shouldRunLegacyCleanup(''), false);
assert.equal(shouldRunLegacyCleanup('?quick=planning'), false);
assert.equal(shouldRunLegacyCleanup('?cleanup=legacy'), true);
console.log('INITIAL_DATA_POLICY_TESTS_OK');