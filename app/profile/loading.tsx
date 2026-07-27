import { BookMarked, ChevronRight, Settings } from "lucide-react";
import Skeleton from "@/components/Skeleton";

export default function ProfileLoading() {
  return (
    <main className="page fade-in">
      <Skeleton width="42%" height="1.7rem" radius={8} style={{ marginBottom: 8 }} />
      <Skeleton width="58%" height="0.95rem" style={{ marginBottom: 20 }} />

      <div className="card" style={{ marginBottom: 12 }}>
        <Skeleton width={54} height="2rem" style={{ marginBottom: 6 }} />
        <Skeleton width="58%" height="0.9rem" />
      </div>

      {/* the rows below never change — only their counts do */}
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <BookMarked size={17} style={{ color: "var(--accent-icon)" }} /> Saved recipes
        </span>
        <ChevronRight size={16} style={{ color: "var(--text-faint)" }} />
      </div>

      <div
        className="card"
        style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
          <Settings size={17} style={{ color: "var(--accent-icon)" }} /> Settings
        </span>
        <ChevronRight size={16} style={{ color: "var(--text-faint)" }} />
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <Skeleton width="46%" height="1rem" style={{ marginBottom: 10 }} />
        <Skeleton width="86%" height="0.88rem" />
      </div>
    </main>
  );
}
