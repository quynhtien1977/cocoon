"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronDown, FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { PageHeader } from "@/components/brand/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadXlsx, type XlsxSheet } from "@/lib/xlsx";
import { filterLabel, type ReportFilter } from "../date-range";
import { reportFileName } from "../export-excel";
import { downloadElementPdf } from "../export-pdf";
import { DateRangePicker } from "./date-range-picker";

/**
 * Frame shared by M1 and the report pages: header, optional date filter and the "Xuất dữ liệu" menu.
 * The whole frame is what the PDF captures; controls marked data-export="skip" are left out.
 */
export function ReportPage({ title, description, section, fileSection = "", filter, onFilterChange, sheets, children }: {
  title: string;
  description: string;
  /** Printed in the PDF header line. */
  section: string;
  fileSection?: string;
  /** Omitted for snapshot reports that take no period. */
  filter?: ReportFilter;
  onFilterChange?: (filter: ReportFilter) => void;
  /** null until the data the export needs has loaded. */
  sheets: (() => XlsxSheet[]) | null;
  children: ReactNode;
}) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportExcel = () => {
    setExportError(null);
    if (sheets) downloadXlsx(reportFileName(filter ?? null, "xlsx", fileSection), sheets());
  };
  const exportPdf = async () => {
    if (!reportRef.current || pdfBusy) return;
    setExportError(null);
    setPdfBusy(true);
    try {
      await downloadElementPdf(reportRef.current, reportFileName(filter ?? null, "pdf", fileSection));
    } catch {
      setExportError("Chưa xuất được PDF. Đợi biểu đồ tải xong rồi thử lại.");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div ref={reportRef} className="group/report">
      <PageHeader title={title} description={description} actions={
        <div data-export="skip" className="flex flex-wrap gap-2">
          {filter && onFilterChange && <DateRangePicker value={filter} onChange={onFilterChange} />}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" className="h-12 px-4 print:hidden" disabled={pdfBusy} />}>
              <FileDown aria-hidden="true" />{pdfBusy ? "Đang tạo PDF…" : "Xuất dữ liệu"}<ChevronDown aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5">
              <DropdownMenuItem className="min-h-11 gap-2 px-3" disabled={!sheets} onClick={() => void exportPdf()}><FileText aria-hidden="true" />Xuất báo cáo PDF</DropdownMenuItem>
              <DropdownMenuItem className="min-h-11 gap-2 px-3" disabled={!sheets} onClick={exportExcel}><FileSpreadsheet aria-hidden="true" />Xuất file Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      } />
      {exportError && <p role="alert" className="mb-4 text-sm text-destructive">{exportError}</p>}
      <p className="mb-4 hidden text-sm group-data-exporting/report:block print:block">
        Kỳ báo cáo: <strong>{filter ? filterLabel(filter) : "Số liệu hiện tại"}</strong> · Mục: <strong>{section}</strong> · Xuất lúc {new Date().toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
      </p>
      {children}
    </div>
  );
}
