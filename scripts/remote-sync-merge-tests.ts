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

// record-level section merge: independent edits from different devices must survive together.
const richBase = {
  ...base,
  courses: [
    { id: 'math', name: 'Matematik', active: true, order: 0, icon: 'calculator' },
    { id: 'science', name: 'Fen', active: true, order: 1, icon: 'flask' },
  ],
  curriculum: {
    Matematik: [{ name: 'Sayılar', topics: [{ name: 'Çarpanlar', completed: false }] }],
  },
  weeklySchedule: {
    Pazartesi: {
      confirmed: true,
      slots: [{ id: 'slot-math', courseName: 'Matematik', startTime: '18:00', endTime: '18:30' }],
      availableWindows: [],
    },
  },
} satisfies RemoteAppData;

const richLocal = {
  ...richBase,
  courses: [...richBase.courses.map((course) => course.id === 'math' ? { ...course, name: 'Matematik 8' } : course), { id: 'turkish', name: 'Türkçe', active: true, order: 2, icon: 'book' }],
  curriculum: {
    Matematik: [{
      name: 'Sayılar',
      topics: [
        { name: 'Çarpanlar', completed: false },
        { name: 'Üslü İfadeler', completed: false },
      ],
    }],
  },
  weeklySchedule: {
    Pazartesi: {
      ...richBase.weeklySchedule.Pazartesi,
      slots: [
        ...richBase.weeklySchedule.Pazartesi.slots,
        { id: 'slot-turkish', courseName: 'Türkçe', startTime: '19:00', endTime: '19:30' },
      ],
    },
  },
} satisfies RemoteAppData;

const richRemote = {
  ...richBase,
  courses: [richBase.courses[0], { ...richBase.courses[1], active: false }, { id: 'english', name: 'İngilizce', active: true, order: 3, icon: 'languages' }],
  curriculum: {
    Matematik: [
      ...richBase.curriculum.Matematik,
      { name: 'Geometri', topics: [{ name: 'Üçgenler', completed: false }] },
    ],
  },
  weeklySchedule: {
    Pazartesi: {
      ...richBase.weeklySchedule.Pazartesi,
      confirmed: false,
      slots: [
        ...richBase.weeklySchedule.Pazartesi.slots,
        { id: 'slot-english', courseName: 'İngilizce', startTime: '20:00', endTime: '20:30' },
      ],
    },
  },
} satisfies RemoteAppData;

const richMerged = mergeRemoteSections(richBase, richLocal, richRemote);
assert.deepEqual((richMerged.courses as any[]).map((item) => item.id).sort(), ['english', 'math', 'science', 'turkish']);
const mergedMath = (richMerged.courses as any[]).find((item) => item.id === 'math');
const mergedScience = (richMerged.courses as any[]).find((item) => item.id === 'science');
assert.equal(mergedMath.name, 'Matematik 8');
assert.equal(mergedScience.active, false);
assert.deepEqual(
  (richMerged.curriculum.Matematik as any[]).map((unit) => unit.name).sort(),
  ['Geometri', 'Sayılar'],
);
assert.deepEqual(
  ((richMerged.curriculum.Matematik as any[]).find((unit) => unit.name === 'Sayılar').topics as any[])
    .map((topic) => topic.name).sort(),
  ['Çarpanlar', 'Üslü İfadeler'],
);
assert.deepEqual(
  ((richMerged.weeklySchedule.Pazartesi as any).slots as any[]).map((slot) => slot.id).sort(),
  ['slot-english', 'slot-math', 'slot-turkish'],
);

assert.equal((richMerged.weeklySchedule.Pazartesi as any).confirmed, false);

// A local deletion relative to the shared base is intentional and must not be resurrected by stale remote data.
const deleteLocal = { ...richBase, courses: richBase.courses.filter((course) => course.id !== 'science') };
const deleteMerged = mergeRemoteSections(richBase, deleteLocal, richBase);
assert.deepEqual((deleteMerged.courses as any[]).map((item) => item.id).sort(), ['math']);
console.log('REMOTE_SYNC_MERGE_TESTS_OK');