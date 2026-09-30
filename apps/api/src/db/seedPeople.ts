import lookups from "../lookups";

const GENERATOR_SEED = 20260930;
const PEOPLE = 10_000;
const LEAVE_DATE = "2026-09-01";
const SHARED_NAME = "Amina Shah";
const GIVEN_NAMES = ["Bao", "Chiara", "Diego", "Elena", "Farid", "Greta", "Hiro", "Ines", "Jonah", "Kira"];
const FAMILY_NAMES = ["Nguyen", "Rossi", "Keller", "Okeke", "Berg", "Iyer", "Costa", "Novak", "Adeyemi", "Vogel"];

export type SeedEmployee = {
  employee_id: string;
  legal_name: string;
  country: string;
  currency: string;
  level: string;
  annual_base: string;
  status: string;
  leave_date: string | null;
  department: string | null;
  manager_employee_id: string | null;
  start_date: string | null;
};

export type SeedHistory = {
  employeeId: string;
  daysAgo: number;
  oldBase: string;
  newBase: string;
  oldCountry: string | null;
  newCountry: string;
  oldStatus: string;
  newStatus: string;
  note: string;
};

const PAY_ID = employeeIdAt(0);
const MOVE_ID = employeeIdAt(1);
const LEAVE_ID = employeeIdAt(2);
const SHARED_IDS = [employeeIdAt(3), employeeIdAt(4)];

const HISTORY: SeedHistory[] = [
  {
    employeeId: PAY_ID,
    daysAgo: 40,
    oldBase: "120000.00",
    newBase: "140000.00",
    oldCountry: null,
    newCountry: "India",
    oldStatus: "active",
    newStatus: "active",
    note: "Earlier pay adjustment",
  },
  {
    employeeId: PAY_ID,
    daysAgo: 10,
    oldBase: "140000.00",
    newBase: "150000.00",
    oldCountry: null,
    newCountry: "India",
    oldStatus: "active",
    newStatus: "active",
    note: "Annual pay review",
  },
  {
    employeeId: MOVE_ID,
    daysAgo: 7,
    oldBase: "80000.00",
    newBase: "90000.00",
    oldCountry: "India",
    newCountry: "Germany",
    oldStatus: "active",
    newStatus: "active",
    note: "Country move to Germany",
  },
  {
    employeeId: LEAVE_ID,
    daysAgo: 2,
    oldBase: "72000.00",
    newBase: "72000.00",
    oldCountry: null,
    newCountry: "United States",
    oldStatus: "active",
    newStatus: "left",
    note: "Employment ended",
  },
];

export function seedHistory(): SeedHistory[] {
  assertHistory();
  return HISTORY;
}

export function buildSeedPeople(): SeedEmployee[] {
  assertHistory();
  const rows = generate();
  applyStories(rows);
  assertPeople(rows);
  return rows;
}

function employeeIdAt(index: number): string {
  return `E${String(index + 1).padStart(5, "0")}`;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function currencyFor(country: string): string {
  const match = lookups.countries.find((item) => item.name === country);
  if (!match) throw new Error(`Unknown country ${country}`);
  return match.currency;
}

function personName(index: number, rng: () => number): string {
  const given = GIVEN_NAMES[Math.floor(rng() * GIVEN_NAMES.length)] ?? GIVEN_NAMES[0];
  const family = FAMILY_NAMES[Math.floor(rng() * FAMILY_NAMES.length)] ?? FAMILY_NAMES[0];
  return `${given} ${family} ${String(index + 1).padStart(5, "0")}`;
}

function annualBaseFrom(rng: () => number): string {
  const whole = 30_000 + Math.floor(rng() * 120_000);
  const cents = Math.floor(rng() * 100);
  return `${whole}.${String(cents).padStart(2, "0")}`;
}

function startDate(index: number): string {
  const year = 2015 + (index % 10);
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String((index % 27) + 1).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function generate(): SeedEmployee[] {
  const rng = mulberry32(GENERATOR_SEED);
  const rows: SeedEmployee[] = [];
  for (let index = 0; index < PEOPLE; index += 1) {
    const country = lookups.countries[index % lookups.countries.length];
    const level = lookups.levels[index % lookups.levels.length];
    if (!country || !level) throw new Error("lookups are empty");
    const left = index % 47 === 7;
    const department = lookups.departments[index % lookups.departments.length];
    if (!department) throw new Error("lookups are empty");
    rows.push({
      employee_id: employeeIdAt(index),
      legal_name: personName(index, rng),
      country: country.name,
      currency: country.currency,
      level,
      annual_base: annualBaseFrom(rng),
      status: left ? "left" : "active",
      leave_date: left ? LEAVE_DATE : null,
      department: index % 19 === 0 ? null : department,
      manager_employee_id: index % 13 === 0 ? null : employeeIdAt((index + 17) % PEOPLE),
      start_date: index % 11 === 3 ? null : startDate(index),
    });
  }
  return rows;
}

function latestFor(employeeId: string): SeedHistory {
  const latest = HISTORY.filter((row) => row.employeeId === employeeId).reduce<SeedHistory | undefined>(
    (best, row) => (!best || row.daysAgo < best.daysAgo ? row : best),
    undefined,
  );
  if (!latest) throw new Error(`no history for ${employeeId}`);
  return latest;
}

function applyStories(rows: SeedEmployee[]): void {
  for (const employeeId of [PAY_ID, MOVE_ID, LEAVE_ID]) {
    const change = latestFor(employeeId);
    const row = must(rows, employeeId);
    row.country = change.newCountry;
    row.currency = currencyFor(change.newCountry);
    row.annual_base = change.newBase;
    row.status = change.newStatus;
    row.leave_date = change.newStatus === "left" ? LEAVE_DATE : null;
  }
  for (const employeeId of SHARED_IDS) must(rows, employeeId).legal_name = SHARED_NAME;
}

function must(rows: SeedEmployee[], employeeId: string): SeedEmployee {
  const row = rows.find((item) => item.employee_id === employeeId);
  if (!row) throw new Error(`missing ${employeeId}`);
  return row;
}

function assertHistory(): void {
  const recent = HISTORY.filter((row) => row.daysAgo < 30);
  const older = HISTORY.filter((row) => row.daysAgo > 30);
  if (recent.length !== 3 || older.length !== 1) throw new Error("expected three recent changes and one older change");
  if (!recent.some((row) => row.oldBase !== row.newBase && row.oldCountry === null && row.oldStatus === row.newStatus)) {
    throw new Error("missing pay change");
  }
  if (!recent.some((row) => row.oldCountry !== null && row.oldCountry !== row.newCountry)) {
    throw new Error("missing country move");
  }
  if (!recent.some((row) => row.oldStatus === "active" && row.newStatus === "left" && row.oldBase === row.newBase)) {
    throw new Error("missing end of employment");
  }
  const olderRow = older[0];
  if (!olderRow || !recent.some((row) => row.employeeId === olderRow.employeeId)) {
    throw new Error("older change is not on a person who also changed recently");
  }
  const pay = HISTORY.filter((row) => row.employeeId === PAY_ID).sort((a, b) => b.daysAgo - a.daysAgo);
  for (let index = 1; index < pay.length; index += 1) {
    const previous = pay[index - 1];
    const current = pay[index];
    if (!previous || !current || current.oldBase !== previous.newBase) throw new Error("pay history does not chain");
  }
  for (const row of HISTORY) {
    if (!row.note.trim() || row.note.length > 1000) throw new Error("history note is empty");
    if (!/^\d+\.\d{2}$/.test(row.oldBase) || !/^\d+\.\d{2}$/.test(row.newBase)) throw new Error("history money");
    const real = row.oldBase !== row.newBase || row.oldCountry !== null || row.oldStatus !== row.newStatus;
    if (!real) throw new Error("history row is not a real change");
    if (row.oldCountry !== null && row.oldCountry === row.newCountry) throw new Error("old country matches new country");
    currencyFor(row.newCountry);
    if (row.oldCountry !== null) currencyFor(row.oldCountry);
    if (!["active", "left"].includes(row.oldStatus) || !["active", "left"].includes(row.newStatus)) {
      throw new Error("history status");
    }
  }
}

function assertPeople(rows: SeedEmployee[]): void {
  if (rows.length !== PEOPLE) throw new Error(`expected ${PEOPLE} people`);
  if (new Set(rows.map((row) => row.employee_id)).size !== rows.length) throw new Error("duplicate employee id");
  const countries = new Set<string>();
  const levels = new Set<string>();
  const departments = new Set<string>();
  let nullDepartment = 0;
  let nullManager = 0;
  let nullStart = 0;
  let left = 0;
  for (const row of rows) {
    if (row.currency !== currencyFor(row.country)) throw new Error(`currency mismatch ${row.employee_id}`);
    if (!lookups.levels.includes(row.level)) throw new Error(`bad level ${row.employee_id}`);
    if (row.department !== null && !lookups.departments.includes(row.department)) {
      throw new Error(`bad department ${row.employee_id}`);
    }
    if (!/^\d+\.\d{2}$/.test(row.annual_base)) throw new Error(`bad base ${row.employee_id}`);
    if (row.status === "left") {
      if (row.leave_date === null) throw new Error(`left without leave date ${row.employee_id}`);
      left += 1;
    } else if (row.status !== "active" || row.leave_date !== null) {
      throw new Error(`bad status ${row.employee_id}`);
    }
    countries.add(row.country);
    levels.add(row.level);
    if (row.department === null) nullDepartment += 1;
    else departments.add(row.department);
    if (row.manager_employee_id === null) nullManager += 1;
    if (row.start_date === null) nullStart += 1;
  }
  if (countries.size !== lookups.countries.length) throw new Error("missing country");
  if (levels.size !== lookups.levels.length) throw new Error("missing level");
  if (departments.size !== lookups.departments.length) throw new Error("missing department");
  if (nullDepartment < 1 || nullManager < 1 || nullStart < 1 || left < 1) throw new Error("missing blanks or leavers");
  const nameCounts = new Map<string, number>();
  for (const row of rows) nameCounts.set(row.legal_name, (nameCounts.get(row.legal_name) ?? 0) + 1);
  const sharedNames = [...nameCounts.entries()].filter(([, count]) => count >= 2);
  if (sharedNames.length !== 1 || sharedNames[0]?.[0] !== SHARED_NAME || sharedNames[0][1] !== 2) {
    throw new Error("expected exactly two people to share one legal name");
  }
  for (const employeeId of [PAY_ID, MOVE_ID, LEAVE_ID]) {
    const latest = latestFor(employeeId);
    const row = must(rows, employeeId);
    if (row.annual_base !== latest.newBase || row.country !== latest.newCountry || row.status !== latest.newStatus) {
      throw new Error(`current row does not match latest change for ${employeeId}`);
    }
  }
}
