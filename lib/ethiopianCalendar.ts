// lib/ethiopianCalendar.ts

/**
 * Converts a Gregorian Date to Julian Day Number (JDN).
 */
function gregorianToJDN(year: number, month: number, day: number): number {
  let a = Math.floor((14 - month) / 12);
  let y = year + 4800 - a;
  let m = month + 12 * a - 3;
  let jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  return jdn;
}

/**
 * Converts Julian Day Number (JDN) to Ethiopian Date.
 */
function jdnToEthiopian(jdn: number): { year: number; month: number; day: number } {
  // Ethiopian Era (Amete Mihret): JDN offset is 1723856
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  
  const etYear = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const etMonth = Math.floor(n / 30) + 1;
  const etDay = (n % 30) + 1;
  
  return { year: etYear, month: etMonth, day: etDay };
}

/**
 * Converts a Gregorian Date object to Ethiopian Date representation.
 */
export function toEthiopianDate(date: Date): { year: number; month: number; day: number } {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1-indexed for formula
  const day = date.getDate();
  const jdn = gregorianToJDN(year, month, day);
  return jdnToEthiopian(jdn);
}

const ETHIOPIAN_MONTHS_AM = [
  'መስከረም', 'ጥቅምት', 'ህዳር', 'ታኅሣሥ', 'ጥር', 'የካቲት',
  'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'
];

const ETHIOPIAN_MONTHS_EN = [
  'Meskerem', 'Tekemt', 'Hedar', 'Tahsas', 'Ter', 'Yekatit',
  'Megabit', 'Miyazya', 'Genbot', 'Sene', 'Hamle', 'Nehase', 'Pagume'
];

/**
 * Formats a Gregorian Date to an Ethiopian calendar string (e.g. "Sene 2018" or "ሰኔ 2018").
 */
export function formatEthiopianMonthYear(dateString: string | null | undefined, lang: 'en' | 'am'): string {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '—';
    
    const { year, month } = toEthiopianDate(date);
    const monthIndex = month - 1;
    
    if (lang === 'am') {
      const monthName = ETHIOPIAN_MONTHS_AM[monthIndex] || '';
      return `${monthName} ${year}`;
    } else {
      const monthName = ETHIOPIAN_MONTHS_EN[monthIndex] || '';
      return `${monthName} ${year}`;
    }
  } catch {
    return '—';
  }
}
