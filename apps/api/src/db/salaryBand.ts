import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize";

export class SalaryBand extends Model {
  declare country: string;
  declare level: string;
  declare currency: string;
  declare minBase: string;
  declare maxBase: string;
}

SalaryBand.init(
  {
    country: { type: DataTypes.TEXT, primaryKey: true },
    level: { type: DataTypes.TEXT, primaryKey: true },
    currency: { type: DataTypes.CHAR(3), allowNull: false },
    minBase: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "min_base" },
    maxBase: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "max_base" },
  },
  { sequelize, tableName: "salary_bands", timestamps: false },
);
