import Skeleton from "@/components/Skeleton";

export default function PantryLoading() {
  return (
    <main className="page fade-in">
      <h1 className="page-title">Pantry</h1>
      <Skeleton width="58%" height="0.95rem" style={{ marginBottom: 20 }} />

      {/* scan button + manual add row */}
      <Skeleton height={50} radius={999} style={{ marginBottom: 12 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <Skeleton height={46} radius="var(--radius)" style={{ flex: 1 }} />
        <Skeleton width={78} height={46} radius={999} />
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="card"
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px" }}
          >
            <Skeleton width={`${34 + ((i * 13) % 30)}%`} height="1em" />
            <Skeleton width={92} height={28} radius={999} />
          </div>
        ))}
      </div>
    </main>
  );
}
