import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download } from 'lucide-react';

const SCHOOL_NAME = 'Prince Learning Academy';
const FORMATS = [
  { id: 'xlsx', label: 'Excel (.xlsx)' },
  { id: 'pdf', label: 'PDF (.pdf)' },
  { id: 'csv', label: 'CSV (.csv)' },
];

function cellValue(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'string' && /^\s*[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

function getTable(rows) {
  const keys = [...new Set(rows.flatMap((row) => (
    row && typeof row === 'object' && !Array.isArray(row) ? Object.keys(row) : []
  )))];
  if (!keys.length) throw new Error('There are no exportable columns in these records.');
  const headers = keys.map((key) => key.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()));
  const values = rows.map((row) => keys.map((key) => cellValue(row?.[key])));
  return { headers, values };
}

function safeFileName(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'school-records';
}

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
}

async function exportExcel(table, title, fileName) {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.aoa_to_sheet([table.headers, ...table.values]);
  worksheet['!cols'] = table.headers.map((header, index) => ({
    wch: Math.min(36, table.values.reduce(
      (width, row) => Math.max(width, String(row[index] ?? '').length + 2),
      header.length + 2,
    )),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, title.slice(0, 31) || 'Records');
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

async function exportPdf(table, title, fileName) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const document = new jsPDF({ orientation: table.headers.length > 6 ? 'landscape' : 'portrait' });
  document.setFontSize(15);
  document.setTextColor(10, 25, 47);
  document.text(SCHOOL_NAME, 14, 17);
  document.setFontSize(11);
  document.setTextColor(71, 85, 105);
  document.text(title, 14, 25);
  document.setDrawColor(215, 173, 72);
  document.setLineWidth(0.7);
  document.line(14, 29, document.internal.pageSize.getWidth() - 14, 29);
  autoTable(document, {
    head: [table.headers],
    body: table.values,
    startY: 34,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2.5, overflow: 'linebreak' },
    headStyles: { fillColor: [10, 25, 47], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 245, 234] },
  });
  document.save(`${fileName}.pdf`);
}

function exportCsv(table, fileName) {
  const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [table.headers, ...table.values].map((row) => row.map(escape).join(',')).join('\r\n');
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `${fileName}.csv`);
}

export default function ExportMenu({ rows = [], title = 'School records', fileName, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const menuRef = useRef(null);
  const baseFileName = safeFileName(fileName || title);

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setIsOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  async function handleExport(format) {
    setExporting(format);
    setError('');
    try {
      const sourceRows = typeof rows === 'function' ? await rows() : rows;
      if (!Array.isArray(sourceRows) || sourceRows.length === 0) {
        throw new Error('There are no records to export.');
      }
      const table = getTable(sourceRows);
      if (format === 'xlsx') await exportExcel(table, title, baseFileName);
      else if (format === 'pdf') await exportPdf(table, title, baseFileName);
      else exportCsv(table, baseFileName);
      setIsOpen(false);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'The file could not be exported.');
    } finally {
      setExporting('');
    }
  }

  return (
    <div className="adm-export-menu" ref={menuRef}>
      <button
        type="button"
        className="adm-export-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        disabled={disabled || Boolean(exporting) || (Array.isArray(rows) && rows.length === 0)}
        onClick={() => { setError(''); setIsOpen((open) => !open); }}
      >
        <Download size={15} />
        {exporting ? 'Exporting…' : 'Export'}
        <ChevronDown size={14} />
      </button>
      {isOpen && (
        <div className="adm-export-dropdown" role="menu" aria-label={`${title} export formats`}>
          {FORMATS.map((format) => (
            <button
              type="button"
              key={format.id}
              role="menuitem"
              disabled={Boolean(exporting)}
              onClick={() => handleExport(format.id)}
            >
              {exporting === format.id ? 'Preparing…' : format.label}
            </button>
          ))}
          {error && <p className="adm-export-error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
