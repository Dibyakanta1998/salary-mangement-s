import { Router } from "express";
import { deleteBand, getBands, getOutside, putBand } from "./bands.controller.js";

export const bandsRouter = Router();

bandsRouter.get("/bands/outside", getOutside);
bandsRouter.get("/bands", getBands);
bandsRouter.put("/bands/:country/:level", putBand);
bandsRouter.delete("/bands/:country/:level", deleteBand);
