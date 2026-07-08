import Skeleton from "./Skeleton";

export default function RecipePreviewSkeleton() {
  return (
    <div className="fade-in">
      <Skeleton width="70%" height="1.5rem" style={{ marginBottom: 10 }} />
      <Skeleton width="95%" height="0.9rem" style={{ marginBottom: 6 }} />
      <Skeleton width="55%" height="0.8rem" style={{ marginBottom: 18 }} />

      <div className="card" style={{ marginBottom: 12 }}>
        <Skeleton width="40%" height="1rem" style={{ marginBottom: 10 }} />
        <div style={{ display: "grid", gap: 8 }}>
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} width={`${75 - i * 8}%`} height="0.92rem" />
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <Skeleton width="35%" height="1rem" style={{ marginBottom: 10 }} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Skeleton width={64} height={26} radius={999} />
          <Skeleton width={86} height={26} radius={999} />
          <Skeleton width={52} height={26} radius={999} />
        </div>
      </div>

      <Skeleton height={52} radius="var(--radius)" />
    </div>
  );
}
