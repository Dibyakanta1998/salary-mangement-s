import {
  Op,
  QueryTypes,
  Transaction,
  UniqueConstraintError,
  col,
  fn,
  where,
  type WhereOptions,
} from "sequelize";
import lookups from "./lookups.js";
import { Employee } from "./db/employee.js";
import { SalaryChange } from "./db/salaryChange.js";
import { currentTestTransaction, sequelize } from "./db/sequelize.js";
import type { CreatePerson, ListPeopleQuery, UpdatePerson } from "./employee.schema.js";

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: unknown = null,
  ) {
    super(message);
  }
}

type PersonJson = {
  employeeId: string;
  legalName: string;
  country: string;
  currency: string;
  level: string;
  annualBase: string;
  status: string;
  department: string | null;
  managerEmployeeId: string | null;
  startDate: string | null;
  leaveDate: string | null;
};

type HistoryJson = {
  changedAt: string;
  oldBase: string;
  newBase: string;
  oldCountry: string | null;
  newCountry: string;
  oldStatus: string;
  newStatus: string;
  note: string;
};

function decimalString(value: string): string {
  const [whole, fraction = ""] = value.trim().split(".");
  return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

function useTransaction(): { transaction?: Transaction } {
  const transaction = currentTestTransaction();
  return transaction ? { transaction } : {};
}

function inTransaction<T>(fn: (transaction: Transaction) => Promise<T>): Promise<T> {
  const outer = currentTestTransaction();
  if (outer) return sequelize.transaction({ transaction: outer }, fn);
  return sequelize.transaction(fn);
}

function currencyFor(country: string): string {
  const match = lookups.countries.find((item) => item.name === country);
  if (!match) throw new AppError(400, "VALIDATION_ERROR", "Invalid request");
  return match.currency;
}

function isDuplicate(error: unknown): boolean {
  if (error instanceof UniqueConstraintError) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as { parent?: { code?: string }; original?: { code?: string } };
  return candidate.parent?.code === "23505" || candidate.original?.code === "23505";
}

function toPerson(row: Employee): PersonJson {
  return {
    employeeId: row.employeeId,
    legalName: row.legalName,
    country: row.country,
    currency: row.currency.trim(),
    level: row.level,
    annualBase: decimalString(row.annualBase),
    status: row.status,
    department: row.department,
    managerEmployeeId: row.managerEmployeeId,
    startDate: row.startDate,
    leaveDate: row.leaveDate,
  };
}

function containsPattern(value: string): string {
  const escaped = value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  return `%${escaped}%`;
}

function listWhere(query: ListPeopleQuery): WhereOptions {
  const filters: WhereOptions[] = [{ status: query.status }];
  if (query.country) filters.push({ country: query.country });
  if (query.department) filters.push({ department: query.department });
  if (query.level) filters.push({ level: query.level });
  if (query.q) {
    filters.push({
      [Op.or]: [
        { employeeId: { [Op.like]: containsPattern(query.q) } },
        where(fn("lower", col("legal_name")), { [Op.like]: containsPattern(query.q.toLowerCase()) }),
      ],
    });
  }
  return { [Op.and]: filters };
}

export async function createEmployee(input: CreatePerson): Promise<PersonJson> {
  const existing = await Employee.findByPk(input.employeeId, useTransaction());
  if (existing) throw new AppError(409, "DUPLICATE_EMPLOYEE_ID", "Employee id already exists");
  try {
    await inTransaction((transaction) =>
      Employee.create(
        {
          employeeId: input.employeeId,
          legalName: input.legalName,
          country: input.country,
          currency: currencyFor(input.country),
          level: input.level,
          annualBase: input.annualBase,
          status: input.status,
          department: input.department,
          managerEmployeeId: input.managerEmployeeId,
          startDate: input.startDate,
          leaveDate: input.status === "left" ? input.leaveDate : null,
        },
        { transaction },
      ),
    );
  } catch (error) {
    if (isDuplicate(error)) throw new AppError(409, "DUPLICATE_EMPLOYEE_ID", "Employee id already exists");
    throw error;
  }
  const row = await Employee.findByPk(input.employeeId, useTransaction());
  if (!row) throw new AppError(500, "INTERNAL", "Something went wrong");
  return toPerson(row);
}

export async function listEmployees(query: ListPeopleQuery) {
  const found = await Employee.findAndCountAll({
    where: listWhere(query),
    order: [
      ["legalName", "ASC"],
      ["employeeId", "ASC"],
    ],
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    ...useTransaction(),
  });
  return {
    page: query.page,
    pageSize: query.pageSize,
    total: found.count,
    people: found.rows.map(toPerson),
  };
}

async function monthlyPay(employeeId: string): Promise<string> {
  const rows = await sequelize.query<{ monthly_base: string }>(
    "SELECT ROUND(annual_base / 12, 2)::text AS monthly_base FROM employees WHERE employee_id = $1",
    { bind: [employeeId], type: QueryTypes.SELECT, ...useTransaction() },
  );
  return decimalString(rows[0].monthly_base);
}

function toHistory(row: {
  changedAt: Date | string;
  oldBase: string;
  newBase: string;
  oldCountry: string | null;
  newCountry: string;
  oldStatus: string;
  newStatus: string;
  note: string;
}): HistoryJson {
  const changedAt = row.changedAt instanceof Date ? row.changedAt : new Date(row.changedAt);
  return {
    changedAt: changedAt.toISOString(),
    oldBase: decimalString(row.oldBase),
    newBase: decimalString(row.newBase),
    oldCountry: row.oldCountry,
    newCountry: row.newCountry,
    oldStatus: row.oldStatus,
    newStatus: row.newStatus,
    note: row.note,
  };
}

async function recentHistory(employeeId: string): Promise<HistoryJson[]> {
  const rows = await SalaryChange.findAll({
    where: { employeeId },
    order: [["changedAt", "DESC"]],
    limit: 10,
    ...useTransaction(),
  });
  return rows.map((row) => toHistory(row));
}

export type ChangeJson = HistoryJson & { employeeId: string; legalName: string };

export async function listRecentChanges(): Promise<ChangeJson[]> {
  const rows = await sequelize.query<ChangeJson>(
    `SELECT sc.employee_id AS "employeeId", e.legal_name AS "legalName",
            sc.changed_at AS "changedAt", sc.old_base::text AS "oldBase", sc.new_base::text AS "newBase",
            sc.old_country AS "oldCountry", sc.new_country AS "newCountry",
            sc.old_status AS "oldStatus", sc.new_status AS "newStatus", sc.note
     FROM salary_changes sc
     JOIN employees e ON e.employee_id = sc.employee_id
     WHERE sc.changed_at >= now() - interval '30 days'
     ORDER BY sc.changed_at DESC`,
    { type: QueryTypes.SELECT, ...useTransaction() },
  );
  return rows.map((row) => ({ employeeId: row.employeeId, legalName: row.legalName, ...toHistory(row) }));
}

type StoredPerson = {
  legalName: string;
  country: string;
  currency: string;
  level: string;
  annualBase: string;
  status: string;
  department: string | null;
  managerEmployeeId: string | null;
  startDate: string | null;
  leaveDate: string | null;
};

function formPerson(input: UpdatePerson): StoredPerson {
  return {
    legalName: input.legalName,
    country: input.country,
    currency: currencyFor(input.country),
    level: input.level,
    annualBase: decimalString(input.annualBase),
    status: input.status,
    department: input.department,
    managerEmployeeId: input.managerEmployeeId,
    startDate: input.startDate,
    leaveDate: input.status === "active" ? null : input.leaveDate,
  };
}

function readPerson(row: Employee): StoredPerson {
  return {
    legalName: row.legalName,
    country: row.country,
    currency: row.currency.trim(),
    level: row.level,
    annualBase: decimalString(row.annualBase),
    status: row.status,
    department: row.department,
    managerEmployeeId: row.managerEmployeeId,
    startDate: row.startDate,
    leaveDate: row.leaveDate,
  };
}

function samePerson(before: StoredPerson, after: StoredPerson): boolean {
  return (
    before.legalName === after.legalName &&
    before.country === after.country &&
    before.currency === after.currency &&
    before.level === after.level &&
    before.annualBase === after.annualBase &&
    before.status === after.status &&
    before.department === after.department &&
    before.managerEmployeeId === after.managerEmployeeId &&
    before.startDate === after.startDate &&
    before.leaveDate === after.leaveDate
  );
}

function tracksHistory(before: StoredPerson, after: StoredPerson): boolean {
  return before.annualBase !== after.annualBase || before.country !== after.country || before.status !== after.status;
}

function requiredNote(note: string | undefined): string | null {
  const trimmed = note?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

async function insertHistory(
  employeeId: string,
  before: StoredPerson,
  after: StoredPerson,
  note: string,
  transaction: Transaction,
): Promise<void> {
  await SalaryChange.create(
    {
      employeeId,
      oldBase: before.annualBase,
      newBase: after.annualBase,
      oldCountry: before.country === after.country ? null : before.country,
      newCountry: after.country,
      oldStatus: before.status,
      newStatus: after.status,
      note,
    },
    { transaction },
  );
}

export async function updateEmployee(employeeId: string, input: UpdatePerson): Promise<PersonJson> {
  return inTransaction(async (transaction) => {
    const row = await Employee.findByPk(employeeId, {
      transaction,
      lock: Transaction.LOCK.UPDATE,
    });
    if (!row) throw new AppError(404, "NOT_FOUND", "Person not found");
    const before = readPerson(row);
    const after = formPerson(input);
    const note = requiredNote(input.note);
    if (tracksHistory(before, after) && !note) throw new AppError(400, "VALIDATION_ERROR", "Note is required");
    if (!samePerson(before, after)) await row.update(after, { transaction });
    if (note && tracksHistory(before, after)) await insertHistory(employeeId, before, after, note, transaction);
    return toPerson(row);
  });
}

export async function getEmployee(employeeId: string) {
  const row = await Employee.findByPk(employeeId, useTransaction());
  if (!row) throw new AppError(404, "NOT_FOUND", "Person not found");
  const history = await recentHistory(employeeId);
  const latest = history[0] ?? null;
  return {
    ...toPerson(row),
    monthlyBase: await monthlyPay(employeeId),
    lastChangeAt: latest?.changedAt ?? null,
    lastNote: latest?.note ?? null,
    history,
  };
}
