import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';

export type Slide = {
  title: string;
  description: string;
  image: string; // full URL or resolved via new URL(..., import.meta.url).href
  alt?: string;
};

type Props = {
  slides: Slide[];
  auto?: boolean;
  intervalMs?: number;
  className?: string;
  extra?: ReactNode; // optional overlay (e.g., Login button)
};

export default function Carousel({ slides, auto = true, intervalMs = 6000, className = '', extra }: Props) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  const safeSlides = useMemo(() => slides.filter(Boolean), [slides]);
  const count = safeSlides.length;

  const next = () => setIndex((i) => (i + 1) % count);
  const prev = () => setIndex((i) => (i - 1 + count) % count);
  const go = (i: number) => setIndex(((i % count) + count) % count);

  useEffect(() => {
    if (!auto || count <= 1) return;
  if (timerRef.current) window.clearInterval(timerRef.current);
  timerRef.current = window.setInterval(next, intervalMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, intervalMs, count]);

  if (!count) return null;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured highlights"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prev();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          next();
        }
      }}
    >
      <div className="relative h-[380px] sm:h-[420px] md:h-[480px]">
        {extra && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto">
              {extra}
            </div>
          </div>
        )}
        {safeSlides.map((s, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-700 ease-out ${i === index ? 'opacity-100' : 'opacity-0'} `}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
          >
            <img src={s.image} alt={s.alt ?? s.title} className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
            <div className="relative z-10 h-full flex items-center">
              <div className="p-6 md:p-10 text-white max-w-2xl">
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-black leading-tight drop-shadow">{s.title}</h3>
                <p className="mt-3 md:mt-4 text-sm md:text-base text-white/90 leading-relaxed">{s.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          {/* Controls */}
          <button type="button" aria-label="Previous slide" className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full grid place-items-center backdrop-blur bg-white/10 hover:bg-white/20 text-white" onClick={prev}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5">
              <path fillRule="evenodd" d="M15.53 4.47a.75.75 0 010 1.06L9.06 12l6.47 6.47a.75.75 0 11-1.06 1.06l-7-7a.75.75 0 010-1.06l7-7a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
          </button>
          <button type="button" aria-label="Next slide" className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full grid place-items-center backdrop-blur bg-white/10 hover:bg-white/20 text-white" onClick={next}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5">
              <path fillRule="evenodd" d="M8.47 19.53a.75.75 0 010-1.06L14.94 12 8.47 5.53a.75.75 0 111.06-1.06l7 7a.75.75 0 010 1.06l-7 7a.75.75 0 01-1.06 0z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
            {safeSlides.map((_, i) => (
              <button
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-white' : 'w-2.5 bg-white/60 hover:bg-white/80'}`}
                onClick={() => go(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
