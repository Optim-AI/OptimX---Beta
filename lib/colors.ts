// lib/colors.ts
// Colors & tokens converted from your lovable CSS :root (explicit HSL/gradient strings)
// Import this into components and use inline via style={{ background: colors.background, color: colors.foreground }}

const colors = {
  // Core
  background: "hsl(0 0% 99%)",
  foreground: "hsl(0 0% 10%)",

  // Cards / popovers
  card: "hsl(0 0% 100%)",
  cardForeground: "hsl(0 0% 10%)",
  popover: "hsl(0 0% 100%)",
  popoverForeground: "hsl(0 0% 10%)",

  // Primary / Accent
  primary: "hsl(213 100% 50%)",
  primaryForeground: "hsl(0 0% 100%)",
  primaryHover: "hsl(213 100% 45%)",
  primaryGlow: "hsl(213 100% 62%)",

  // Secondary / muted
  secondary: "hsl(220 14% 96%)",
  secondaryForeground: "hsl(0 0% 10%)",
  muted: "hsl(220 13% 95%)",
  mutedForeground: "hsl(0 0% 35%)",

  // Accent / destructive
  accent: "hsl(213 90% 96%)",
  accentForeground: "hsl(213 100% 40%)",
  destructive: "hsl(0 84% 60%)",
  destructiveForeground: "hsl(0 0% 100%)",

  // Inputs / borders / ring
  border: "hsl(220 13% 91%)",
  input: "hsl(220 13% 91%)",
  ring: "hsl(213 100% 62%)",

  // Gradients (strings that can be applied to background)
  gradientPrimary:
    "linear-gradient(135deg, hsl(213 100% 62%) 0%, hsl(213 100% 75%) 100%)",
  gradientHero:
    "linear-gradient(135deg, hsl(213 100% 62%) 0%, hsl(240 100% 68%) 100%)",
  gradientCard:
    "linear-gradient(145deg, hsl(0 0% 100%) 0%, hsl(213 30% 98%) 100%)",
  gradientMesh:
    "radial-gradient(at 40% 20%, hsl(213 100% 75% / 0.3) 0px, transparent 50%), radial-gradient(at 80% 0%, hsl(240 100% 75% / 0.2) 0px, transparent 50%), radial-gradient(at 0% 50%, hsl(213 100% 85% / 0.2) 0px, transparent 50%)",

  // Shadows (strings usable for boxShadow)
  shadowSoft: "0 2px 8px hsl(213 100% 62% / 0.08)",
  shadowMedium: "0 4px 16px hsl(213 100% 62% / 0.12)",
  shadowStrong: "0 8px 32px hsl(213 100% 62% / 0.18)",
  shadowGlow: "0 0 24px hsl(213 100% 62% / 0.25)",

  // Glassmorphism
  glassBg: "hsl(0 0% 99% / 0.7)",
  glassBorder: "hsl(0 0% 10% / 0.1)",
  glassShadow: "0 8px 32px 0 hsl(0 0% 10% / 0.1)",

  // Radius
  radius: "1rem",

  // Sidebar tokens
  sidebarBackground: "hsl(0 0% 99%)", // (value was 0 0% 99%)
  sidebarForeground: "hsl(240 5.3% 26.1%)",
  sidebarPrimary: "hsl(240 5.9% 10%)",
  sidebarPrimaryForeground: "hsl(0 0% 99%)",
  sidebarAccent: "hsl(240 4.8% 95.9%)",
  sidebarAccentForeground: "hsl(240 5.9% 10%)",
  sidebarBorder: "hsl(220 13% 91%)",
  sidebarRing: "hsl(213 100% 62%)",
} as const;

export default colors;
