import type { Task } from '../types';

export const isCompletedTask = (task: Task) => task.status === 'tamamlandı' || (task.status as string) === 'tamamlandi';

