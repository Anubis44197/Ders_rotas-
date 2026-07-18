import assert from 'node:assert/strict';
import { getReportPeriodDayCount, getReportPeriodStart, isDateInReportPeriod } from '../utils/reportPeriod';

const now = new Date('2026-07-18T16:45:00');
const cases = [
  ['Haftalık', 7, '2026-07-12', '2026-07-11'],
  ['Aylık', 30, '2026-06-19', '2026-06-18'],
  ['2 Aylık', 60, '2026-05-20', '2026-05-19'],
  ['3 Aylık', 90, '2026-04-20', '2026-04-19'],
] as const;

for (const [period, days, firstIncluded, firstExcluded] of cases) {
  assert.equal(getReportPeriodDayCount(period), days);
  assert.equal(isDateInReportPeriod('2026-07-18', period, now), true);
  assert.equal(isDateInReportPeriod(firstIncluded, period, now), true);
  assert.equal(isDateInReportPeriod(firstExcluded, period, now), false);
  assert.equal(isDateInReportPeriod('2026-07-19', period, now), false);
  assert.equal(getReportPeriodStart(period, now)?.getHours(), 0);
}

assert.equal(isDateInReportPeriod('2020-01-01', 'Tüm Zamanlar', now), true);
assert.equal(isDateInReportPeriod(undefined, 'Tüm Zamanlar', now), false);
assert.equal(isDateInReportPeriod('geçersiz', 'Aylık', now), false);
assert.equal(isDateInReportPeriod('geçersiz', 'Tüm Zamanlar', now), false);
console.log('REPORT_PERIOD_TESTS_OK');