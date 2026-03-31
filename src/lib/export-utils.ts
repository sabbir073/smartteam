"use client";

import { saveAs } from "file-saver";

interface ExportColumn {
  key: string;
  header: string;
  format?: (value: unknown) => string;
}

// ─── CSV ─────────────────────────────────────────
export function exportToCSV(data: Record<string, unknown>[], columns: ExportColumn[], filename: string) {
  const headers = columns.map((c) => c.header).join(",");
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const val = col.format ? col.format(row[col.key]) : String(row[col.key] ?? "");
        // Escape commas and quotes
        if (val.includes(",") || val.includes('"') || val.includes("\n")) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      })
      .join(",")
  );
  const csv = [headers, ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  saveAs(blob, `${filename}.csv`);
}

// ─── EXCEL ───────────────────────────────────────
export async function exportToExcel(data: Record<string, unknown>[], columns: ExportColumn[], filename: string, sheetName = "Report") {
  const XLSX = await import("xlsx");
  const headers = columns.map((c) => c.header);
  const rows = data.map((row) =>
    columns.map((col) => (col.format ? col.format(row[col.key]) : row[col.key] ?? ""))
  );
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // Auto-width
  ws["!cols"] = columns.map((_, i) => ({
    wch: Math.max(
      headers[i].length,
      ...rows.map((r) => String(r[i] ?? "").length)
    ) + 2,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, `${filename}.xlsx`);
}

// ─── PDF ─────────────────────────────────────────
export async function exportToPDF(data: Record<string, unknown>[], columns: ExportColumn[], filename: string, title?: string) {
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });

  if (title) {
    doc.setFontSize(16);
    doc.text(title, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(128);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
  }

  const headers = columns.map((c) => c.header);
  const rows = data.map((row) =>
    columns.map((col) => (col.format ? col.format(row[col.key]) : String(row[col.key] ?? "")))
  );

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: title ? 35 : 20,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
  });

  doc.save(`${filename}.pdf`);
}

// ─── DOCX ────────────────────────────────────────
export async function exportToDocx(data: Record<string, unknown>[], columns: ExportColumn[], filename: string, title?: string) {
  const docx = await import("docx");
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, TextRun, HeadingLevel, BorderStyle, AlignmentType } = docx;

  const headerRow = new TableRow({
    tableHeader: true,
    children: columns.map(
      (col) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: col.header, bold: true, size: 20, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
          shading: { fill: "4F46E5" },
          width: { size: Math.floor(100 / columns.length), type: WidthType.PERCENTAGE },
        })
    ),
  });

  const dataRows = data.map(
    (row, idx) =>
      new TableRow({
        children: columns.map(
          (col) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: col.format ? col.format(row[col.key]) : String(row[col.key] ?? ""), size: 18 })] })],
              shading: idx % 2 === 1 ? { fill: "F5F5FA" } : undefined,
            })
        ),
      })
  );

  const table = new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "E5E7EB" },
    },
  });

  const children: (typeof Paragraph | typeof Table)[] = [];
  if (title) {
    children.push(
      new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 32 })], heading: HeadingLevel.HEADING_1 }) as any,
      new Paragraph({ children: [new TextRun({ text: `Generated: ${new Date().toLocaleString()}`, size: 18, color: "888888" })] }) as any,
      new Paragraph({}) as any
    );
  }
  children.push(table as any);

  const doc = new Document({
    sections: [{ children: children as any[] }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
}

// ─── Universal export ────────────────────────────
export async function exportData(
  format: "csv" | "xlsx" | "pdf" | "docx",
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  title?: string
) {
  switch (format) {
    case "csv":
      exportToCSV(data, columns, filename);
      break;
    case "xlsx":
      await exportToExcel(data, columns, filename);
      break;
    case "pdf":
      await exportToPDF(data, columns, filename, title);
      break;
    case "docx":
      await exportToDocx(data, columns, filename, title);
      break;
  }
}
