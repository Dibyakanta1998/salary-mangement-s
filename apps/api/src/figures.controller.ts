import type { NextFunction, Request, Response } from "express";
import { figuresQuerySchema } from "./figures.schema.js";
import { getPayFigures } from "./figures.service.js";

function asyncRoute(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}

export const getFigures = asyncRoute(async (req, res) => {
  const query = figuresQuerySchema.parse(req.query);
  res.json(await getPayFigures(query));
});
