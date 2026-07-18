export const shouldRestoreBundledCurriculum = (search: string) =>
  new URLSearchParams(search).get('reset') === 'math';

export const shouldRunLegacyCleanup = (search: string) =>
  new URLSearchParams(search).get('cleanup') === 'legacy';
