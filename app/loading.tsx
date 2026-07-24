import { Logo } from "./v2/components/Logo";
import { Embers } from "./v2/components/Effects";

/** Branded "Molten Steel" loading screen — the forge lighting up. */
export default function Loading() {
  return (
    <div
      className="rw-root relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden"
      style={{ background: "var(--rw-bg)" }}
    >
      {/* drifting molten glows */}
      <div
        aria-hidden
        className="rw-drift-glow pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 540, height: 540, top: "34%", background: "radial-gradient(circle, rgba(255,106,26,0.16), transparent 66%)" }}
      />
      <div
        aria-hidden
        className="rw-drift-glow pointer-events-none absolute rounded-full blur-3xl"
        style={{ width: 380, height: 380, top: "12%", right: "10%", background: "radial-gradient(circle, rgba(226,84,58,0.12), transparent 66%)" }}
      />

      {/* ambient rising embers */}
      <Embers count={30} />

      {/* center lockup */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative flex items-center justify-center">
          {/* flickering forge glow behind the mark */}
          <span className="rw-fire-glow" style={{ left: "50%", top: "50%", width: 420, height: 240 }} />
          <div className="rw-float">
            <div className="scale-[1.7]">
              <Logo />
            </div>
          </div>
        </div>

        <div className="rw-load-track" aria-hidden>
          <span className="rw-load-bar" />
        </div>

        <span
          className="rw-mono"
          style={{ fontSize: 11, letterSpacing: "0.42em", textTransform: "uppercase", color: "var(--rw-faint)" }}
        >
          Загрузка…
        </span>
      </div>
    </div>
  );
}
