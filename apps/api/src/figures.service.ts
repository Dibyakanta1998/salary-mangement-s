import { QueryTypes, Transaction } from "sequelize";
import { currentTestTransaction, sequelize } from "./db/sequelize.js";
import { AppError } from "./employee.service.js";
import type { FiguresQuery } from "./figures.schema.js";
import lookups from "./lookups.js";

const medianSql = `
ROUND(
  CASE
    WHEN n % 2 = 1 THEN MAX(annual_base) FILTER (WHERE rn = (n + 1) / 2)
    ELSE (
      MAX(annual_base) FILTER (WHERE rn = n / 2)
      + MAX(annual_base) FILTER (WHERE rn = (n / 2) + 1)
    ) / 2
  END,
  2
)::text
`;

type MoneyRow = { headcount: number; total: string; median: string | null };

type PerCurrencyLine = { currency: string; headcount: number; totalAnnualBase: string };

type Group = {
  headcount: number;
  medianAnnualBase: string | null;
  totalAnnualBase: string;
};

export type FiguresResult =
  | { kind: "perCurrency"; lines: PerCurrencyLine[] }
  | {
      kind: "country";
      country: string;
      currency: string;
      headcount: number;
      medianAnnualBase: string | null;
      totalAnnualBase: string;
      byDepartment: (Group & { department: string | null })[];
      byLevel: (Group & { level: string })[];
    };

function currencyFor(country: string): string {
  const match = lookups.countries.find((item) => item.name === country);
  if (!match) throw new AppError(400, "VALIDATION_ERROR", "Invalid request");
  return match.currency;
}

function activeWhere(query: FiguresQuery): { clause: string; bind: unknown[] } {
  const bind: unknown[] = [];
  const parts = ["status = 'active'"];
  const add = (column: string, value: string | undefined) => {
    if (!value) return;
    bind.push(value);
    parts.push(`${column} = $${bind.length}`);
  };
  add("country", query.country);
  add("department", query.department);
  add("level", query.level);
  return { clause: parts.join(" AND "), bind };
}

function readTogether<T>(fn: (transaction: Transaction) => Promise<T>): Promise<T> {
  const outer = currentTestTransaction();
  if (outer) return fn(outer);
  return sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, fn);
}

function asGroup(row: MoneyRow): Group {
  return {
    headcount: Number(row.headcount),
    medianAnnualBase: row.median,
    totalAnnualBase: row.total,
  };
}

async function select<T extends object>(sql: string, bind: unknown[], transaction: Transaction): Promise<T[]> {
  return sequelize.query<T>(sql, { bind, type: QueryTypes.SELECT, transaction });
}

function headlineSql(where: string): string {
  return `
    WITH ranked AS (
      SELECT annual_base,
             row_number() OVER (ORDER BY annual_base) AS rn,
             count(*) OVER () AS n
      FROM employees
      WHERE ${where}
    )
    SELECT count(*)::int AS headcount,
           ROUND(COALESCE(SUM(annual_base), 0), 2)::text AS total,
           ${medianSql} AS median
    FROM ranked
    GROUP BY n
  `;
}

function groupedSql(column: "department" | "level", where: string, orderBy: string): string {
  return `
    WITH ranked AS (
      SELECT ${column},
             annual_base,
             row_number() OVER (PARTITION BY ${column} ORDER BY annual_base) AS rn,
             count(*) OVER (PARTITION BY ${column}) AS n
      FROM employees
      WHERE ${where}
    )
    SELECT ${column} AS "${column}",
           count(*)::int AS headcount,
           ${medianSql} AS median,
           ROUND(SUM(annual_base), 2)::text AS total
    FROM ranked
    GROUP BY ${column}, n
    ORDER BY ${orderBy}
  `;
}

async function perCurrency(query: FiguresQuery, transaction: Transaction): Promise<FiguresResult> {
  const { clause, bind } = activeWhere(query);
  const rows = await select<{ currency: string; headcount: number; total: string }>(
    `
      SELECT TRIM(currency) AS currency,
             count(*)::int AS headcount,
             ROUND(SUM(annual_base), 2)::text AS total
      FROM employees
      WHERE ${clause}
      GROUP BY TRIM(currency)
      ORDER BY TRIM(currency)
    `,
    bind,
    transaction,
  );
  return {
    kind: "perCurrency",
    lines: rows.map((row) => ({
      currency: row.currency,
      headcount: Number(row.headcount),
      totalAnnualBase: row.total,
    })),
  };
}

async function countryFigures(country: string, query: FiguresQuery, transaction: Transaction): Promise<FiguresResult> {
  const { clause, bind } = activeWhere(query);
  const [headline] = await select<MoneyRow>(headlineSql(clause), bind, transaction);
  const byDepartment = await select<MoneyRow & { department: string | null }>(
    groupedSql("department", clause, "SUM(annual_base) DESC, department ASC NULLS LAST"),
    bind,
    transaction,
  );
  const byLevel = await select<MoneyRow & { level: string }>(
    groupedSql("level", clause, "level ASC"),
    bind,
    transaction,
  );
  const summary = headline ? asGroup(headline) : { headcount: 0, medianAnnualBase: null, totalAnnualBase: "0.00" };
  return {
    kind: "country",
    country,
    currency: currencyFor(country),
    ...summary,
    byDepartment: byDepartment.map((row) => ({ department: row.department, ...asGroup(row) })),
    byLevel: byLevel.map((row) => ({ level: row.level, ...asGroup(row) })),
  };
}

export function getPayFigures(query: FiguresQuery): Promise<FiguresResult> {
  return readTogether((transaction) =>
    query.country ? countryFigures(query.country, query, transaction) : perCurrency(query, transaction),
  );
}
