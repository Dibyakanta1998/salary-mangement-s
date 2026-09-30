import { QueryTypes } from "sequelize";
import { SalaryBand } from "./db/salaryBand";
import { currentTestTransaction, sequelize } from "./db/sequelize";
import { AppError } from "./employee.service";
import type { BandBody } from "./bands.schema";
import lookups from "./lookups";

export type BandJson = {
  country: string;
  level: string;
  currency: string;
  minBase: string;
  maxBase: string;
};

export type OutsideJson = {
  employeeId: string;
  legalName: string;
  base: string;
  min: string;
  max: string;
  gap: string;
  side: "under" | "over";
};

function decimalString(value: string): string {
  const [whole, fraction = ""] = value.trim().split(".");
  return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

function useTransaction() {
  const transaction = currentTestTransaction();
  return transaction ? { transaction } : {};
}

function currencyFor(country: string): string {
  const match = lookups.countries.find((item) => item.name === country);
  if (!match) throw new AppError(400, "VALIDATION_ERROR", "Invalid request");
  return match.currency;
}

function toBand(row: SalaryBand): BandJson {
  return {
    country: row.country,
    level: row.level,
    currency: row.currency.trim(),
    minBase: decimalString(row.minBase),
    maxBase: decimalString(row.maxBase),
  };
}

export async function listBands(): Promise<BandJson[]> {
  const rows = await SalaryBand.findAll({
    order: [
      ["country", "ASC"],
      ["level", "ASC"],
    ],
    ...useTransaction(),
  });
  return rows.map(toBand);
}

export async function saveBand(country: string, level: string, body: BandBody): Promise<BandJson> {
  await SalaryBand.upsert(
    {
      country,
      level,
      currency: currencyFor(country),
      minBase: decimalString(body.minBase),
      maxBase: decimalString(body.maxBase),
    },
    useTransaction(),
  );
  const row = await SalaryBand.findOne({ where: { country, level }, ...useTransaction() });
  if (!row) throw new AppError(500, "INTERNAL", "Something went wrong");
  return toBand(row);
}

export async function clearBand(country: string, level: string): Promise<void> {
  await SalaryBand.destroy({ where: { country, level }, ...useTransaction() });
}

type OutsideRow = OutsideJson;

const outsideSql = `
SELECT e.employee_id AS "employeeId",
       e.legal_name AS "legalName",
       e.annual_base::text AS base,
       b.min_base::text AS min,
       b.max_base::text AS max,
       CASE
         WHEN e.annual_base < b.min_base THEN (b.min_base - e.annual_base)::text
         ELSE (e.annual_base - b.max_base)::text
       END AS gap,
       CASE WHEN e.annual_base < b.min_base THEN 'under' ELSE 'over' END AS side
  FROM employees e
  JOIN salary_bands b ON b.country = e.country AND b.level = e.level
 WHERE e.status = 'active'
   AND e.country = $1
   AND e.level = $2
   AND (e.annual_base < b.min_base OR e.annual_base > b.max_base)
 ORDER BY e.legal_name ASC, e.employee_id ASC
`;

export async function listOutside(country: string, level: string): Promise<OutsideJson[]> {
  const band = await SalaryBand.findOne({ where: { country, level }, ...useTransaction() });
  if (!band) return [];
  const rows = await sequelize.query<OutsideRow>(outsideSql, {
    bind: [country, level],
    type: QueryTypes.SELECT,
    ...useTransaction(),
  });
  return rows.map((row) => ({
    employeeId: row.employeeId,
    legalName: row.legalName,
    base: decimalString(row.base),
    min: decimalString(row.min),
    max: decimalString(row.max),
    gap: decimalString(row.gap),
    side: row.side,
  }));
}
