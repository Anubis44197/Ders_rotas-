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