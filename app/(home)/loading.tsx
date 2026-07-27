import Skeleton from "@/components/Skeleton";

/**
 * The kitchen chat shell, minus the words — rendered the instant the Cook tab
 * is tapped so the greeting and composer land in their final positions.
 */
export default function HomeLoading() {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: "calc(84px + env(safe-area-inset-bottom))",
        maxWidth: 560,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        zIndex: 60,
      }}
    >
      <div style={{ padding: "20px 18px 10px", paddingTop: "calc(20px + env(safe-area-inset-top))" }}>
        <Skeleton width="62%" height="1.35rem" radius={8} />
      </div>

      <div style={{ flex: 1, padding: "6px 18px" }}>
        <div className="card" style={{ marginTop: 26, padding: "16px 18px" }}>
          <Skeleton width="92%" height="0.92rem" style={{ marginBottom: 8 }} />
          <Skeleton width="58%" height="0.92rem" style={{ marginBottom: 14 }} />
          <Skeleton width={52} height="0.8rem" />
        </div>
      </div>

      <div style={{ padding: "10px 14px" }}>
        <div className="composer">
          <Skeleton width={42} height={42} radius={999} />
          <Skeleton height="1rem" style={{ flex: 1, margin: "0 6px" }} />
          <Skeleton width={42} height={42} radius={999} />
          <Skeleton width={42} height={42} radius={999} />
        </div>
      </div>
    </div>
  );
}
