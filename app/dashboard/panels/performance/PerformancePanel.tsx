"use client";

import type { EmployeeStat } from "../../shared/types";
import "./performance.css";

export function PerformancePanel({
  employees,
  size = "full",
}: {
  employees: EmployeeStat[];
  size?: "full" | "compact";
}) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Performance equipe</h2>
          <p className="mt-1 text-sm text-muted">
            Nombre de remises et recuperations des cles par employe
          </p>
        </div>
        <span className="chip">Equipe terrain</span>
      </div>

      <div className={
        size === "full"
          ? "custom-scrollbar grid min-h-0 flex-1 gap-2 overflow-y-auto sm:grid-cols-2"
          : "grid gap-3"
      }>
        {employees.map((employee) => (
          <div key={employee.name} className="card bg-card-secondary p-3">
            <p className="font-medium">{employee.name}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted">Remises</span>
              <span>{employee.handovers}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted">Recuperations</span>
              <span>{employee.returns}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
