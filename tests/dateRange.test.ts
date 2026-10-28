import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  countInclusiveDays,
  countMonthsSpanned,
  getCalendarPdfRangeError,
  getDateRangeError,
  getRecordExportRangeError,
  isValidIsoDate,
} from '../src/utils/dateRange';

test('isValidIsoDate accepts real dates, including leap days', () => {
  assert.equal(isValidIsoDate('2026-03-15'), true);
  assert.equal(isValidIsoDate('2028-02-29'), true);
  assert.equal(isValidIsoDate('2000-02-29'), true);
});

test('isValidIsoDate rejects impossible dates and loose formats', () => {
  for (const value of ['2026-02-29', '1900-02-29', '2026-02-30', '2026-13-01', '2026-04-31', '2026-3-5', '2026-03-05T00:00', '', '20260305']) {
    assert.equal(isValidIsoDate(value), false, value);
  }
});

test('getDateRangeError rejects invalid or reversed ranges and allows single days', () => {
  assert.equal(getDateRangeError('2026-02-30', '2026-03-01'), 'Enter a valid start and end date.');
  assert.equal(getDateRangeError('2026-03-01', ''), 'Enter a valid start and end date.');
  assert.equal(getDateRangeError('2026-03-02', '2026-03-01'), 'End date must be on or after start date.');
  assert.equal(getDateRangeError('2026-03-01', '2026-03-01'), null);
});

test('range counts include both endpoints', () => {
  assert.equal(countMonthsSpanned('2026-01-31', '2026-02-01'), 2);
  assert.equal(countMonthsSpanned('2026-12-15', '2027-01-15'), 2);
  assert.equal(countInclusiveDays('2026-03-01', '2026-03-01'), 1);
  assert.equal(countInclusiveDays('2028-02-28', '2028-03-01'), 3);
});

test('calendar PDFs allow exactly 24 whole months', () => {
  assert.equal(getCalendarPdfRangeError('2026-01-31', '2027-12-01'), null);
  assert.equal(
    getCalendarPdfRangeError('2026-01-31', '2028-01-01'),
    'Calendar PDFs support up to 24 whole months. Choose a shorter range.'
  );
});

test('ICS and table exports allow exactly 3,660 inclusive days', () => {
  assert.equal(getRecordExportRangeError('2026-01-01', '2036-01-08'), null);
  assert.equal(
    getRecordExportRangeError('2026-01-01', '2036-01-09'),
    'ICS and data-table exports support up to 3,660 days per download. Choose a shorter range.'
  );
});

test('format errors take precedence over size limits', () => {
  assert.equal(getCalendarPdfRangeError('2030-01-01', '2026-01-01'), 'End date must be on or after start date.');
  assert.equal(getRecordExportRangeError('2026-02-30', '2040-01-01'), 'Enter a valid start and end date.');
});
