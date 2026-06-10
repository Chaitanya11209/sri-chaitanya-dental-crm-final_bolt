// Tiny dependency-free CSV exporter.

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns?: { key: keyof T; label: string }[]
) {
  if (!rows.length) {
    alert('Nothing to export — list is empty.');
    return;
  }

  const cols =
    columns ??
    (Object.keys(rows[0]).map((k) => ({
      key: k as keyof T,
      label: k,
    })) as { key: keyof T; label: string }[]);

  const header = cols.map((c) => escapeCell(c.label)).join(',');
  const body = rows
    .map((row) => cols.map((c) => escapeCell(row[c.key])).join(','))
    .join('\n');

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
