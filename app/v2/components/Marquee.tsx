"use client";

const ITEMS = [
  "Вайп каждую пятницу",
  "Chill x2",
  "Hard low-rate",
  "Кейсы со скинами",
  "Призовой фонд 10 000 ₽",
  "Битва деревень",
  "Честная экономика",
];

export function Marquee() {
  const row = [...ITEMS, ...ITEMS]; // duplicated for the seamless -50% loop
  return (
    <div aria-hidden className="rw-marquee-fade relative overflow-hidden border-y border-[var(--rw-line)] bg-black/20 py-3.5">
      <div className="rw-marquee-track">
        {row.map((item, i) => (
          <span key={i} className="rw-mono flex items-center gap-8 whitespace-nowrap pr-8 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--rw-muted)]">
            {item}
            <span className="text-[var(--rw-orange)]">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
