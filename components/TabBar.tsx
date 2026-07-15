"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, ShoppingBasket, ListChecks, Compass, CircleUser } from "lucide-react";

const TABS = [
  { href: "/", label: "Cook", Icon: Flame },
  { href: "/pantry", label: "Pantry", Icon: ShoppingBasket },
  { href: "/shopping", label: "List", Icon: ListChecks },
  { href: "/explore", label: "Explore", Icon: Compass },
  { href: "/profile", label: "You", Icon: CircleUser },
];

export default function TabBar() {
  const pathname = usePathname();

  // hide the tab bar inside a live cook session — full-screen focus
  if (pathname.startsWith("/cook/")) return null;

  return (
    <nav className="tabbar">
      {TABS.map(({ href, label, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? "active" : ""}>
            <Icon strokeWidth={active ? 2 : 1.8} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
