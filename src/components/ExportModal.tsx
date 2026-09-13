import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  FileText,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { FilterSettings } from '../types';
import {
  filterAstroRecords,
  generateRangeDataset,
  generateMonthData,
} from '../utils/astronomy';
import { downloadIcsFile, generateIcsPayload } from '../utils/icsExport';
import { CalendarGrid } from './CalendarGrid';

interface ExportModalProps {
  isOpen: boolean;
  filters: FilterSettings;
  currentYear: number;
  currentMonth: number;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = (props) =>
  props.isOpen ? <ExportModalContent {...props} /> : null;

// Mount a fresh form on each open; hooks always run in the same order.
const ExportModalContent: React.FC<ExportModalProps> = ({
  filters,
  currentYear,
  currentMonth,
  onClose,
}) => {
  const defaultStart =
    filters.startDate ||
    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const defaultLastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
  const defaultEnd =
    filters.endDate ||
    `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(defaultLastDay).padStart(2, '0')}`;

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [activePreset, setActivePreset] = useState<'currentMonth' | 'next3Months' | 'fullYear' | 'custom'>(
    filters.rangePreset === 'year'
      ? 'fullYear'
      : filters.rangePreset === 'threeMonths'
      ? 'next3Months'
      : 'currentMonth'
  );
  const [includeMajorPhases, setIncludeMajorPhases] = useState(
    filters.showFullNewMoon
  );
  const [includeIngresses, setIncludeIngresses] = useState(
    filters.showIngresses
  );
  const [includeDailySigns, setIncludeDailySigns] = useState(
    filters.showDailySigns
  );
  const [includeEclipses, setIncludeEclipses] = useState(filters.showEclipses);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Quick preset ranges keyed to user's active year & month
  const [pdfMode, setPdfMode] = useState<'calendar' | 'table'>('calendar');
  const [isExporting, setIsExporting] = useState(false);
  const captureRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) closeRef.current();
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]'
      ) || []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  // Filters applied to the off-screen calendar grids used for image capture
  const exportFilters = useMemo(
    () => ({
      ...filters,
      startDate,
      endDate,
      showFullNewMoon: includeMajorPhases,
      showIngresses: includeIngresses,
      showDailySigns: includeDailySigns,
      showEclipses: includeEclipses,
    }),
    [
      filters,
      startDate,
      endDate,
      includeMajorPhases,
      includeIngresses,
      includeDailySigns,
      includeEclipses,
    ]
  );

  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const rangeError = !validDate(startDate) || !validDate(endDate)
    ? 'Enter a valid start and end date.'
    : startDate > endDate
    ? 'End date must be on or after start date.'
    : null;
  const [startYear, startMonth] = startDate.split('-').map(Number);
  const [endYear, endMonth] = endDate.split('-').map(Number);
  const monthCount = (endYear - startYear) * 12 + endMonth - startMonth + 1;
  const calendarError = rangeError || (monthCount > 24 ? 'Calendar PDFs support up to 24 whole months. Choose a shorter range.' : null);
  const recordRangeError = rangeError || (
    (Date.parse(`${endDate}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86400000 >= 3660
      ? 'ICS and data-table exports support up to 3,660 days per download. Choose a shorter range.' : null
  );

  // Validate before computing grids, including partially edited date fields.
  const { exportMonths, calculationError } = useMemo(() => {
    if (calendarError) return { exportMonths: [], calculationError: null };
    try {
      const months = Array.from({ length: monthCount }, (_, index) => {
        const offset = startMonth - 1 + index;
        const year = startYear + Math.floor(offset / 12);
        const month = offset % 12;
        return {
          key: `${year}-${month}`,
          label: new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
          days: generateMonthData(year, month, filters.hemisphere, filters.timezone),
        };
      });
      return { exportMonths: months, calculationError: null };
    } catch {
      return { exportMonths: [], calculationError: 'Unable to calculate this calendar. Try another date range or timezone.' };
    }
  }, [calendarError, monthCount, startYear, startMonth, filters.hemisphere, filters.timezone]);

  const handleRangePreset = (
    type: 'currentMonth' | 'next3Months' | 'fullYear'
  ) => {
    setActivePreset(type);
    const y = currentYear;
    const m = currentMonth;

    if (type === 'currentMonth') {
      const first = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0).getDate();
      const last = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(first);
      setEndDate(last);
    } else if (type === 'next3Months') {
      const first = `${y}-${String(m + 1).padStart(2, '0')}-01`;
      const endM = (m + 2) % 12;
      const endY = m + 2 >= 12 ? y + 1 : y;
      const lastDay = new Date(endY, endM + 1, 0).getDate();
      const last = `${endY}-${String(endM + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setStartDate(first);
      setEndDate(last);
    } else if (type === 'fullYear') {
      setStartDate(`${y}-01-01`);
      setEndDate(`${y}-12-31`);
    }
  };

  // Generate shared filtered records for export
  const getFilteredExportRecords = () => {
    if (recordRangeError) throw new Error(recordRangeError);
    const { records } = generateRangeDataset(
      startDate,
      endDate,
      filters.hemisphere,
      filters.timezone
    );

    return filterAstroRecords(records, {
      ...filters,
      startDate,
      endDate,
      showFullNewMoon: includeMajorPhases,
      showIngresses: includeIngresses,
      showDailySigns: includeDailySigns,
      showEclipses: includeEclipses,
    });
  };

  const handleDownloadIcs = () => {
    if (isExporting || recordRangeError) return;
    try {
      const exportRecords = getFilteredExportRecords();
      if (exportRecords.length === 0) {
        alert('No events match the selected filters for this date range.');
        return;
      }

      const calendarTitle = `AstroMoon Almanac (${startDate} to ${endDate})`;
      const icsString = generateIcsPayload(
        exportRecords,
        calendarTitle,
        filters.timezone
      );

      const filename = `astromoon-calendar-${startDate}_to_${endDate}`;
      downloadIcsFile(filename, icsString);

      setDownloadSuccess(
        `Download started: ${exportRecords.length} events in an .ics calendar.`
      );
      setTimeout(() => setDownloadSuccess(null), 5000);
    } catch (err) {
      console.error(err);
      alert('Error generating .ics file. Please check console for details.');
    }
  };

  const handleDownloadTablePdf = async () => {
    const exportRecords = getFilteredExportRecords();
    if (exportRecords.length === 0) {
      alert('No events match the selected filters for this date range.');
      return;
    }
    const { generatePdfDocument } = await import('../utils/pdfExport');
    generatePdfDocument(
      exportRecords,
      { ...exportFilters },
      `AstroMoon Lunar Almanac: ${startDate} to ${endDate}`
    );
    setDownloadSuccess(
      `Generated print-ready data-table PDF with ${exportRecords.length} records!`
    );
  };

  const handleDownloadCalendarPdf = async () => {
    const container = captureRef.current;
    if (!container) return;
    const nodes = Array.from(
      container.querySelectorAll<HTMLElement>('[data-export-month]')
    );
    if (nodes.length === 0) {
      alert('Nothing to export for this date range.');
      return;
    }

    const { toPng } = await import('html-to-image');
    const opts = {
      pixelRatio: 2,
      backgroundColor: '#F3EDDF',
      cacheBust: true,
      skipFonts: true,
    };
    await document.fonts.ready;
    // Warm-up render so fonts/SVG are ready before the real captures
    await toPng(nodes[0], opts);

    const images = [] as {
      label: string;
      dataUrl: string;
      width: number;
      height: number;
    }[];
    for (const node of nodes) {
      const dataUrl = await toPng(node, opts);
      images.push({
        label: node.getAttribute('data-month-label') || '',
        dataUrl,
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
    }

    const { generateCalendarPdf } = await import('../utils/pdfExport');
    generateCalendarPdf(images, { ...exportFilters }, `${startDate} to ${endDate}`);
    setDownloadSuccess(
      `Generated calendar PDF (${images.length} month${
        images.length > 1 ? 's' : ''
      }) for ${startDate} → ${endDate}.`
    );
  };

  const handleDownloadPdf = async () => {
    if (busyRef.current || (pdfMode === 'calendar' ? calendarError || calculationError : recordRangeError)) return;
    busyRef.current = true;
    setDownloadSuccess(null);
    setIsExporting(true);
    try {
      if (pdfMode === 'table') {
        await handleDownloadTablePdf();
      } else {
        await handleDownloadCalendarPdf();
      }
      setTimeout(() => setDownloadSuccess(null), 6000);
    } catch (err) {
      console.error(err);
      alert('Error generating PDF. Please check the console for details.');
    } finally {
      busyRef.current = false;
      setIsExporting(false);
    }
  };

  return (
    <div
      id="export-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#182421]/80 backdrop-blur-sm animate-fade-in"
      onClick={() => { if (!isExporting) onClose(); }}
    >
      <div
        id="export-modal-card"
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        aria-busy={isExporting}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FAF7F0] border border-[#D8D0BF] rounded-lg w-full max-w-xl overflow-hidden shadow-2xl text-[#182421] max-h-[calc(100dvh-2rem)] flex flex-col font-sans-almanac animate-fade-in"
      >
        {/* Modal Header in Observatory Ink */}
        <div className="relative shrink-0 p-4 sm:p-6 bg-[#182421] text-[#F3EDDF] border-b border-[#B89A62]/40 flex items-start justify-between overflow-hidden">
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border border-[#B89A62]/60 overflow-hidden bg-[#121A18] flex items-center justify-center p-0.5 shrink-0">
              <img
                src="/moon_engraving.jpg"
                alt="Moon engraving icon"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-full mix-blend-screen"
              />
            </div>
            <div>
              <h3 id="export-modal-title" className="text-xl font-serif-almanac font-bold text-[#F3EDDF] tracking-tight">
                Export Lunar Almanac
              </h3>
              <p className="text-xs text-[#D8D0BF] font-sans-almanac mt-0.5">
                Generate calendar files (.ics) or print-ready PDF documents
              </p>
            </div>
          </div>

          <button
            id="close-export-modal-btn"
            aria-label="Close export dialog"
            disabled={isExporting}
            onClick={() => { if (!isExporting) onClose(); }}
            className="relative z-10 min-w-11 min-h-11 p-1.5 rounded-md text-[#D8D0BF] hover:text-[#F3EDDF] hover:bg-[#253631] transition shrink-0"
          >
            <X size={20} strokeWidth={2} className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="min-h-0 overflow-y-auto overscroll-contain">
        <fieldset disabled={isExporting} className="min-w-0 p-4 sm:p-6 space-y-5 bg-[#FAF7F0]">
          {/* Calendar Compatibility Notice */}
          <div className="p-3.5 rounded-md bg-[#EBE3D0] border border-[#D8D0BF] flex items-start gap-2.5 text-xs text-[#182421]">
            <AlertCircle size={16} strokeWidth={2} className="w-4 h-4 text-[#B89A62] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Downloading an <code>.ics</code> file provides a static, one-time import into your calendar software (Apple Calendar, Google Calendar, Outlook). Events include stable unique IDs and UTC timestamps per RFC 5545.
            </p>
          </div>

          {/* Date Range Selection */}
          <div className="space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="text-xs font-serif-almanac font-semibold uppercase tracking-wider text-[#182421]">
                Export Date Range
              </label>
              <div className="grid grid-cols-3 gap-1 text-xs [&>button]:min-h-11">
                <button
                  type="button"
                  onClick={() => handleRangePreset('currentMonth')}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    activePreset === 'currentMonth'
                      ? 'bg-[#182421] text-[#F3EDDF] font-semibold shadow-xs'
                      : 'bg-[#FAF6EE] border border-[#D8D0BF] hover:bg-[#EAE2D0] text-[#182421]'
                  }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => handleRangePreset('next3Months')}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    activePreset === 'next3Months'
                      ? 'bg-[#182421] text-[#F3EDDF] font-semibold shadow-xs'
                      : 'bg-[#FAF6EE] border border-[#D8D0BF] hover:bg-[#EAE2D0] text-[#182421]'
                  }`}
                >
                  3 Months
                </button>
                <button
                  type="button"
                  onClick={() => handleRangePreset('fullYear')}
                  className={`px-2.5 py-1 rounded-md transition font-medium ${
                    activePreset === 'fullYear'
                      ? 'bg-[#182421] text-[#F3EDDF] font-semibold shadow-xs'
                      : 'bg-[#FAF6EE] border border-[#D8D0BF] hover:bg-[#EAE2D0] text-[#182421]'
                  }`}
                >
                  Full Year {currentYear}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 min-[375px]:grid-cols-2 gap-3">
              <div>
                <label htmlFor="export-start-date" className="block text-[11px] text-[#657367] mb-1">
                  Start Date
                </label>
                <input
                  id="export-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="w-full min-w-0 min-h-11 bg-[#FAF6EE] border border-[#D8D0BF] rounded-md px-3 py-2 text-base text-[#182421] focus:outline-none focus:border-[#182421] font-mono"
                />
              </div>

              <div>
                <label htmlFor="export-end-date" className="block text-[11px] text-[#657367] mb-1">
                  End Date
                </label>
                <input
                  id="export-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setActivePreset('custom');
                  }}
                  className="w-full min-w-0 min-h-11 bg-[#FAF6EE] border border-[#D8D0BF] rounded-md px-3 py-2 text-base text-[#182421] focus:outline-none focus:border-[#182421] font-mono"
                />
              </div>
            </div>
          </div>

          {/* Event Content Toggles */}
          <div className="space-y-2">
            <label className="text-xs font-serif-almanac font-semibold uppercase tracking-wider text-[#182421]">
              Included Astronomical Events
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex min-h-11 items-center gap-2 p-2.5 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] hover:border-[#182421] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMajorPhases}
                  onChange={(e) => setIncludeMajorPhases(e.target.checked)}
                  className="w-4 h-4 shrink-0 rounded border-[#D8D0BF] text-[#B44732] focus:ring-0 bg-white cursor-pointer"
                />
                <span>Exact Moon Phases (New, Full, Quarters)</span>
              </label>

              <label className="flex min-h-11 items-center gap-2 p-2.5 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] hover:border-[#182421] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeIngresses}
                  onChange={(e) => setIncludeIngresses(e.target.checked)}
                  className="w-4 h-4 shrink-0 rounded border-[#D8D0BF] text-[#657367] focus:ring-0 bg-white cursor-pointer"
                />
                <span>Zodiac Ingress Transitions</span>
              </label>

              <label className="flex min-h-11 items-center gap-2 p-2.5 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] hover:border-[#182421] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDailySigns}
                  onChange={(e) => setIncludeDailySigns(e.target.checked)}
                  className="w-4 h-4 shrink-0 rounded border-[#D8D0BF] text-[#182421] focus:ring-0 bg-white cursor-pointer"
                />
                <span>Daily Noon Sign Snapshot</span>
              </label>

              <label className="flex min-h-11 items-center gap-2 p-2.5 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] hover:border-[#182421] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeEclipses}
                  onChange={(e) => setIncludeEclipses(e.target.checked)}
                  className="w-4 h-4 shrink-0 rounded border-[#D8D0BF] text-[#B44732] focus:ring-0 bg-white cursor-pointer"
                />
                <span>Global Solar &amp; Lunar Eclipses</span>
              </label>
            </div>
          </div>

          {/* Success Notification */}
          {downloadSuccess && (
            <div className="p-3 bg-[#E4ECE5] border border-[#657367]/40 rounded-md text-xs text-[#182421] flex items-center gap-2">
              <Check size={16} strokeWidth={2} className="w-4 h-4 text-[#657367] shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          {/* PDF layout selector */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs [&_button]:min-h-11">
            <span className="text-[#657367] font-medium">PDF layout:</span>
            <div className="inline-flex rounded-md border border-[#D8D0BF] bg-[#FAF6EE] p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setPdfMode('calendar')}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  pdfMode === 'calendar'
                    ? 'bg-[#182421] text-[#F3EDDF] shadow-xs'
                    : 'text-[#657367] hover:text-[#182421]'
                }`}
              >
                Calendar grid
              </button>
              <button
                type="button"
                onClick={() => setPdfMode('table')}
                className={`px-2.5 py-1 rounded font-medium transition ${
                  pdfMode === 'table'
                    ? 'bg-[#182421] text-[#F3EDDF] shadow-xs'
                    : 'text-[#657367] hover:text-[#182421]'
                }`}
              >
                Data table
              </button>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-[#657367]">
            {pdfMode === 'calendar'
              ? 'Calendar PDF includes every whole month touched by your dates, one per A4 page (maximum 24 months). It always uses the full desktop layout.'
              : 'Data-table PDF includes events within your selected dates. ICS and data-table exports support up to 3,660 days per download.'}
            {' '}Moon orientation: {filters.hemisphere} hemisphere.
          </p>
          {(rangeError || recordRangeError || (pdfMode === 'calendar' && (calendarError || calculationError))) && (
            <p role="alert" className="rounded-md border border-[#B44732]/40 p-3 text-sm text-[#B44732]">
              {rangeError || recordRangeError || calendarError || calculationError}
            </p>
          )}

          {/* Export Action Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              id="export-ics-action-btn"
              onClick={handleDownloadIcs}
              disabled={isExporting || !!recordRangeError}
              className="p-4 rounded-md bg-[#FAF6EE] border border-[#B44732]/40 hover:border-[#B44732] text-left transition flex flex-col justify-between group shadow-xs hover:bg-[#FFFDF9] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <CalendarIcon size={20} strokeWidth={2} className="w-5 h-5 text-[#B44732] group-hover:scale-105 transition shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#B44732]/15 text-[#B44732]">
                    RFC 5545
                  </span>
                </div>
                <h4 className="font-serif-almanac font-semibold text-sm text-[#182421]">
                  Download .ics Calendar
                </h4>
                <p className="text-xs text-[#657367] mt-1">
                  Import into Apple Calendar, Google Calendar, or Outlook.
                </p>
              </div>
              <span className="text-xs text-[#B44732] font-semibold mt-4 flex items-center gap-1">
                Download .ics File →
              </span>
            </button>

            <button
              id="export-pdf-action-btn"
              onClick={handleDownloadPdf}
              disabled={isExporting || !!(pdfMode === 'calendar' ? calendarError || calculationError : recordRangeError)}
              className="p-4 rounded-md bg-[#FAF6EE] border border-[#182421]/30 hover:border-[#182421] text-left transition flex flex-col justify-between group shadow-xs hover:bg-[#FFFDF9] disabled:opacity-60 disabled:cursor-wait disabled:hover:border-[#182421]/30"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <FileText size={20} strokeWidth={2} className="w-5 h-5 text-[#182421] group-hover:scale-105 transition shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#182421]/10 text-[#182421]">
                    {pdfMode === 'calendar' ? 'Calendar' : 'Data table'}
                  </span>
                </div>
                <h4 className="font-serif-almanac font-semibold text-sm text-[#182421]">
                  {pdfMode === 'calendar'
                    ? 'Download Calendar PDF'
                    : 'Download Data-Table PDF'}
                </h4>
                <p className="text-xs text-[#657367] mt-1">
                  {pdfMode === 'calendar'
                    ? 'Full desktop month calendars, one per A4 page, from any device.'
                    : 'Multi-page data table with repeated headers, summary stats, and page numbering.'}
                </p>
              </div>
              <span className="text-xs text-[#182421] font-semibold mt-4 flex items-center gap-1">
                {isExporting ? 'Generating PDF…' : 'Download PDF File →'}
              </span>
            </button>
          </div>
        </fieldset>
        </div>

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-[#D8D0BF] bg-[#EBE3D0] flex items-center justify-between gap-3 text-xs">
          <span className="min-w-0 break-words text-[#657367]">
            Timezone: {filters.timezone}
          </span>
          <button
            onClick={() => { if (!isExporting) onClose(); }}
            disabled={isExporting}
            className="min-h-11 shrink-0 px-4 py-1.5 rounded-md bg-[#FAF6EE] border border-[#D8D0BF] hover:bg-[#D8D0BF] text-[#182421] font-medium transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* Off-screen calendar grids captured to images for the Calendar PDF layout */}
      <div
        ref={captureRef}
        aria-hidden="true"
        inert
        style={{
          position: 'fixed',
          top: 0,
          left: '-10000px',
          width: '900px',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        {exportMonths.map((mo) => (
          <div
            key={mo.key}
            data-export-month=""
            data-month-label={mo.label}
            className="bg-[#F3EDDF] p-5"
          >
            <h3 className="font-serif-almanac text-2xl text-[#182421] tracking-tight mb-0.5">
              {mo.label}
            </h3>
            <p className="text-[11px] text-[#657367] mb-3 font-sans-almanac">
              AstroMoon · Noon snapshots · Zone: {filters.timezone}
            </p>
            <CalendarGrid
              days={mo.days}
              filters={exportFilters}
              onSelectDay={() => {}}
              forExport
            />
          </div>
        ))}
      </div>
    </div>
  );
};
