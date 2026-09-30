import { DataTypes, Model } from "sequelize";
import { sequelize } from "./sequelize";

export class Employee extends Model {
  declare employeeId: string;
  declare legalName: string;
  declare country: string;
  declare currency: string;
  declare level: string;
  declare annualBase: string;
  declare status: string;
  declare leaveDate: string | null;
  declare department: string | null;
  declare managerEmployeeId: string | null;
  declare startDate: string | null;
}

Employee.init(
  {
    employeeId: { type: DataTypes.STRING(64), primaryKey: true, field: "employee_id" },
    legalName: { type: DataTypes.STRING(200), allowNull: false, field: "legal_name" },
    country: { type: DataTypes.TEXT, allowNull: false },
    currency: { type: DataTypes.CHAR(3), allowNull: false },
    level: { type: DataTypes.TEXT, allowNull: false },
    annualBase: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: "annual_base" },
    status: { type: DataTypes.TEXT, allowNull: false },
    leaveDate: { type: DataTypes.DATEONLY, allowNull: true, field: "leave_date" },
    department: { type: DataTypes.TEXT, allowNull: true },
    managerEmployeeId: { type: DataTypes.STRING(64), allowNull: true, field: "manager_employee_id" },
    startDate: { type: DataTypes.DATEONLY, allowNull: true, field: "start_date" },
  },
  { sequelize, tableName: "employees", timestamps: false },
);
