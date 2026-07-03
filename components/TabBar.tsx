"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Cook",
    icon: (
      // flame
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c1 4-4 6-4 11a4 4 0 0 0 8 0c0-2-1-3-1-3s3 1 3 5a6 6 0 0 1-12 0C6 8 11 6 12 2z" />
      </svg>
    ),
  },
  {
    href: "/pantry",
    label: "Pantry",
    icon: (
      // basket
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10h18l-2 10H5L3 10z" />
        <path d="M8 10l3-7M16 10l-3-7" />
      </svg>
    ),
  },
  {
    href: "/explore",
    label: "Explore",
    icon: (
      // compass
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M15 9l-2 5-4 1 2-5 4-1z" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "You",
    icon: (
      // person
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
      </svg>
    ),
  },
];

export default function TabBar() {
  const pathname = usePathname();

  // hide the tab bar inside a live cook session — full-screen focus
  if (pathname.startsWith("/cook/")) return null;

  return (
    <nav className="tabbar">
      {TABS.map((tab) => {
        const active =
          tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className={active ? "active" : ""}>
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
