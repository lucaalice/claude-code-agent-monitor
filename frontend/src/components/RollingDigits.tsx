import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string | number;
  color: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
}

interface CharState {
  char: string;
  prev: string | null;
  animating: boolean;
  key: number;
}

export function RollingDigits({ value, color, fontSize = 20, fontFamily, fontWeight = 700 }: Props) {
  const text = String(value);
  const prevRef = useRef(text);
  const keyRef = useRef(0);
  const [chars, setChars] = useState<CharState[]>(() =>
    text.split('').map(c => ({ char: c, prev: null, animating: false, key: keyRef.current++ }))
  );

  useEffect(() => {
    const prev = prevRef.current;
    const next = text;
    prevRef.current = next;

    if (prev === next) return;

    // Pad shorter string from left so digits align from right
    const maxLen = Math.max(prev.length, next.length);
    const paddedPrev = prev.padStart(maxLen);
    const paddedNext = next.padStart(maxLen);

    const newChars: CharState[] = [];
    for (let i = 0; i < maxLen; i++) {
      const p = paddedPrev[i] === ' ' ? null : paddedPrev[i];
      const n = paddedNext[i] === ' ' ? null : paddedNext[i];

      if (n === null) continue; // skip leading spaces in new value

      const changed = p !== n;
      newChars.push({
        char: n,
        prev: changed ? (p || null) : null,
        animating: changed,
        key: keyRef.current++,
      });
    }

    setChars(newChars);

    // Clear animation state after transition
    const timer = setTimeout(() => {
      setChars(cs => cs.map(c => ({ ...c, animating: false, prev: null })));
    }, 400);

    return () => clearTimeout(timer);
  }, [text]);

  const charHeight = fontSize * 1.2;

  return (
    <span style={{
      display: 'inline-flex',
      overflow: 'hidden',
      height: charHeight,
      lineHeight: `${charHeight}px`,
      fontFamily,
      fontSize,
      fontWeight,
      color,
    }}>
      {chars.map((c) => {
        // Non-digit characters (., $, K, M, m, s, :) don't animate
        const isDigit = /\d/.test(c.char);
        if (!isDigit || !c.animating || !c.prev) {
          return (
            <span key={c.key} style={{ display: 'inline-block', width: 'auto' }}>
              {c.char}
            </span>
          );
        }

        return (
          <span
            key={c.key}
            style={{
              display: 'inline-block',
              position: 'relative',
              width: 'auto',
              height: charHeight,
              overflow: 'hidden',
            }}
          >
            {/* Old digit sliding up and out */}
            <span style={{
              display: 'block',
              animation: 'digitOut 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }}>
              {c.prev}
            </span>
            {/* New digit sliding up from below */}
            <span style={{
              display: 'block',
              position: 'absolute',
              top: 0,
              left: 0,
              animation: 'digitIn 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards',
            }}>
              {c.char}
            </span>
          </span>
        );
      })}
    </span>
  );
}
