---
name: Mama K Recipes
description: Premium AI-powered recipe discovery app. The visual identity blends warm culinary heritage with clean, modern minimalism inspired by Apple's design language.
version: alpha

colors:
  primary: "#0A0A0A"
  secondary: "#86868B"
  tertiary: "#CE4F00"
  tertiary-hover: "#E06612"
  background: "#F5F5F7"
  surface: "#FFFFFF"
  surface-dark: "#1D1D1F"
  cream: "#F3ECD8"
  border: "#D2D2D7"
  border-dark: "rgba(255,255,255,0.12)"
  success: "#15803D"
  success-bg: "#F0FDF4"
  warning: "#D97706"
  warning-bg: "#FFFBEB"
  danger: "#BE123C"
  danger-bg: "#FFF1F2"

typography:
  h1:
    fontFamily: Cormorant Garamond
    fontWeight: 600
    fontSize: clamp(44px, 5.5vw, 74px)
    lineHeight: 1.05
    letterSpacing: -0.02em
  h2:
    fontFamily: Cormorant Garamond
    fontWeight: 600
    fontSize: clamp(28px, 4vw, 44px)
    lineHeight: 1.1
    letterSpacing: -0.015em
  h3:
    fontFamily: Cormorant Garamond
    fontWeight: 600
    fontSize: clamp(20px, 2.5vw, 28px)
    lineHeight: 1.2
  section-label:
    fontFamily: DM Sans
    fontWeight: 700
    fontSize: 11px
    letterSpacing: 0.14em
    textTransform: uppercase
  body-lg:
    fontFamily: DM Sans
    fontWeight: 400
    fontSize: 16px
    lineHeight: 1.75
  body-md:
    fontFamily: DM Sans
    fontWeight: 400
    fontSize: 14px
    lineHeight: 1.7
  body-sm:
    fontFamily: DM Sans
    fontWeight: 400
    fontSize: 12px
    lineHeight: 1.5
  logo-primary:
    fontFamily: Poppins
    fontWeight: 900
    letterSpacing: 0.02em
    textTransform: uppercase
  logo-secondary:
    fontFamily: Poppins
    fontWeight: 400
    letterSpacing: 0.35em
    textTransform: uppercase
  card-title:
    fontFamily: Cormorant Garamond
    fontWeight: 600
    fontSize: 15px
    lineHeight: 1.3
    letterSpacing: -0.01em
  caption:
    fontFamily: DM Sans
    fontWeight: 400
    fontSize: 11px
    lineHeight: 1.4
  badge:
    fontFamily: DM Sans
    fontWeight: 700
    fontSize: 9px
    letterSpacing: 0.07em
    textTransform: uppercase

rounded:
  xs: 6px
  sm: 10px
  md: 14px
  lg: 18px
  xl: 20px
  2xl: 28px
  full: 9999px

spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 40px
  3xl: 56px
  gutter: 40px
  gutter-mobile: 16px

components:
  nav:
    backgroundColor: "rgba(249,248,245,0.92)"
    height: 56px
    padding: 0 16px

  button-primary:
    backgroundColor: "{colors.tertiary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.full}"
    padding: 13px 22px
    typography: "{typography.body-sm}"

  button-primary-hover:
    backgroundColor: "{colors.tertiary-hover}"

  button-secondary:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    padding: 8px 18px

  recipe-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    width: 220px
    shadow: "0 2px 8px rgba(0,0,0,0.06)"

  recipe-card-hover:
    shadow: "0 12px 36px rgba(0,0,0,0.10)"

  section-row:
    backgroundColor: "{colors.background}"
    padding: 52px 0

  section-row-dark:
    backgroundColor: "{colors.surface-dark}"

  badge-easy:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
    rounded: "{rounded.xs}"
    padding: 2px 8px

  badge-medium:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning}"
    rounded: "{rounded.xs}"
    padding: 2px 8px

  badge-advanced:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger}"
    rounded: "{rounded.xs}"
    padding: 2px 8px

  paywall-modal:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.2xl}"
    padding: 48px 40px
    shadow: "0 40px 80px rgba(0,0,0,0.25)"

  tab-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    shadow: "0 1px 3px rgba(0,0,0,0.08)"

  tab-inactive:
    backgroundColor: transparent
    textColor: "{colors.secondary}"
---

## Overview

Mama K Recipes is a premium, globally-minded AI recipe discovery platform. The visual identity is warm but minimal — it should feel like a high-end food magazine redesigned for the web.

The hierarchy is: **Cormorant Garamond** for editorial headers (warmth, prestige), **Poppins** for the brand wordmark only (bold, modern identity), **DM Sans** for all UI text (clean, Apple-adjacent legibility).

The palette is rooted in near-black, warm white and a single fire-orange accent (`#CE4F00` to `#E06612`). This accent is used sparingly — only for primary CTAs, the flame logo, the brand name subtext, and active states.

## Colors

- **Primary (#0A0A0A):** Near-black for headlines and core UI text. Not pure black — slightly warmer.
- **Secondary (#86868B):** Apple's exact secondary text gray. Used for captions, metadata, placeholder text.
- **Tertiary (#CE4F00 / #E06612):** The flame orange. The sole driver of interaction and brand identity. Used only for: the logo flame, the RECIPES wordmark subtext, primary buttons, active states, dot indicators, and step numbers.
- **Background (#F5F5F7):** Apple's exact page background. Cooler than cream — keeps the editorial orange feeling warm by contrast.
- **Surface (#FFFFFF):** Card and modal backgrounds. Pure white for maximum contrast against the background.
- **Surface Dark (#1D1D1F):** Apple's near-black. Used for hero sections, dark carousel rows, and the footer.
- **Cream (#F3ECD8):** Warm fill used inside recipe card thumbnails when no photo is present.

## Typography

Two type families carry the brand:

**Cormorant Garamond** is used for all editorial content: hero headlines, section titles, recipe titles, detail view headers. It is set at light-to-medium weights with tight tracking. It gives the brand warmth and culinary heritage.

**DM Sans** is used for all UI chrome: nav, buttons, badges, captions, meta text, form inputs, tab labels. It is set at 300-600 weight depending on hierarchy. It provides the clean, functional Apple-adjacent feel.

**Poppins** is used exclusively for the brand wordmark (MAMA K at weight 900, RECIPES at weight 400). It should not appear anywhere else in the UI.

Never use em dashes. Use commas or restructure sentences instead.

## Layout

The content gutter is 40px on desktop, 16px on mobile. All section headers, scroll rows, hero content, and footers must align to this same left edge. This creates the single vertical axis that makes the layout feel disciplined and premium.

Horizontal scroll rows use `scroll-snap-type: x mandatory` with `scroll-snap-align: start` on each card. They begin exactly at the gutter, not at the screen edge.

The nav is 56px tall on all breakpoints. Logo height is 36px on mobile, 44px on desktop. Nav elements never squeeze or wrap — they shrink in text, not in layout.

## Elevation and Depth

Cards use a two-layer shadow system:
- Rest: `0 2px 8px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.06)`
- Hover: `0 12px 36px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)`

Modals: `0 40px 80px rgba(0,0,0,0.25)` with `backdrop-filter: blur(16px)`.

Nav: `backdrop-filter: blur(24px)` with 92% opacity background. This is the frosted glass Apple pattern.

Hover transitions use `0.2s ease` — never bouncy cubic-bezier. Apple does not bounce.

## Shapes

Border radius is consistent:
- Badges and small chips: 6px
- Buttons and tabs: full (9999px for pills) or 10-14px for rectangular
- Cards: 18-20px
- Modals and hero images: 20-28px

## Components

### Navigation
Sticky, frosted glass, 56px height. Contains: Logo (left), Saved button + search counter + auth button (right). On mobile, the saved button shows only the heart icon and count. The search counter shows "2/3" format only — no word "searches".

### Recipe Card
220px wide (280px for wide variant). Real Pexels food photo with emoji fallback. Subtle gradient overlay on photo for text legibility. Region tag top-left, bookmark button top-right, both with frosted glass backgrounds. Title in Cormorant Garamond, tagline and meta in DM Sans.

### Section Row
Netflix-style horizontal scroll. Header aligned to gutter with title (Cormorant Garamond) and left/right arrow buttons. Fade gradients on scroll edges. Alternates between light (`#F5F5F7`) and dark (`#1D1D1F`) backgrounds between sections.

### Paywall Modal
Centered, blurred backdrop. Logo at top. Benefit list with orange checkmarks. Single primary CTA (Flutterwave). No aggressive language — warm and aspirational tone.

## Dos and Donts

- DO use Cormorant Garamond italic for the hero headline accent word
- DO keep the orange accent rare — one or two uses per screen maximum
- DO use `letter-spacing: -0.02em` on large serif headlines (tighter is more premium)
- DO fade scroll edges with gradients rather than hard cutoffs
- DO use Apple's exact grays (#F5F5F7, #86868B, #D2D2D7) for background/secondary/border
- DONT use em dashes anywhere in copy
- DONT use bouncy animations (no cubic-bezier spring curves)
- DONT add drop shadows to the logo — it is flat and transparent
- DONT use Poppins anywhere except the brand wordmark
- DONT use more than one accent color — the entire palette pivots on the single flame orange
