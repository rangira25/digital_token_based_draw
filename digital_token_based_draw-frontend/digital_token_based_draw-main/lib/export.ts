/**
 * Client-side export utilities: real Excel (.xlsx) and PDF (.pdf) downloads.
 * Replaces the previous CSV-only "export" used across the dashboard pages.
 */
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ExportColumn {
  header: string;
  key: string; // path into each row object (dot notation supported)
}

function resolvePath(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/** Normalize any row value into a displayable string. */
function displayValue(value: any): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Build rows[][] from data + columns. */
function buildMatrix(data: any[], columns: ExportColumn[]): string[][] {
  return data.map((row) => columns.map((col) => displayValue(resolvePath(row, col.key))));
}

/** Export rows as a real .xlsx workbook download. */
export function exportExcel(
  data: any[],
  columns: ExportColumn[],
  filename: string,
  sheetName = 'Data'
) {
  const headerRow = columns.map((c) => c.header);
  const bodyRows = buildMatrix(data, columns);
  const aoa = [headerRow, ...bodyRows].filter((row) => row.some((cell) => cell !== ''));

  const worksheet = XLSX.utils.aoa_to_sheet(aoa);
  worksheet['!cols'] = columns.map((c) => ({ wch: Math.max(c.header.length, 12) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  const out = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  triggerDownload(blob, safeName);
}

export interface PDFOptions {
  filename: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn[];
  data: any[];
}

/** Export rows as a styled .pdf download using jsPDF + autotable. */
export function exportPDF({ filename, title, subtitle, columns, data }: PDFOptions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFillColor(59, 184, 46); // Raffall green #3BB82E
  doc.rect(0, 0, pageWidth, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 40, 38);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (subtitle) doc.text(subtitle, 40, 52);

  const bodyRows = data.map((row) => columns.map((col) => displayValue(resolvePath(row, col.key))));

  autoTable(doc, {
    startY: 80,
    head: [columns.map((c) => c.header)],
    body: bodyRows,
    headStyles: { fillColor: [59, 184, 46], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: [242, 249, 241] },
    margin: { top: 40, right: 40, bottom: 40, left: 40 },
  });

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated ${new Date().toLocaleString()}  •  Page ${i} of ${pageCount}`, 40, doc.internal.pageSize.getHeight() - 20);
  }

  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(safeName);
}
