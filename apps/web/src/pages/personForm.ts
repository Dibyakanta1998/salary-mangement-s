import type { HistoryRow, PersonDetail, PersonFields } from "../api/client";
import { COPY } from "../copy";
import { formatAmount } from "../formatAmount";
import lookups from "../lookups";

export type Status = "active" | "left";

export type FormState = {
  employeeId: string;
  legalName: string;
  country: string;
  level: string;
  annualBase: string;
  status: Status;
  department: string;
  managerEmployeeId: string;
  startDate: string;
  leaveDate: string;
  note: string;
};

const MONEY = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;

export function emptyForm(): FormState {
  return {
    employeeId: "",
    legalName: "",
    country: lookups.countries[0]?.name ?? "",
    level: lookups.levels[0] ?? "",
    annualBase: "",
    status: "active",
    department: "",
    managerEmployeeId: "",
    startDate: "",
    leaveDate: "",
    note: "",
  };
}

export function asStatus(status: string): Status {
  return status === "left" ? "left" : "active";
}

export function formFromPerson(person: PersonDetail): FormState {
  return {
    employeeId: person.employeeId,
    legalName: person.legalName,
    country: person.country,
    level: person.level,
    annualBase: person.annualBase,
    status: asStatus(person.status),
    department: person.department ?? "",
    managerEmployeeId: person.managerEmployeeId ?? "",
    startDate: person.startDate ?? "",
    leaveDate: person.leaveDate ?? "",
    note: "",
  };
}

export function currencyFor(country: string): string {
  return lookups.countries.find((item) => item.name === country)?.currency ?? "";
}

function canonicalBase(value: string): string {
  const trimmed = value.trim();
  if (!MONEY.test(trimmed)) return trimmed;
  const [whole, fraction = ""] = trimmed.split(".");
  return `${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

export function saveNeedsNote(form: FormState, person: PersonDetail | null): boolean {
  if (!person) return false;
  return (
    canonicalBase(form.annualBase) !== person.annualBase ||
    form.country !== person.country ||
    form.status !== person.status
  );
}

function blank(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function personFields(form: FormState): PersonFields {
  return {
    legalName: form.legalName.trim(),
    country: form.country,
    level: form.level,
    annualBase: form.annualBase.trim(),
    status: form.status,
    department: form.department || null,
    managerEmployeeId: blank(form.managerEmployeeId),
    startDate: form.startDate || null,
    leaveDate: form.status === "left" ? form.leaveDate : null,
  };
}

function statusName(status: string): string {
  if (status === "left") return COPY.statusLeft;
  if (status === "active") return COPY.statusActive;
  return status;
}

export function historyLine(row: HistoryRow): string {
  const oldCountry = row.oldCountry ?? row.newCountry;
  const oldAmount = formatAmount(row.oldBase, currencyFor(oldCountry));
  const newAmount = formatAmount(row.newBase, currencyFor(row.newCountry));
  const amounts = row.oldCountry
    ? `${oldAmount} ${row.oldCountry} → ${newAmount} ${row.newCountry}`
    : `${oldAmount} → ${newAmount}`;
  const when = row.changedAt.slice(0, 10);
  if (row.oldStatus === row.newStatus) return `${when} ${amounts} ${row.note}`;
  return `${when} ${amounts} ${statusName(row.oldStatus)} → ${statusName(row.newStatus)} ${row.note}`;
}
