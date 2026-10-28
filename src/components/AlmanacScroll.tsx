import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Feather } from 'lucide-react';
import { Hemisphere } from '../types';
import { MoonVisual } from './MoonVisual';

/**
 * Unrolls the paper on open: measures its laid-out height before the first
 * paint, then animates from nothing to it, so the bottom rod travels with the
 * paper's edge. Skipped under reduced motion.
 */
export function useUnroll(ref: React.RefObject<HTMLElement | null>): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof element.animate !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const height = element.getBoundingClientRect().height;
    const animation = element.animate(
      [{ height: '0px', overflow: 'hidden' }, { height: `${height}px`, overflow: 'hidden' }],
      { duration: 700, easing: 'cubic-bezier(0.55, 0.05, 0.3, 1)' }
    );
    return () => animation.cancel();
  }, [ref]);
}

/** A brass scroll rod with round finials, above and below the paper. */
export const ScrollRod: React.FC = () => (
  <div aria-hidden="true" className="relative z-10 flex shrink-0 items-center">
    <span className="almanac-rod h-4 w-4 shrink-0 rounded-full" />
    <span className="almanac-rod -mx-0.5 h-2.5 flex-1 rounded-sm" />
    <span className="almanac-rod h-4 w-4 shrink-0 rounded-full" />
  </div>
);

interface ScrollPromptProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  disabled?: boolean;
  /** Small line under the prompt: the timezone, or where search runs. */
  caption: React.ReactNode;
  submitLabel: string;
  inputRef?: React.Ref<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

/** One written line with a quill: the scroll's only input. Enter sends; Shift+Enter adds a line. */
export const ScrollPrompt: React.FC<ScrollPromptProps> = ({
  id,
  label,
  value,
  placeholder,
  maxLength,
  disabled,
  caption,
  submitLabel,
  inputRef,
  onChange,
  onSubmit,
}) => {
  const ready = !disabled && value.trim().length > 0;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="px-5 sm:px-8"
    >
      <label htmlFor={id} className="sr-only">{label}</label>
      <div className="flex items-end gap-2 border-b border-[#B89A62]/70 focus-within:border-[#182421]">
        <textarea
          id={id}
          ref={inputRef}
          rows={1}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          enterKeyHint="send"
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onInput={(event) => {
            const input = event.currentTarget;
            input.style.height = 'auto';
            input.style.height = `${input.scrollHeight}px`;
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              onSubmit();
            }
          }}
          className="almanac-prompt max-h-32 min-h-11 w-full min-w-0 flex-1 resize-none bg-transparent py-2 font-serif-almanac text-xl leading-snug text-[#182421] placeholder:italic placeholder:text-[#8A8471] disabled:opacity-60 sm:text-2xl"
        />
        <button
          type="submit"
          disabled={!ready}
          aria-label={submitLabel}
          className={`mb-0.5 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md transition ${
            ready ? 'text-[#B44732] hover:bg-[#B44732]/10' : 'text-[#B89A62]/70'
          }`}
        >
          <Feather size={22} />
        </button>
      </div>
      <p className="mt-1.5 min-w-0 break-words text-[11px] text-[#7A7461]">{caption}</p>
    </form>
  );
};

/** Suggestions as a line of tappable italic phrases rather than a stack of buttons. */
export const Whispers: React.FC<{ label: string; items: string[]; onPick: (item: string) => void }> = ({ label, items, onPick }) => (
  <div className="almanac-reveal" style={{ animationDelay: '620ms' }}>
    <p className="font-cinzel text-[10px] tracking-[0.22em] text-[#86662E]">{label}</p>
    <ul className="mt-0.5">
      {items.map((item, index) => (
        <li key={item} className="almanac-reveal" style={{ animationDelay: `${680 + index * 90}ms` }}>
          <button
            type="button"
            onClick={() => onPick(item)}
            className="min-h-10 rounded-sm py-1 text-left font-serif-almanac text-[17px] italic text-[#4F5A51] underline decoration-[#B89A62]/60 decoration-dotted underline-offset-[5px] transition hover:text-[#182421] hover:decoration-[#B44732]"
          >
            {item}
          </button>
        </li>
      ))}
    </ul>
  </div>
);

/** A Moon cycling through its phases while the almanac works. Still under reduced motion. */
export const MoonLoader: React.FC<{ label: string; hemisphere: Hemisphere }> = ({ label, hemisphere }) => {
  const [angle, setAngle] = useState(90);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setAngle((current) => (current + 12) % 360), 60);
    return () => window.clearInterval(timer);
  }, []);
  const fraction = (1 - Math.cos((angle * Math.PI) / 180)) / 2;
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <MoonVisual phaseAngle={angle} fraction={fraction} hemisphere={hemisphere} size={44} />
      <p className="font-serif-almanac text-base italic text-[#5F6D61]">{label}</p>
    </div>
  );
};

/** A small rule with a central ornament, between parts of the page. */
export const Flourish: React.FC = () => (
  <div aria-hidden="true" className="my-5 flex items-center gap-3 text-[#B89A62]">
    <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#B89A62]/60" />
    <span className="text-xs">✦</span>
    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#B89A62]/60" />
  </div>
);
