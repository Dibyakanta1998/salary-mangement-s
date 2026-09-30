import { Router } from "express";
import { getFigures } from "./figures.controller.js";

export const figuresRouter = Router();

figuresRouter.get("/figures", getFigures);
