/**
 * Dates Indian brands plan posts around: festivals, national days and big sale days.
 * The agent sees the ones in the next 60 days and ties posts to those that fit.
 *
 * Fixed-date days are exact. Festivals that follow the lunar calendar move every year:
 * they are listed with an approximate date and marked "around", and the agent is told
 * to have the owner confirm the exact date before posting.
 */

export type CalendarDate = { date: string; name: string; why: string; approx: boolean };

type Fixed = { m: number; d: number; name: string; why: string; approx?: boolean };
type NthWeekday = { m: number; weekday: number; nth: number; name: string; why: string };

/** Same date every year (approx = can shift by a day with the solar calendar). */
const FIXED: Fixed[] = [
  { m: 1, d: 1, name: "New Year's Day", why: "fresh starts, resolutions" },
  { m: 1, d: 13, name: "Lohri", why: "Punjab and North India harvest festival" },
  { m: 1, d: 14, name: "Makar Sankranti / Pongal / Uttarayan", why: "harvest festival across India; big in Tamil Nadu, Gujarat, Karnataka, Andhra", approx: true },
  { m: 1, d: 26, name: "Republic Day", why: "patriotic posts; Republic Day sales run the week before" },
  { m: 2, d: 14, name: "Valentine's Day", why: "gifting, couples; Valentine's week starts Feb 7" },
  { m: 3, d: 8, name: "International Women's Day", why: "celebrate women customers, founders, team" },
  { m: 4, d: 14, name: "Tamil New Year / Vishu / Baisakhi", why: "new year in Tamil Nadu, Kerala and Punjab", approx: true },
  { m: 5, d: 1, name: "Labour Day / Maharashtra Day", why: "thank your team; Maharashtra pride" },
  { m: 6, d: 21, name: "International Yoga Day", why: "health and wellness brands" },
  { m: 8, d: 15, name: "Independence Day", why: "patriotic posts; Independence Day sales" },
  { m: 9, d: 5, name: "Teachers' Day", why: "gifting, gratitude" },
  { m: 10, d: 2, name: "Gandhi Jayanti", why: "simple living, khadi, made in India" },
  { m: 11, d: 14, name: "Children's Day", why: "kids, families, nostalgia" },
  { m: 12, d: 25, name: "Christmas", why: "gifting, year-end celebrations" },
  { m: 12, d: 31, name: "New Year's Eve", why: "parties, year-end offers, thank-you posts" },
];

const NTH_WEEKDAY: NthWeekday[] = [
  { m: 5, weekday: 0, nth: 2, name: "Mother's Day", why: "gifting for mothers" },
  { m: 6, weekday: 0, nth: 3, name: "Father's Day", why: "gifting for fathers" },
  { m: 8, weekday: 0, nth: 1, name: "Friendship Day", why: "friends, sharing, combos" },
];

/** Lunar-calendar festivals and sale seasons (approximate; confirm before posting). */
const MOVING: Record<number, Array<{ date: string; name: string; why: string }>> = {
  2026: [
    { date: "2026-11-08", name: "Diwali", why: "the biggest gifting and shopping festival" },
  ],
  2027: [
    { date: "2027-03-06", name: "Maha Shivaratri", why: "devotional; fasting foods" },
    { date: "2027-03-10", name: "Eid al-Fitr", why: "festive food, new clothes, gifting" },
    { date: "2027-03-22", name: "Holi", why: "colours, sweets, party packs" },
    { date: "2027-04-07", name: "Ugadi / Gudi Padwa", why: "new year in Karnataka, Andhra, Telangana, Maharashtra" },
    { date: "2027-05-17", name: "Eid al-Adha (Bakrid)", why: "festive meals, family gatherings" },
    { date: "2027-08-17", name: "Raksha Bandhan", why: "sibling gifting" },
    { date: "2027-09-04", name: "Ganesh Chaturthi", why: "big in Maharashtra, Karnataka, Andhra" },
    { date: "2027-09-12", name: "Onam", why: "Kerala's harvest festival; sadhya, new clothes" },
    { date: "2027-09-30", name: "Navratri begins", why: "nine nights; garba, fasting foods" },
    { date: "2027-10-09", name: "Dussehra", why: "new beginnings, purchases" },
    { date: "2027-10-27", name: "Dhanteras", why: "buying gold, utensils, new things" },
    { date: "2027-10-29", name: "Diwali", why: "the biggest gifting and shopping festival" },
  ],
};

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function nthWeekday(y: number, m: number, weekday: number, nth: number): number {
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  return 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
}

/** Black Friday = the day after the 4th Thursday of November; Cyber Monday 3 days later. */
function blackFriday(y: number): number {
  return nthWeekday(y, 11, 4, 4) + 1;
}

function datesForYear(y: number): CalendarDate[] {
  const out: CalendarDate[] = [];
  for (const f of FIXED) out.push({ date: ymd(y, f.m, f.d), name: f.name, why: f.why, approx: !!f.approx });
  for (const n of NTH_WEEKDAY) out.push({ date: ymd(y, n.m, nthWeekday(y, n.m, n.weekday, n.nth)), name: n.name, why: n.why, approx: false });
  const bf = blackFriday(y);
  out.push({ date: ymd(y, 11, bf), name: "Black Friday", why: "online sale day; many Indian D2C brands run offers", approx: false });
  out.push({ date: ymd(y, 11, bf + 3), name: "Cyber Monday", why: "online sale day", approx: false });
  for (const m of MOVING[y] ?? []) out.push({ ...m, approx: true });
  return out;
}

/** India date (UTC+5:30) as YYYY-MM-DD. */
function indiaDay(d: Date): string {
  return new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** Dates from today (India) through the next `days` days, soonest first. */
export function upcomingDates(from: Date = new Date(), days = 60): CalendarDate[] {
  const start = indiaDay(from);
  const end = indiaDay(new Date(from.getTime() + days * 86_400_000));
  const y = Number(start.slice(0, 4));
  return [...datesForYear(y), ...datesForYear(y + 1)]
    .filter((c) => c.date >= start && c.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Lines for the agent's context. */
export function calendarBlock(from: Date = new Date(), days = 60): string {
  const list = upcomingDates(from, days);
  if (!list.length) return "";
  return list
    .map((c) => {
      const [y, m, d] = c.date.split("-").map(Number);
      const when = `${d} ${MONTHS[m - 1]} ${y}`;
      return `- ${c.approx ? `around ${when}` : when}: ${c.name} — ${c.why}`;
    })
    .join("\n");
}
