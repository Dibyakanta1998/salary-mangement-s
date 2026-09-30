import { Sequelize } from "sequelize";
import config from "./config";

const db = config.development;

export const sequelize = new Sequelize(db.database, db.username, db.password, {
  host: db.host,
  port: db.port,
  dialect: db.dialect,
  logging: false,
});
