export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export type ImportValidationResult =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const hasUniqueStringIds = (items: unknown[]) => {
  const ids = items.map((item) => isRecord(item) ? item.id : undefined);
  return ids.every((id) => typeof id === 'string' && id.trim().length > 0)
    && new Set(ids).size === ids.length;
};

export const validateImportDocument = (document: unknown): ImportValidationResult => {
  if (!isRecord(document)) return { ok: false, error: 'Yedek kök verisi bir nesne olmalı.' };
  const wrapped = isRecord(document.appData);
  if (wrapped) {
    const backup = document.backup;
    if (!isRecord(backup) || backup.schemaVersion !== 2 || backup.app !== 'Ders Rotasi') {
      return { ok: false, error: 'Yedek üst bilgisi veya şema sürümü geçersiz.' };
    }
  }
  const payload = (wrapped ? document.appData : document) as Record<string, unknown>;
  const requiredArrays = ['courses', 'tasks', 'rewards', 'badges'] as const;
  const optionalArrays = ['performanceData', 'schoolTopicHistory', 'examRecords', 'compositeExamResults', 'examScheduleEntries', 'studyPlans'] as const;
  for (const key of requiredArrays) {
    if (!Array.isArray(payload[key])) return { ok: false, error: `${key} alanı dizi olmalı.` };
  }
  for (const key of optionalArrays) {
    if (payload[key] !== undefined && !Array.isArray(payload[key])) return { ok: false, error: `${key} alanı dizi olmalı.` };
  }
  if (!Number.isFinite(Number(payload.successPoints)) || Number(payload.successPoints) < 0) {
    return { ok: false, error: 'successPoints geçerli, negatif olmayan bir sayı olmalı.' };
  }
  if (payload.curriculum !== undefined && !isRecord(payload.curriculum)) return { ok: false, error: 'curriculum alanı nesne olmalı.' };
  if (payload.weeklySchedule !== undefined && !isRecord(payload.weeklySchedule)) return { ok: false, error: 'weeklySchedule alanı nesne olmalı.' };
  if (!hasUniqueStringIds(payload.courses as unknown[])) return { ok: false, error: 'Ders kimlikleri boş veya tekrarlı.' };
  if (!hasUniqueStringIds(payload.tasks as unknown[])) return { ok: false, error: 'Görev kimlikleri boş veya tekrarlı.' };
  const courseIds = new Set((payload.courses as Array<Record<string, unknown>>).map((course) => course.id));
  const orphanTask = (payload.tasks as Array<Record<string, unknown>>).find((task) => typeof task.courseId !== 'string' || !courseIds.has(task.courseId));
  if (orphanTask) return { ok: false, error: 'Bir veya daha fazla görev geçersiz bir derse bağlı.' };
  return { ok: true, payload };
};
