import { z } from "zod";
import lookups from "./lookups";

const countryNames = lookups.countries.map((country) => country.name) as [string, ...string[]];
const levelNames = [...lookups.levels] as [string, ...string[]];
const departmentNames = [...lookups.departments] as [string, ...string[]];

const money = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);

const calendarDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCalendarDate, "Invalid date");

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function emptyToNull(schema: z.ZodType<string>) {
  return z
    .union([schema, z.literal(""), z.null()])
    .optional()
    .transform((value) => value || null);
}

export const createPersonSchema = z
  .object({
    employeeId: z.string().trim().min(1).max(64),
    legalName: z.string().trim().min(1).max(200),
    country: z.enum(countryNames),
    level: z.enum(levelNames),
    annualBase: money,
    status: z.enum(["active", "left"]),
    department: emptyToNull(z.enum(departmentNames)),
    managerEmployeeId: emptyToNull(z.string().trim().min(1).max(64)),
    startDate: emptyToNull(calendarDate),
    leaveDate: emptyToNull(calendarDate),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.status === "left" && !value.leaveDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Leave date is required when status is left",
        path: ["leaveDate"],
      });
    }
  });

export const listPeopleQuerySchema = z.object({
  q: z.string().trim().optional(),
  country: z.enum(countryNames).optional(),
  department: z.enum(departmentNames).optional(),
  level: z.enum(levelNames).optional(),
  status: z.enum(["active", "left"]).default("active"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const personQuerySchema = z.object({
  employeeId: z.string().trim().max(64).optional(),
});

export type CreatePerson = z.infer<typeof createPersonSchema>;
export type ListPeopleQuery = z.infer<typeof listPeopleQuerySchema>;
