import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SwRegister from "./sw-register";
import TabBar from "@/components/TabBar";
import { ThemeProvider } from "@/components/ThemeProvider";

const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("ember-theme");
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    }
  } catch (e) {}
})();
`;

// iOS Safari only applies :active styles once the document has a touch
// listener — this is what makes buttons and cards react on finger-down
// instead of on release, and it runs before hydration so the first tap counts.
const TAP_INIT_SCRIPT = `
document.addEventListener("touchstart", function () {}, { passive: true });
`;

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ember",
  description: "Your AI cooking companion — it knows your kitchen, suggests what you can make, and coaches you through every step.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Ember",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0c0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <Script id="tap-init" strategy="beforeInteractive">
          {TAP_INIT_SCRIPT}
        </Script>
      </head>
      <body>
        <ThemeProvider>
          <div className="shell">{children}</div>
          {/* outside the shell: the bar survives every navigation, so tapping a
              tab never blanks the chrome */}
          <TabBar />
        </ThemeProvider>
        <SwRegister />
      </body>
    </html>
  );
}
