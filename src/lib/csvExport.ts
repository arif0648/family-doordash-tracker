/**
 * csvExport.ts — bağımlılıksız CSV üretimi (Papa Parse gibi bir pakete
 * ihtiyaç yok; RFC 4180 tırnaklama kuralları elle uygulanmıştır).
 */

export interface CsvColumn<T> {
  header: string;
  accessor: (row: T) => string | number;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const headerLine = columns.map((c) => escapeCsvField(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvField(String(c.accessor(row)))).join(',')
  );
  return [headerLine, ...dataLines].join('\r\n');
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function downloadCsv(filename: string, csvContent: string): void {
  // Prepend BOM so Excel opens Turkish characters (ş, ğ, ı, ç, ö, ü) correctly.
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
