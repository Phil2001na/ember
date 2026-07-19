export const metadata = {
  title: "Offline — Ember",
};

export default function OfflinePage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 48 }}>🔥</div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28 }}>
        The fire&apos;s gone quiet
      </h1>
      <p style={{ color: "var(--text-dim)", maxWidth: 320 }}>
        You&apos;re offline. Ember needs a connection to think — check your
        internet and try again.
      </p>
      <a
        href="/"
        style={{
          marginTop: 12,
          padding: "12px 24px",
          borderRadius: "var(--radius)",
          background: "var(--accent)",
          color: "var(--char-950)",
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Try again
      </a>
    </main>
  );
}
