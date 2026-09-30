import { Router } from "express";
import { getFigures } from "./figures.controller";

export const figuresRouter = Router();

figuresRouter.get("/figures", getFigures);
