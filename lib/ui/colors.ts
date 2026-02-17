// lib/colors.ts
// Dark theme with #121212 base
// Import into components: style={{ background: colors.background, color: colors.foreground }}

const colors = {
  // Core - #121212 base
  background: "#121212",
  foreground: "hsl(0 0% 95%)",

  // Cards / popovers
  card: "hsl(0 0% 15%)",
  cardForeground: "hsl(0 0% 95%)",
  popover: "hsl(0 0% 18%)",
  popoverForeground: "hsl(0 0% 95%)",

  // Primary / Accent
  primary: "hsl(213 100% 55%)",
  primaryForeground: "hsl(0 0% 100%)",
  primaryHover: "hsl(213 100% 60%)",
  primaryGlow: "hsl(213 100% 65%)",

  // Secondary / muted
  secondary: "hsl(0 0% 18%)",
  secondaryForeground: "hsl(0 0% 90%)",
  muted: "hsl(0 0% 20%)",
  mutedForeground: "hsl(0 0% 60%)",

  // Accent / destructive
  accent: "hsl(213 80% 18%)",
  accentForeground: "hsl(213 100% 70%)",
  destructive: "hsl(0 84% 55%)",

  // Status (for integrations, badges)
  green100: "hsl(142 76% 36% / 0.15)",
  green600: "#22c55e",
  green900: "hsl(142 76% 30%)",
  destructiveForeground: "hsl(0 0% 100%)",

  // Inputs / borders / ring
  border: "hsl(0 0% 22%)",
  input: "hsl(0 0% 22%)",
  ring: "hsl(213 100% 55%)",

  // Gradients (strings for background)
  gradientPrimary:
    "linear-gradient(135deg, hsl(213 100% 55%) 0%, hsl(213 100% 65%) 100%)",
  gradientHero:
    "linear-gradient(135deg, hsl(213 100% 55%) 0%, hsl(240 100% 62%) 100%)",
  gradientCard:
    "linear-gradient(145deg, hsl(0 0% 16%) 0%, hsl(0 0% 12%) 100%)",
  gradientMesh:
    "radial-gradient(at 40% 20%, hsl(213 100% 50% / 0.12) 0px, transparent 50%), radial-gradient(at 80% 0%, hsl(240 100% 50% / 0.08) 0px, transparent 50%), radial-gradient(at 0% 50%, hsl(213 100% 60% / 0.06) 0px, transparent 50%)",

  // Shadows (dark theme - softer, darker)
  shadowSoft: "0 2px 8px hsl(0 0% 0% / 0.3)",
  shadowMedium: "0 4px 16px hsl(0 0% 0% / 0.4)",
  shadowStrong: "0 8px 32px hsl(0 0% 0% / 0.5)",
  shadowGlow: "0 0 24px hsl(213 100% 55% / 0.2)",

  // Glassmorphism (dark)
  glassBg: "hsl(0 0% 12% / 0.85)",
  glassBorder: "hsl(0 0% 100% / 0.08)",
  glassShadow: "0 8px 32px 0 hsl(0 0% 0% / 0.4)",

  // Radius
  radius: "1rem",

  // Sidebar tokens
  sidebarBackground: "#121212",
  sidebarForeground: "hsl(0 0% 75%)",
  sidebarPrimary: "hsl(0 0% 95%)",
  sidebarPrimaryForeground: "#121212",
  sidebarAccent: "hsl(0 0% 22%)",
  sidebarAccentForeground: "hsl(0 0% 95%)",
  sidebarBorder: "hsl(0 0% 22%)",
  sidebarRing: "hsl(213 100% 55%)",
} as const;

export default colors;
