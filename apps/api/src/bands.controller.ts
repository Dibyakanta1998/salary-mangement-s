import type { NextFunction, Request, Response } from "express";
import { bandBodySchema, bandParamsSchema, outsideQuerySchema } from "./bands.schema.js";
import { clearBand, listBands, listOutside, saveBand } from "./bands.service.js";

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export const getBands = asyncRoute(async (_req, res) => {
  res.json(await listBands());
});

export const putBand = asyncRoute(async (req, res) => {
  const params = bandParamsSchema.parse(req.params);
  const body = bandBodySchema.parse(req.body);
  res.json(await saveBand(params.country, params.level, body));
});

export const deleteBand = asyncRoute(async (req, res) => {
  const params = bandParamsSchema.parse(req.params);
  await clearBand(params.country, params.level);
  res.status(204).end();
});

export const getOutside = asyncRoute(async (req, res) => {
  const query = outsideQuerySchema.parse(req.query);
  res.json(await listOutside(query.country, query.level));
});
