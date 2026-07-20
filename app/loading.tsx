import { Logo } from "./v2/components/Logo";

export default function Loading() {
  return (
    <div
      style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        background: "var(--rw-bg)",
      }}
    >
      <div className="rw-float">
        <Logo />
      </div>
      <div style={{ height: 3, width: 180, overflow: "hidden", borderRadius: 999, background: "var(--rw-panel-2)" }}>
        <div className="rw-marquee-track" style={{ height: "100%", width: "50%", borderRadius: 999, background: "var(--rw-grad)" }} />
      </div>
      <span className="rw-mono" style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--rw-faint)" }}>
        Загрузка…
      </span>
    </div>
  );
}
