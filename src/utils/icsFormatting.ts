import { AstroRecord, Hemisphere } from '../types.js';
import { getUtcForLocalTime } from './astronomy.js';
import { getZodiacSignFromLongitude } from './zodiac.js';

/** Presentation for both ICS export paths; shared app/PDF records stay intact. */
export function createIcsEventFormatter(timeZone: string, hemisphere: Hemisphere) {
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  return (record: AstroRecord): { title: string; description: string } => {
    const { eventType, sign, phase, metadata } = record;
    let title = record.title;
    let timing: string;

    if (eventType === 'daily_summary') {
      const [year, month, day] = record.localDateString.split('-').map(Number);
      const noon = getUtcForLocalTime(year, month, day, 12, 0, 0, timeZone);
      title = `${sign.symbol} Moon in ${sign.name}`;
      timing = `Daily snapshot: ${dateFormatter.format(noon)} at 12:00 noon`;
    } else {
      const label = eventType === 'eclipse' ? 'Global peak' : eventType === 'quarter' ? 'Exact phase' : 'Sign ingress';
      timing = record.utcTime
        ? `${label}: ${dateFormatter.format(record.utcTime)} at ${timeFormatter.format(record.utcTime)}`
        : `${label}: ${record.localDateString}`;

      if (eventType === 'quarter') {
        const emoji = hemisphere === 'southern' ? phase.southernEmoji : phase.emoji;
        title = `${emoji} ${metadata.quarterType || phase.name} in ${sign.name}`;
      }
    }

    const details: string[] = [];
    if (eventType === 'ingress' && metadata.fromSign && metadata.toSign) {
      details.push(`Sign change: ${metadata.fromSign.name} → ${metadata.toSign.name}`);
    }
    if (metadata.eclipticLongitude !== undefined) {
      const position = getZodiacSignFromLongitude(metadata.eclipticLongitude);
      details.push(`Moon position: ${position.degrees}°${String(position.minutes).padStart(2, '0')}′ ${position.sign.name} · Tropical zodiac`);
    }
    if (eventType === 'daily_summary' || eventType === 'ingress') {
      details.push(`Phase: ${phase.name}`, `Illumination: ${Math.round(phase.fraction * 100)}%`);
    }

    const sections = [`${timing}\nTime zone: ${timeZone}`];
    if (details.length) sections.push(details.join('\n'));

    if (eventType === 'eclipse') {
      sections.push('Visibility: This is the global eclipse peak. Local visibility varies by location.');
    } else {
      const interpretation = eventType === 'daily_summary'
        ? sign.theme
        : eventType === 'quarter'
        ? phase.meaning
        // Sign descriptions already introduce the ingress; omit that repeated sentence.
        : sign.description.replace(/^The Moon shifts into [^.]+\.\s*/, '').replace(/^Energy focus:\s*/, '');
      sections.push(`Traditional interpretation\n${interpretation}`);
    }

    return { title, description: sections.join('\n\n') };
  };
}
