"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Flame, ShoppingBasket, ListChecks, Compass, CircleUser } from "lucide-react";

const TABS = [
  { href: "/", label: "Cook", Icon: Flame },
  { href: "/pantry", label: "Pantry", Icon: ShoppingBasket },
  { href: "/shopping", label: "List", Icon: ListChecks },
  { href: "/explore", label: "Explore", Icon: Compass },
  { href: "/profile", label: "You", Icon: CircleUser },
];

// the bar lives in the root layout so it never unmounts between tabs — these
// are the screens it belongs to. Everything else (a live cook session,
// onboarding, share links) is full-screen.
const TAB_ROUTES = ["/", "/pantry", "/shopping", "/explore", "/profile", "/saved", "/settings"];

/**
 * Lives inside the <Link> so it can read useLinkStatus — the tab stays lit
 * while the next route is still coming down the wire.
 */
function TabInner({
  label,
  Icon,
  active,
  held,
  tapped,
}: {
  label: string;
  Icon: typeof Flame;
  active: boolean;
  held: boolean;
  tapped: boolean;
}) {
  const { pending } = useLinkStatus();
  const lit = active || tapped || pending;

  return (
    <span className={`tab-inner${lit ? " lit" : ""}${held ? " held" : ""}`}>
      <Icon strokeWidth={lit ? 2 : 1.8} />
      {label}
      {/* fixed-size, so lighting it up never shifts the bar */}
      <span aria-hidden className={`tab-hint${pending ? " is-pending" : ""}`} />
    </span>
  );
}

export default function TabBar() {
  const pathname = usePathname();
  // `held` = finger is down (press-in). `tapped` = tap landed, we're waiting
  // for the route — both light the tab before the router has done anything.
  // Tagging the press with the route it started on means the real active state
  // takes back over the moment the new route lands, with no effect needed.
  const [press, setPress] = useState<{ path: string; held: string | null; tapped: string | null }>({
    path: pathname,
    held: null,
    tapped: null,
  });
  const held = press.path === pathname ? press.held : null;
  const tapped = press.path === pathname ? press.tapped : null;

  // safety valve: a tap that never navigates (offline, a failed route)
  // shouldn't leave a tab lit forever
  useEffect(() => {
    if (!tapped) return;
    const timeout = setTimeout(() => setPress((prev) => ({ ...prev, tapped: null })), 2500);
    return () => clearTimeout(timeout);
  }, [tapped]);

  if (!TAB_ROUTES.includes(pathname)) return null;

  return (
    <nav className="tabbar">
      {TABS.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onPointerDown={() => {
              setPress({ path: pathname, held: href, tapped: href });
              // a tick of haptics where the platform has it (Android)
              navigator.vibrate?.(6);
            }}
            onPointerUp={() => setPress((prev) => ({ ...prev, held: null }))}
            onPointerCancel={() => setPress((prev) => ({ ...prev, held: null, tapped: null }))}
          >
            <TabInner
              label={label}
              Icon={Icon}
              active={active}
              held={held === href}
              tapped={tapped === href}
            />
          </Link>
        );
      })}
    </nav>
  );
}
