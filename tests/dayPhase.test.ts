import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateRangeDataset, getMoonPhaseInfo } from '../src/utils/astronomy';

const QUARTERS = ['New Moon', 'First Quarter', 'Full Moon', 'Third Quarter'];

test('a day takes the name of its exact quarter even when noon is outside the window', () => {
  // Exact Full Moon 2026-10-26 01:12 in Halifax; by noon the angle is past the ±6° window.
  const [day] = generateRangeDataset('2026-10-26', '2026-10-26', 'northern', 'America/Halifax').days;
  assert.equal(day.quarterType, 'Full Moon');
  assert.equal(getMoonPhaseInfo(day.date).name, 'Waning Gibbous');
  assert.equal(day.noonPhase.name, 'Full Moon');
  assert.equal(day.noonPhase.emoji, '🌕');
  assert.match(day.noonPhase.meaning, /^Culmination/);
  // The daily record, which ICS, PDFs, and Ask use, carries the same phase.
  assert.equal(day.dailySummaryEvent!.phase.name, 'Full Moon');
  assert.match(day.dailySummaryEvent!.description, /Phase: Full Moon/);
  // The noon numbers are unchanged.
  assert.equal(day.noonPhase.fraction, getMoonPhaseInfo(day.date).fraction);
});

test('a neighbouring day inside the window takes the adjacent name, with hemisphere emoji', () => {
  // Halifax: exact First Quarter is on 2026-08-19, but noon on 08-20 is still within 6°.
  const [aug20] = generateRangeDataset('2026-08-20', '2026-08-20', 'northern', 'America/Halifax').days;
  assert.equal(aug20.quarterType, undefined);
  assert.equal(getMoonPhaseInfo(aug20.date).name, 'First Quarter');
  assert.equal(aug20.noonPhase.name, 'Waxing Gibbous');
  assert.equal(aug20.noonPhase.isQuarter, false);

  // Auckland, southern: noon on 2026-11-17 is inside the First Quarter window, before the exact moment.
  const [nov17] = generateRangeDataset('2026-11-17', '2026-11-17', 'southern', 'Pacific/Auckland').days;
  assert.equal(nov17.noonPhase.name, 'Waxing Crescent');
  assert.equal(nov17.noonPhase.emoji, '🌘');
});

test('each exact quarter names exactly one day, and no other day carries a quarter name', () => {
  for (const [timezone, hemisphere] of [['America/Halifax', 'northern'], ['Pacific/Auckland', 'southern'], ['Asia/Kolkata', 'northern']] as const) {
    const { days } = generateRangeDataset('2026-01-01', '2027-12-31', hemisphere, timezone);
    for (const day of days) {
      if (day.quarterType) assert.equal(day.noonPhase.name, day.quarterType, `${timezone} ${day.dateString}`);
      else assert.ok(!QUARTERS.includes(day.noonPhase.name), `${timezone} ${day.dateString} is ${day.noonPhase.name}`);
    }
    const named = days.filter((day) => QUARTERS.includes(day.noonPhase.name)).length;
    assert.equal(named, days.filter((day) => day.quarterType).length);
  }
});
