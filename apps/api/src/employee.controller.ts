import type { NextFunction, Request, Response } from "express";
import { createPersonSchema, listPeopleQuerySchema, personQuerySchema, updatePersonSchema } from "./employee.schema.js";
import {
  AppError,
  createEmployee,
  getEmployee,
  listEmployees,
  listRecentChanges,
  updateEmployee,
} from "./employee.service.js";

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export const createPerson = asyncRoute(async (req, res) => {
  const body = createPersonSchema.parse(req.body);
  res.status(201).json(await createEmployee(body));
});

export const listPeople = asyncRoute(async (req, res) => {
  const query = listPeopleQuerySchema.parse(req.query);
  res.json(await listEmployees(query));
});

export const getPerson = asyncRoute(async (req, res) => {
  const query = personQuerySchema.parse(req.query);
  if (!query.employeeId) throw new AppError(404, "NOT_FOUND", "Person not found");
  res.json(await getEmployee(query.employeeId));
});

export const listChanges = asyncRoute(async (_req, res) => {
  res.json(await listRecentChanges());
});

export const patchPerson = asyncRoute(async (req, res) => {
  const query = personQuerySchema.parse(req.query);
  if (!query.employeeId) throw new AppError(404, "NOT_FOUND", "Person not found");
  const body = updatePersonSchema.parse(req.body);
  res.json(await updateEmployee(query.employeeId, body));
});
