/**
 * Pakistan public holidays — used by the response-deadline engine
 * (lib/response-deadline.ts) so a "business day" is a day companies in
 * Pakistan can actually be expected to work: Monday–Friday AND not a
 * public holiday. Without this, an application submitted just before
 * Eid could be marked "No response" while the whole country was on
 * holiday — unfair to employers and wrong for candidates.
 *
 * Dates are Karachi calendar dates ("yyyy-mm-dd"). The lookup uses the
 * same representation as lib/response-deadline.ts's karachiDateMs():
 * the UTC timestamp of that calendar date's midnight.
 *
 * MAINTENANCE — READ BEFORE EDITING:
 * - Fixed national days (Kashmir Day, Pakistan Day, Labour Day,
 *   Youm-e-Takbeer, Independence Day, Quaid-e-Azam Day/Christmas) fall
 *   on the same Gregorian date every year.
 * - Islamic holidays (Eid ul-Fitr, Eid ul-Adha, Ashura, Eid
 *   Milad-un-Nabi) follow the Hijri calendar and depend on the official
 *   moon sighting by the Ruet-e-Hilal Committee. The dates below are
 *   the EXPECTED Gregorian dates from published calendars and may
 *   shift by ±1 day once the government notification is issued.
 * - This list must be reviewed every year against the Government of
 *   Pakistan's official holiday notification (usually published in
 *   December/January) and extended with the next year's dates.
 * - If a date is missing from this list it simply counts as a business
 *   day (fail-soft): the rule degrades to the old Mon–Fri behaviour
 *   rather than breaking.
 */

export interface PakistanHoliday {
  /** Karachi calendar date, "yyyy-mm-dd". */
  date: string;
  name: string;
}

/** Fixed national days — the same Gregorian dates every year. */
function fixedDays(year: number): PakistanHoliday[] {
  const y = String(year);
  return [
    { date: `${y}-02-05`, name: "Kashmir Day" },
    { date: `${y}-03-23`, name: "Pakistan Day" },
    { date: `${y}-05-01`, name: "Labour Day" },
    { date: `${y}-05-28`, name: "Youm-e-Takbeer" },
    { date: `${y}-08-14`, name: "Independence Day" },
    { date: `${y}-12-25`, name: "Quaid-e-Azam Day / Christmas" },
  ];
}

/**
 * Islamic holidays — EXPECTED Gregorian dates (moon-dependent, may
 * shift ±1 day with the official sighting; see header note).
 * Eid ul-Fitr and Eid ul-Adha are 3 days each, Ashura is 2 days
 * (9–10 Muharram), Eid Milad-un-Nabi is 1 day (12 Rabi-ul-Awwal).
 */
const ISLAMIC_HOLIDAYS: readonly PakistanHoliday[] = [
  // ── 2025 ──
  { date: "2025-03-31", name: "Eid ul-Fitr (day 1)" },
  { date: "2025-04-01", name: "Eid ul-Fitr (day 2)" },
  { date: "2025-04-02", name: "Eid ul-Fitr (day 3)" },
  { date: "2025-06-07", name: "Eid ul-Adha (day 1)" },
  { date: "2025-06-08", name: "Eid ul-Adha (day 2)" },
  { date: "2025-06-09", name: "Eid ul-Adha (day 3)" },
  { date: "2025-07-05", name: "Ashura (9th Muharram)" },
  { date: "2025-07-06", name: "Ashura (10th Muharram)" },
  { date: "2025-09-05", name: "Eid Milad-un-Nabi" },
  // ── 2026 ──
  { date: "2026-03-20", name: "Eid ul-Fitr (day 1)" },
  { date: "2026-03-21", name: "Eid ul-Fitr (day 2)" },
  { date: "2026-03-22", name: "Eid ul-Fitr (day 3)" },
  { date: "2026-05-27", name: "Eid ul-Adha (day 1)" },
  // 2026-05-28 is also Youm-e-Takbeer (fixed list) — same day, one holiday.
  { date: "2026-05-28", name: "Eid ul-Adha (day 2)" },
  { date: "2026-05-29", name: "Eid ul-Adha (day 3)" },
  { date: "2026-06-25", name: "Ashura (9th Muharram)" },
  { date: "2026-06-26", name: "Ashura (10th Muharram)" },
  { date: "2026-08-25", name: "Eid Milad-un-Nabi" },
  // ── 2027 ──
  { date: "2027-03-10", name: "Eid ul-Fitr (day 1)" },
  { date: "2027-03-11", name: "Eid ul-Fitr (day 2)" },
  { date: "2027-03-12", name: "Eid ul-Fitr (day 3)" },
  { date: "2027-05-17", name: "Eid ul-Adha (day 1)" },
  { date: "2027-05-18", name: "Eid ul-Adha (day 2)" },
  { date: "2027-05-19", name: "Eid ul-Adha (day 3)" },
  { date: "2027-06-14", name: "Ashura (9th Muharram)" },
  { date: "2027-06-15", name: "Ashura (10th Muharram)" },
  { date: "2027-08-15", name: "Eid Milad-un-Nabi" },
];

/** Every listed holiday for 2025–2027 (fixed + Islamic), for review/tests. */
export const PAKISTAN_HOLIDAYS: readonly PakistanHoliday[] = [
  ...fixedDays(2025),
  ...fixedDays(2026),
  ...fixedDays(2027),
  ...ISLAMIC_HOLIDAYS,
];

/** "yyyy-mm-dd" → the UTC ms of that date's midnight (karachiDateMs form). */
function holidayDateMs(isoDate: string): number {
  const [y = 0, m = 0, d = 0] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

const HOLIDAY_DATE_MS: ReadonlySet<number> = new Set(
  PAKISTAN_HOLIDAYS.map((h) => holidayDateMs(h.date)),
);

/**
 * Is the given Karachi calendar date a Pakistan public holiday?
 * `dateMs` must use the karachiDateMs() representation from
 * lib/response-deadline.ts (UTC ms of the calendar date's midnight).
 */
export function isPakistanHoliday(dateMs: number): boolean {
  return HOLIDAY_DATE_MS.has(dateMs);
}
