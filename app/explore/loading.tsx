import Skeleton from "@/components/Skeleton";

export default function ExploreLoading() {
  return (
    <main className="page fade-in">
      <h1 className="page-title">Explore</h1>
      <p className="page-sub">Dishes you could grow into — checked against your pantry.</p>

      <div style={{ display: "grid", gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
              <Skeleton width={`${48 + ((i * 11) % 22)}%`} height="1.1rem" />
              <Skeleton width={88} height={22} radius={999} />
            </div>
            <Skeleton width="94%" height="0.9rem" style={{ marginBottom: 4 }} />
            <Skeleton width="72%" height="0.9rem" style={{ marginBottom: 8 }} />
            <Skeleton width="52%" height="0.8rem" />
          </div>
        ))}
      </div>

      <Skeleton height={50} radius={999} style={{ marginTop: 16 }} />
    </main>
  );
}
