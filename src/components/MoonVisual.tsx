import React from 'react';
import { Hemisphere } from '../types';

interface MoonVisualProps {
  phaseAngle: number; // 0..360
  fraction: number; // 0..1
  hemisphere?: Hemisphere;
  size?: number;
  className?: string;
}

export const MoonVisual: React.FC<MoonVisualProps> = ({
  phaseAngle,
  fraction,
  hemisphere = 'northern',
  size = 32,
  className = '',
}) => {
  const instanceId = React.useId().replace(/:/g, '');
  const glowId = `moonGlow-${instanceId}`;
  const darkSideId = `darkSide-${instanceId}`;

  // Normalize angle
  const normAngle = ((phaseAngle % 360) + 360) % 360;
  const isWaxing = normAngle < 180;
  
  // In northern hemisphere:
  // Waxing: light is on the right
  // Waning: light is on the left
  // In southern hemisphere, it is mirrored
  const lightOnRight = hemisphere === 'northern' ? isWaxing : !isWaxing;

  // Radius for SVG
  const r = 16;
  const cx = 18;
  const cy = 18;

  // Calculate the ellipse width for the terminator:
  // At New Moon (fraction = 0), terminator width is r (no illuminated disc)
  // At Quarters (fraction = 0.5), terminator width is 0 (straight vertical line)
  // At Full Moon (fraction = 1.0), terminator width is r (full disc)
  const k = Math.abs(2 * fraction - 1) * r;
  const sweep = fraction >= 0.5 ? (lightOnRight ? 1 : 0) : (lightOnRight ? 0 : 1);

  // Background dark moon circle
  // Then overlay illuminated crescent/gibbous
  let pathD = '';
  if (fraction < 0.01) {
    // Virtually completely dark (New Moon)
    pathD = '';
  } else if (fraction > 0.99) {
    // Completely illuminated (Full Moon)
    pathD = `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx},${cy + r} A ${r},${r} 0 1,1 ${cx},${cy - r} Z`;
  } else {
    // Construct arc:
    // Outer semi-circle on the illuminated side:
    // If lightOnRight: from top (cx, cy-r) clockwise to bottom (cx, cy+r)
    // If !lightOnRight: from top (cx, cy-r) counter-clockwise to bottom (cx, cy+r)
    const outerArc = lightOnRight
      ? `A ${r},${r} 0 0,1 ${cx},${cy + r}`
      : `A ${r},${r} 0 0,0 ${cx},${cy + r}`;

    // Inner terminator arc back from bottom (cx, cy+r) to top (cx, cy-r):
    // The rx radius is k.
    const innerArc = `A ${k},${r} 0 0,${sweep} ${cx},${cy - r}`;

    pathD = `M ${cx},${cy - r} ${outerArc} ${innerArc} Z`;
  }

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      title={`${Math.round(fraction * 100)}% illuminated`}
    >
      <svg
        viewBox="0 0 36 36"
        width={size}
        height={size}
        className="overflow-visible shrink-0"
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      >
        <defs>
          <radialGradient id={glowId} cx="38%" cy="38%" r="62%">
            <stop offset="0%" stopColor="#FFFFFC" stopOpacity="1" />
            <stop offset="65%" stopColor="#F7F2E6" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#E5DCBF" stopOpacity="0.95" />
          </radialGradient>
          <radialGradient id={darkSideId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#253530" />
            <stop offset="100%" stopColor="#182421" />
          </radialGradient>
        </defs>

        {/* Dark base disc with fine antique brass/ink rim */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={`url(#${darkSideId})`}
          stroke="#B89A62"
          strokeOpacity="0.5"
          strokeWidth="0.75"
        />

        {/* Illuminated portion */}
        {pathD && (
          <path
            d={pathD}
            fill={`url(#${glowId})`}
            className="transition-all duration-300"
          />
        )}
      </svg>
    </div>
  );
};
