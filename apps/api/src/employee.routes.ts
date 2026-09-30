import { Router } from "express";
import { createPerson, getPerson, listPeople } from "./employee.controller";

export const employeeRouter = Router();

employeeRouter.post("/people", createPerson);
employeeRouter.get("/people", listPeople);
employeeRouter.get("/person", getPerson);
