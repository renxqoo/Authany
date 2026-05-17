"use client";

import Link from "next/link";
import { EmptyState } from "@/components/management/management-page";
import { Table, Td, Th } from "@/components/ui/table";
import { readValue, renderResourceValue } from "./resource-display";
import type { ResourceColumn } from "./types";

export function ResourceTable({
  columns,
  emptyState,
  hrefForRow,
  rows
}: {
  columns: ResourceColumn[];
  emptyState: string;
  hrefForRow: (row: Record<string, unknown>) => string;
  rows: Array<Record<string, unknown>>;
}) {
  if (rows.length === 0) {
    return <EmptyState>{emptyState}</EmptyState>;
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
      <Table>
        <thead>
          <tr>
            {columns.map((column) => <Th key={column.label}>{column.label}</Th>)}
            <Th>Action</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={String(row.id ?? rowIndex)}>
              {columns.map((column, columnIndex) => {
                const value = readValue(row, column);
                return (
                  <Td className={column.className} key={column.label}>
                    {columnIndex === 0 ? (
                      <Link className="font-semibold text-slate-950 transition hover:text-amber-700" href={hrefForRow(row)}>
                        {renderResourceValue(value, column.kind)}
                      </Link>
                    ) : renderResourceValue(value, column.kind)}
                  </Td>
                );
              })}
              <Td>
                <Link className="font-medium text-sky-700 hover:text-sky-900" href={hrefForRow(row)}>
                  View details
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}

