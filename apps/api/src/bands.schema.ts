import { z } from "zod";
import lookups from "./lookups";

const countryNames = lookups.countries.map((country) => country.name) as [string, ...string[]];
const levelNames = [...lookups.levels] as [string, ...string[]];

const money = z
  .string()
  .trim()
  .regex(/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/);

function cents(value: string): bigint {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}

export const bandParamsSchema = z.object({
  country: z.enum(countryNames),
  level: z.enum(levelNames),
});

export const bandBodySchema = z
  .object({
    minBase: money,
    maxBase: money,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (cents(value.minBase) > cents(value.maxBase)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum is above maximum",
        path: ["minBase"],
      });
    }
  });

export const outsideQuerySchema = z.object({
  country: z.enum(countryNames),
  level: z.enum(levelNames),
});

export type BandBody = z.infer<typeof bandBodySchema>;
