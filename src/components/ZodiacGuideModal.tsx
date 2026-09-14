import React from 'react';
import { Sparkles, X, Compass } from 'lucide-react';
import { ZODIAC_SIGNS } from '../utils/zodiac';

interface ZodiacGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ZodiacGuideModal: React.FC<ZodiacGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#182421]/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        id="zodiac-guide-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FAF7F0] border border-[#D8D0BF] rounded-lg w-full max-w-3xl overflow-hidden shadow-2xl text-[#182421] flex flex-col max-h-[90vh] font-sans-almanac animate-fade-in"
      >
        {/* Header in Observatory Ink */}
        <div className="p-5 bg-[#182421] text-[#F3EDDF] border-b border-[#B89A62]/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border border-[#B89A62]/60 overflow-hidden bg-[#121A18] flex items-center justify-center p-0.5 shrink-0">
              <img
                src="/moon_engraving.jpg"
                alt="Moon engraving medallion"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover rounded-full mix-blend-screen"
              />
            </div>
            <div>
              <h3 className="text-lg font-serif-almanac font-bold text-[#F3EDDF]">
                Zodiac Ephemeris &amp; Degree Map (0°–360°)
              </h3>
              <p className="text-xs text-[#D8D0BF]">
                Astronomical ecliptic longitude coordinates and lunar transit focus
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#D8D0BF] hover:text-[#F3EDDF] hover:bg-[#253631] transition shrink-0"
          >
            <X size={20} strokeWidth={2} className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* Content in Warm Parchment */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 bg-[#FAF7F0]">
          <div className="text-xs text-[#182421] bg-[#EBE3D0] border border-[#D8D0BF] rounded-md p-3.5 flex items-start gap-3">
            <Compass size={16} strokeWidth={2} className="w-4 h-4 text-[#B89A62] shrink-0 mt-0.5" />
            <div>
              <span className="font-serif-almanac font-semibold text-[#182421]">
                Mathematical Ecliptic Longitude System
              </span>
              <p className="text-[#5F6D61] mt-0.5 leading-relaxed">
                The Moon traverses the complete 360° zodiac wheel every ~27.3 days (sidereal month), staying in each 30° zodiac sector for approximately 2.2 to 2.5 days. AstroMoon calculates precise geocentric apparent longitudes using high-accuracy astronomical algorithms referenced to the true equinox of date.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ZODIAC_SIGNS.map((sign) => (
              <div
                key={sign.name}
                className="bg-[#FAF6EE] border border-[#D8D0BF] rounded-md p-3.5 space-y-2 hover:border-[#182421] transition shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl leading-none">{sign.symbol}</span>
                    <div>
                      <span className="font-serif-almanac font-bold text-sm text-[#182421]">
                        {sign.name}
                      </span>
                      <span className="text-[11px] text-[#5F6D61] block font-mono">
                        {sign.startDeg}° – {sign.endDeg}°
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-[11px]">
                    <span className="px-2 py-0.5 rounded-full font-medium bg-[#E4ECE5] text-[#182421] border border-[#657367]/40">
                      {sign.element}
                    </span>
                    <span className="text-[#5F6D61] block text-[10px] mt-0.5">
                      {sign.ruler} • {sign.modality}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#182421] leading-relaxed border-t border-[#D8D0BF] pt-2">
                  {sign.description}
                </p>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {sign.activities.slice(0, 2).map((act, i) => (
                    <span
                      key={i}
                      className="text-[10px] bg-[#EAE2D0] text-[#182421] px-2 py-0.5 rounded border border-[#D8D0BF]"
                    >
                      • {act}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#EBE3D0] border-t border-[#D8D0BF] text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#B44732] hover:bg-[#9E3D2A] rounded-md transition shadow-xs font-sans-almanac"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
