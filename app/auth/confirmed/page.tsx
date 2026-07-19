export const metadata = {
  title: "Email confirmed — Ember",
};

export default function ConfirmedPage() {
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
        Kitchen saved
      </h1>
      <p style={{ color: "var(--text-dim)", maxWidth: 320 }}>
        Your email is confirmed. Your recipes and pantry now follow your
        account — head back to the app.
      </p>
      <a
        href="/profile"
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
        Open Ember
      </a>
    </main>
  );
}
