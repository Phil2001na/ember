import Skeleton from "@/components/Skeleton";

export default function ShoppingLoading() {
  return (
    <main className="page fade-in">
      <h1 className="page-title">Shopping list</h1>
      <Skeleton width="48%" height="0.95rem" style={{ marginBottom: 20 }} />

      {/* "planning to cook something?" card */}
      <div className="card" style={{ marginBottom: 16, padding: 14 }}>
        <Skeleton width="62%" height="0.9rem" style={{ marginBottom: 10 }} />
        <Skeleton width="80%" height="0.78rem" style={{ marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <Skeleton height={44} radius="var(--radius)" style={{ flex: 1 }} />
          <Skeleton width={52} height={44} radius={999} />
          <Skeleton width={84} height={44} radius={999} />
        </div>
      </div>

      <Skeleton height={50} radius={999} style={{ marginBottom: 16 }} />

      <div style={{ display: "grid", gap: 8 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px" }}
          >
            <Skeleton width={24} height={24} radius="50%" />
            <div style={{ flex: 1, display: "grid", gap: 6 }}>
              <Skeleton width={`${45 + i * 8}%`} height="0.9em" />
              <Skeleton width="60%" height="0.7em" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
