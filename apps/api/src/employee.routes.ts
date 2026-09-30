import { Router } from "express";
import { createPerson, getPerson, listChanges, listPeople, patchPerson } from "./employee.controller.js";

export const employeeRouter = Router();

employeeRouter.post("/people", createPerson);
employeeRouter.get("/people", listPeople);
employeeRouter.get("/person", getPerson);
employeeRouter.get("/changes", listChanges);
employeeRouter.patch("/person", patchPerson);
