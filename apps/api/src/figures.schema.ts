import { z } from "zod";
import lookups from "./lookups";

const countryNames = lookups.countries.map((country) => country.name) as [string, ...string[]];
const levelNames = [...lookups.levels] as [string, ...string[]];
const departmentNames = [...lookups.departments] as [string, ...string[]];

export const figuresQuerySchema = z.object({
  country: z.enum(countryNames).optional(),
  department: z.enum(departmentNames).optional(),
  level: z.enum(levelNames).optional(),
});

export type FiguresQuery = z.infer<typeof figuresQuerySchema>;
