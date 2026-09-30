import { Router } from "express";
import { createPerson, getPerson, listPeople, patchPerson } from "./employee.controller";

export const employeeRouter = Router();

employeeRouter.post("/people", createPerson);
employeeRouter.get("/people", listPeople);
employeeRouter.get("/person", getPerson);
employeeRouter.patch("/person", patchPerson);
