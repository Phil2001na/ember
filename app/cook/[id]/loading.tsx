import Skeleton from "@/components/Skeleton";

/**
 * Starting a cook is the longest hop in the app — this puts the session frame
 * (header, progress bar, step card, controls) on screen the moment it starts.
 */
export default function CookLoading() {
  return (
    <main
      className="page fade-in"
      style={{ paddingBottom: 120, minHeight: "100dvh", display: "flex", flexDirection: "column" }}
    >
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Skeleton width={28} height={28} radius={999} />
        <Skeleton width="46%" height="0.88rem" />
        <Skeleton width={54} height={24} radius={999} />
      </div>

      {/* progress bar */}
      <div style={{ height: 4, background: "var(--surface-3)", borderRadius: 2, marginBottom: 22 }} />

      {/* the step */}
      <div className="card" style={{ flex: 1 }}>
        <Skeleton width={104} height="0.75rem" style={{ marginBottom: 14 }} />
        <Skeleton width="96%" height="1.3rem" style={{ marginBottom: 8 }} />
        <Skeleton width="78%" height="1.3rem" style={{ marginBottom: 20 }} />
        <Skeleton width="55%" height="0.9rem" style={{ marginBottom: 8 }} />
        <Skeleton width="40%" height="0.9rem" />
      </div>

      {/* step controls */}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <Skeleton width={52} height={52} radius={999} />
        <Skeleton height={52} radius={999} style={{ flex: 1 }} />
      </div>
    </main>
  );
}
