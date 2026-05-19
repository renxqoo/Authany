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
    <div className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
      <div className="overflow-x-auto">
        <Table>
          <thead>
            <tr>
              {columns.map((column) => <Th key={column.label}>{column.label}</Th>)}
              <Th>{t("resource.actionsColumn")}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr className="bg-white/50 transition hover:bg-slate-50/90" key={String(row.id ?? rowIndex)}>
                {columns.map((column, columnIndex) => {
                  const value = readValue(row, column);
                  return (
                    <Td className={column.className} key={column.label}>
                      {columnIndex === 0 ? (
                        <Link className="font-semibold text-slate-950 transition hover:text-sky-700" href={hrefForRow(row)}>
                          {renderResourceValue(value, column.kind, t)}
                        </Link>
                      ) : renderResourceValue(value, column.kind, t)}
                    </Td>
                  );
                })}
                <Td>
                  <Link
                    className="inline-flex rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-sky-50 hover:text-sky-700"
                    href={hrefForRow(row)}
                  >
                    {t("common.viewDetails")}
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
