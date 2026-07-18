import assert from 'node:assert/strict';
import type { Task } from '../types';
import type { RemoteAppData } from '../utils/firebaseLiveSync';
import { mergeRemoteSections, mergeTaskTombstones, mergeTasksByLatestMutation } from '../utils/remoteSyncMerge';

const task = (id: string, updatedAt: string): Task => ({ id, courseId: 'c1', title: id, dueDate: '2026-07-18', status: 'bekliyor', taskType: 'ders çalışma', plannedDuration: 20, updatedAt });
const oldTime = '2026-07-18T08:00:00.000Z';
const newTime = '2026-07-18T09:00:00.000Z';
const deleteTime = '2026-07-18T10:00:00.000Z';

assert.deepEqual(mergeTasksByLatestMutation([task('local', newTime)], [task('remote', newTime)]).map((item) => item.id).sort(), ['local', 'remote']);
assert.equal(mergeTasksByLatestMutation([], [task('deleted', oldTime)], { deleted: deleteTime }).length, 0);
assert.equal(mergeTasksByLatestMutation([task('restored', '2026-07-18T11:00:00.000Z')], [], { restored: deleteTime }).length, 1);
assert.equal(mergeTaskTombstones({ a: deleteTime }, { a: oldTime }).a, deleteTime);

const base = { courses: [], tasks: [], taskTombstones: {}, performanceData: [], rewards: [], badges: [], successPoints: 0, curriculum: {}, weeklySchedule: {}, schoolTopicHistory: [], examRecords: [], compositeExamResults: [], examScheduleEntries: [], studyPlans: [], planningEngineSnapshot: null } satisfies RemoteAppData;
const local = { ...base, rewards: [{ id: 'local-reward' }] };
const remote = { ...base, curriculum: { Matematik: [{ name: 'Remote unit' }] } };
const merged = mergeRemoteSections(base, local, remote);
assert.deepEqual(merged.rewards, local.rewards);
assert.deepEqual(merged.curriculum, remote.curriculum);
console.log('REMOTE_SYNC_MERGE_TESTS_OK');