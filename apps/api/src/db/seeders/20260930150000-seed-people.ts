import type { QueryInterface, Transaction } from "sequelize";
import { QueryTypes } from "sequelize";
import { buildSeedPeople, seedHistory, type SeedEmployee, type SeedHistory } from "../seedPeople";

const CHUNK = 1000;

async function employeesExist(queryInterface: QueryInterface): Promise<boolean> {
  const rows = await queryInterface.sequelize.query("SELECT 1 AS present FROM employees LIMIT 1", {
    type: QueryTypes.SELECT,
  });
  return rows.length > 0;
}

async function insertEmployees(
  queryInterface: QueryInterface,
  rows: SeedEmployee[],
  transaction: Transaction,
): Promise<void> {
  for (let offset = 0; offset < rows.length; offset += CHUNK) {
    await queryInterface.bulkInsert("employees", rows.slice(offset, offset + CHUNK), { transaction });
  }
}

function historyValues(rows: SeedHistory[]): { sql: string; replacements: Record<string, string> } {
  const replacements: Record<string, string> = {};
  const values = rows.map((row, index) => {
    if (!Number.isInteger(row.daysAgo) || row.daysAgo < 1) throw new Error("bad history age");
    replacements[`employeeId${index}`] = row.employeeId;
    replacements[`oldBase${index}`] = row.oldBase;
    replacements[`newBase${index}`] = row.newBase;
    replacements[`newCountry${index}`] = row.newCountry;
    replacements[`oldStatus${index}`] = row.oldStatus;
    replacements[`newStatus${index}`] = row.newStatus;
    replacements[`note${index}`] = row.note;
    const oldCountry = row.oldCountry === null ? "NULL" : `:oldCountry${index}`;
    if (row.oldCountry !== null) replacements[`oldCountry${index}`] = row.oldCountry;
    return `(:employeeId${index}, now() - interval '${row.daysAgo} days', :oldBase${index}, :newBase${index}, ${oldCountry}, :newCountry${index}, :oldStatus${index}, :newStatus${index}, :note${index})`;
  });
  return { sql: values.join(", "), replacements };
}

async function insertHistory(queryInterface: QueryInterface, transaction: Transaction): Promise<void> {
  const { sql, replacements } = historyValues(seedHistory());
  await queryInterface.sequelize.query(
    `INSERT INTO salary_changes (
       employee_id, changed_at, old_base, new_base, old_country, new_country, old_status, new_status, note
     ) VALUES ${sql}`,
    { replacements, transaction },
  );
}

async function up(queryInterface: QueryInterface): Promise<void> {
  if (await employeesExist(queryInterface)) return;
  const rows = buildSeedPeople();
  const transaction = await queryInterface.sequelize.transaction();
  try {
    await insertEmployees(queryInterface, rows, transaction);
    await insertHistory(queryInterface, transaction);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.sequelize.query("DELETE FROM salary_changes");
  await queryInterface.sequelize.query("DELETE FROM employees");
}

export = { up, down };
