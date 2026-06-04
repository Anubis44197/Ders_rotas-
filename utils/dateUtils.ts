// Timezone-safe date utilities

/**
 * Get local date string in YYYY-MM-DD format
 * Avoids timezone issues with toISOString()
 */
export const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get formatted date string for display (Turkish locale)
 */
export const getDisplayDateString = (date: Date): string => {
  return date.toLocaleDateString('tr-TR', { 
    day: '2-digit', 
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Get short display date (DD/MM format)
 */
export const getShortDisplayDate = (date: Date): string => {
  return date.toLocaleDateString('tr-TR', { 
    day: '2-digit', 
    month: '2-digit'
  });
};

/**
 * Parse date string safely to Date object
 */
export const parseDate = (dateString: string): Date => {
  // Handle YYYY-MM-DD format specifically to avoid timezone issues
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Check if two dates are the same day (ignoring time)
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return getLocalDateString(date1) === getLocalDateString(date2);
};

/**
 * Get date N days ago
 */
export const getDaysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

/**
 * Get today's date string
 */
export const getTodayString = (): string => {
  return getLocalDateString();
};
export const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const getLocalMonthKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

export const getLocalYearKey = (date: Date): string => String(date.getFullYear());

export const getLocalWeekKey = (date: Date): string => {
  const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const firstDay = new Date(localDate.getFullYear(), 0, 1);
  const days = Math.floor((localDate.getTime() - firstDay.getTime()) / 86400000);
  const week = Math.ceil((days + firstDay.getDay() + 1) / 7);
  return `${localDate.getFullYear()}-H${week}`;
};

export const isDateKeyInRange = (value: string | undefined, start?: string | null, end?: string | null): boolean => {
  if (!value) return false;
  if (start && value < start) return false;
  if (end && value > end) return false;
  return true;
};