"use client";

/**
 * Animated band of flame tongues that tiles to its container width. Position
 * it (absolutely) on the top edge of a fire fill — timer chips, progress
 * bars. The flame artwork + flicker live in globals.css (.flame-strip).
 */
export default function FlameStrip({ paused = false, className = "" }: { paused?: boolean; className?: string }) {
  return (
    <div className={`flame-strip ${paused ? "paused" : ""} ${className}`} aria-hidden>
      <i className="flame-back" />
      <i className="flame-front" />
    </div>
  );
}
