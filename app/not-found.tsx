import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 18,
        textAlign: "center",
        padding: 24,
        background:
          "radial-gradient(55% 40% at 50% 0%, rgba(255,138,61,0.14), transparent 60%), var(--rw-bg)",
      }}
    >
      <span className="rw-display rw-gradient-text" style={{ fontSize: "clamp(6rem,20vw,11rem)", fontWeight: 900, lineHeight: 0.9 }}>
        404
      </span>
      <h1 className="rw-display" style={{ fontSize: 26, fontWeight: 800, textTransform: "uppercase", margin: 0 }}>
        Ты заблудился на карте
      </h1>
      <p style={{ color: "var(--rw-muted)", maxWidth: 380, margin: 0 }}>
        Такой страницы нет — её зарейдили или она ещё не построена.
      </p>
      <Link
        href="/"
        className="rw-btn-primary"
        style={{ display: "inline-flex", alignItems: "center", height: 52, padding: "0 28px", borderRadius: 14, fontWeight: 700, textDecoration: "none", marginTop: 8 }}
      >
        <span style={{ position: "relative", zIndex: 10 }}>На главную</span>
      </Link>
    </main>
  );
}
