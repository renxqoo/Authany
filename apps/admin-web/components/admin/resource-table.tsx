"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n/language-provider";
import type { ResourceColumn } from "@/lib/admin/types";
import { EmptyState } from "./management-page";
import { Table, Td, Th } from "@/components/ui/table";
import { readValue, renderResourceValue } from "./resource-display";

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
  const { t } = useI18n();

  if (rows.length === 0) {
    return <EmptyState>{emptyState}</EmptyState>;
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white">
      <Table>
        <thead>
          <tr>
            {columns.map((column) => <Th key={column.label}>{column.label}</Th>)}
            <Th>{t("resource.actionsColumn")}</Th>
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
                        {renderResourceValue(value, column.kind, t)}
                      </Link>
                    ) : renderResourceValue(value, column.kind, t)}
                  </Td>
                );
              })}
              <Td>
                <Link className="font-medium text-sky-700 hover:text-sky-900" href={hrefForRow(row)}>
                  {t("common.viewDetails")}
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
