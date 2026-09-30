import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize";

export class SalaryChange extends Model {
  declare id: string;
  declare employeeId: string;
  declare changedAt: Date;
  declare oldBase: string;
  declare newBase: string;
  declare oldCountry: string | null;
  declare newCountry: string;
  declare oldStatus: string;
  declare newStatus: string;
  declare note: string;
}

SalaryChange.init(
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    employeeId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      field: "employee_id",
      references: { model: "employees", key: "employee_id" },
      onDelete: "RESTRICT",
    },
    changedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "changed_at",
    },
    oldBase: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "old_base" },
    newBase: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "new_base" },
    oldCountry: { type: DataTypes.TEXT, allowNull: true, field: "old_country" },
    newCountry: { type: DataTypes.TEXT, allowNull: false, field: "new_country" },
    oldStatus: { type: DataTypes.TEXT, allowNull: false, field: "old_status" },
    newStatus: { type: DataTypes.TEXT, allowNull: false, field: "new_status" },
    note: { type: DataTypes.STRING(1000), allowNull: false },
  },
  { sequelize, tableName: "salary_changes", timestamps: false },
);
