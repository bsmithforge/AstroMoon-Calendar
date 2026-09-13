/**
 * Print-Ready PDF Generator using jsPDF styled in the "Midnight Almanac" aesthetic
 */

import { jsPDF } from 'jspdf';
import { AstroRecord, FilterSettings } from '../types';

export function generatePdfDocument(
  records: AstroRecord[],
  filters: FilterSettings,
  title = 'AstroMoon — Lunar Almanac & Ephemeris'
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Header & Footer painter
  const drawHeaderAndFooter = (pageNum: number, totalPages: number) => {
    // Header
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(24, 36, 33); // Observatory Ink (#182421)
    doc.text('ASTROMOON', margin, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(101, 115, 103); // Weathered Sage (#657367)
    doc.text(
      `Lunar calendar & almanac • ${filters.hemisphere.toUpperCase()} HEMISPHERE • Zone: ${filters.timezone}`,
      margin + 42,
      13
    );

    // Antique Brass divider rule (#B89A62)
    doc.setDrawColor(184, 154, 98);
    doc.setLineWidth(0.4);
    doc.line(margin, 17, pageWidth - margin, 17);

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(101, 115, 103);
    doc.text(
      'AstroMoon Almanac • Ephemeris calculated via astronomy-engine • True Equinox of Date',
      margin,
      pageHeight - 8
    );
    doc.text(
      `Page ${pageNum} of ${totalPages}`,
      pageWidth - margin - 20,
      pageHeight - 8
    );
  };

  // Summary counts from the filtered records
  const quartersCount = records.filter((r) => r.eventType === 'quarter').length;
  const ingressesCount = records.filter((r) => r.eventType === 'ingress').length;
  const eclipsesCount = records.filter((r) => r.eventType === 'eclipse').length;
  const dailyCount = records.filter((r) => r.eventType === 'daily_summary').length;

  let y = 24;

  // Title Banner on First Page
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(24, 36, 33);
  doc.text(title, margin, y);

  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(101, 115, 103);
  doc.text(
    `Date Range: ${filters.startDate || 'Start'} to ${filters.endDate || 'End'} (${filters.timezone})`,
    margin,
    y
  );

  // Summary stats bar in Parchment (#F3EDDF) with Paper Edge border (#D8D0BF)
  y += 5;
  doc.setFillColor(243, 237, 223);
  doc.roundedRect(margin, y, contentWidth, 7, 1, 1, 'F');
  doc.setDrawColor(216, 208, 191);
  doc.roundedRect(margin, y, contentWidth, 7, 1, 1, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(24, 36, 33);
  doc.text(
    `Summary: ${quartersCount} Moon Quarters | ${ingressesCount} Sign Ingresses | ${eclipsesCount} Eclipses | ${dailyCount} Daily Snapshots`,
    margin + 3,
    y + 4.6
  );

  y += 11;

  // Column layout + text sanitizers (jsPDF standard fonts are WinAnsi-only)
  const COL_DATE = margin + 3;
  const COL_TIME = margin + 23;
  const COL_EVENT = margin + 38;
  const COL_ZODIAC = margin + 82;
  const COL_DETAILS = margin + 134;
  const rightEdge = margin + contentWidth;

  const cleanForPdf = (s: string): string =>
    s
      .replace(/\u2192/g, '->')
      .replace(/[\uD800-\uDFFF]/g, '')
      .replace(/[\uFE00-\uFE0F]/g, '')
      .replace(/[\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF]/g, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^[\s\u00B7-]+/, '')
      .trim();

  const fitText = (text: string, maxWidth: number): string => {
    if (doc.getTextWidth(text) <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && doc.getTextWidth(t + '...') > maxWidth) {
      t = t.slice(0, -1);
    }
    return t.trim() + '...';
  };

  // Table header painter: Observatory Ink (#182421)
  const drawTableHeader = (curY: number): number => {
    doc.setFillColor(24, 36, 33);
    doc.rect(margin, curY, contentWidth, 6.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(243, 237, 223); // Parchment

    doc.text('DATE', COL_DATE, curY + 4.5);
    doc.text('TIME', COL_TIME, curY + 4.5);
    doc.text('EVENT / PHASE', COL_EVENT, curY + 4.5);
    doc.text('ZODIAC POSITION', COL_ZODIAC, curY + 4.5);
    doc.text('ASTRONOMICAL DETAILS', COL_DETAILS, curY + 4.5);

    return curY + 6.5;
  };

  y = drawTableHeader(y);

  const rowHeight = 7.0;

  for (let i = 0; i < records.length; i++) {
    const rec = records[i];

    // Check if new page is needed
    if (y + rowHeight > pageHeight - 16) {
      doc.addPage();
      y = 23;
      y = drawTableHeader(y);
    }

    // Alternating row background: Warm ivory (#FAF7F0)
    if (i % 2 === 0) {
      doc.setFillColor(250, 247, 240);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
    }

    // Accent line for major events
    if (rec.eventType === 'quarter' || rec.eventType === 'eclipse') {
      doc.setDrawColor(216, 208, 191);
      doc.rect(margin, y, contentWidth, rowHeight, 'S');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(24, 36, 33);

    // Column 1: Date
    doc.text(fitText(rec.localDateString, COL_TIME - COL_DATE - 2), COL_DATE, y + 4.6);

    // Column 2: Time
    const timeStr = rec.formattedLocalTime || '12:00';
    doc.text(fitText(timeStr, COL_EVENT - COL_TIME - 2), COL_TIME, y + 4.6);

    // Column 3: Event / Phase
    doc.setFont('helvetica', 'bold');
    let eventLabel = rec.title;
    if (rec.eventType === 'quarter') {
      doc.setTextColor(140, 105, 45); // Antique Brass (#B89A62)
      eventLabel = `[${rec.metadata.quarterType || 'Quarter'}]`;
    } else if (rec.eventType === 'eclipse') {
      doc.setTextColor(180, 71, 50); // Vermilion (#B44732)
      eventLabel = `* ${rec.metadata.eclipseKind?.toUpperCase()} ECLIPSE *`;
    } else if (rec.eventType === 'ingress') {
      doc.setTextColor(80, 105, 90); // Weathered Sage
      eventLabel = `Ingress: ${rec.sign.name}`;
    } else {
      doc.setTextColor(101, 115, 103);
      eventLabel = `${rec.phase.name} (${Math.round(rec.phase.fraction * 100)}%)`;
    }
    doc.text(fitText(cleanForPdf(eventLabel), COL_ZODIAC - COL_EVENT - 2), COL_EVENT, y + 4.6);

    // Column 4: Zodiac Position
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(24, 36, 33);
    const zodiacStr = rec.summary || `${rec.sign.name} (${rec.sign.symbol})`;
    doc.text(fitText(cleanForPdf(zodiacStr), COL_DETAILS - COL_ZODIAC - 2), COL_ZODIAC, y + 4.6);

    // Column 5: Coordinates
    const lonVal = rec.metadata?.eclipticLongitude;
    const lonStr = lonVal !== undefined ? `${lonVal.toFixed(1)}°` : '—';
    const coordsStr = `Lon: ${lonStr} | Illum: ${Math.round(
      rec.phase.fraction * 100
    )}%`;
    doc.text(fitText(cleanForPdf(coordsStr), rightEdge - COL_DETAILS - 2), COL_DETAILS, y + 4.6);

    y += rowHeight;
  }

  // Paint headers and footers with accurate total page count
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawHeaderAndFooter(p, totalPages);
  }

  const safeTitle = (filters.startDate || 'almanac').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`astromoon-almanac-${safeTitle}.pdf`);
}

export interface CalendarPdfImage {
  label: string;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Builds a PDF from pre-rendered calendar month images (captured via html-to-image),
 * one month per A4 page, with the shared "Midnight Almanac" header & footer.
 */
export function generateCalendarPdf(
  images: CalendarPdfImage[],
  filters: FilterSettings,
  title = 'AstroMoon — Lunar Calendar'
): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const totalPages = Math.max(images.length, 1);

  const drawHeaderAndFooter = (pageNum: number) => {
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(24, 36, 33);
    doc.text('ASTROMOON', margin, 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(101, 115, 103);
    doc.text(
      `Lunar calendar & almanac • ${filters.hemisphere.toUpperCase()} HEMISPHERE • Zone: ${filters.timezone}`,
      margin + 42,
      13
    );

    doc.setDrawColor(184, 154, 98);
    doc.setLineWidth(0.4);
    doc.line(margin, 17, pageWidth - margin, 17);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(101, 115, 103);
    doc.text(
      'AstroMoon Almanac • Ephemeris calculated via astronomy-engine • True Equinox of Date',
      margin,
      pageHeight - 8
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 8);
  };

  images.forEach((img, idx) => {
    if (idx > 0) doc.addPage();
    drawHeaderAndFooter(idx + 1);

    const top = 24;
    const availHeight = pageHeight - top - 14;
    let w = contentWidth;
    let h = img.width > 0 ? (img.height / img.width) * w : availHeight;
    if (h > availHeight) {
      h = availHeight;
      w = img.height > 0 ? (img.width / img.height) * h : contentWidth;
    }
    const x = margin + (contentWidth - w) / 2;
    doc.addImage(img.dataUrl, 'PNG', x, top, w, h, undefined, 'FAST');
  });

  const safeTitle = title.replace(/[^a-zA-Z0-9_-]+/g, '_');
  doc.save(`astromoon-calendar-${safeTitle}.pdf`);
}
