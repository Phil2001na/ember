import Skeleton from "@/components/Skeleton";

export default function SavedLoading() {
  return (
    <main className="page fade-in">
      <h1 className="page-title">Saved recipes</h1>
      <Skeleton width="46%" height="0.95rem" style={{ marginBottom: 20 }} />

      <div style={{ display: "grid", gap: 12 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="card" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <Skeleton width={`${50 + ((i * 13) % 24)}%`} height="1.05rem" style={{ marginBottom: 8 }} />
              <Skeleton width="92%" height="0.88rem" style={{ marginBottom: 4 }} />
              <Skeleton width="66%" height="0.88rem" style={{ marginBottom: 8 }} />
              <Skeleton width="48%" height="0.78rem" />
            </div>
            <Skeleton width={17} height={17} radius={4} />
            <Skeleton width={17} height={17} radius={4} />
          </div>
        ))}
      </div>
    </main>
  );
}
