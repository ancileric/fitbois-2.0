/** @type {import('tailwindcss').Config} */

/**
 * Colours resolve through CSS variables so light and dark are the same class
 * names with different values — no `dark:` variant on every element, and no way
 * for the two themes to drift apart.
 *
 * Semantic on purpose: clean is a clean week, owed is money, skip is a token.
 */
const withOpacity = (variable) => ({ opacityValue }) =>
  opacityValue === undefined
    ? `rgb(var(${variable}))`
    : `rgb(var(${variable}) / ${opacityValue})`;

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        display: ["Barlow Condensed", "Impact", "Arial Narrow", "sans-serif"],
        sans: [
          "Source Sans 3",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        paper: {
          DEFAULT: withOpacity("--paper"),
          card: withOpacity("--paper-card"),
          sunk: withOpacity("--paper-sunk"),
        },
        ink: {
          DEFAULT: withOpacity("--ink"),
          muted: withOpacity("--ink-muted"),
          faint: withOpacity("--ink-faint"),
        },
        line: {
          DEFAULT: withOpacity("--line"),
          soft: withOpacity("--line-soft"),
        },
        clean: {
          50: withOpacity("--clean-50"),
          100: withOpacity("--clean-100"),
          500: withOpacity("--clean-500"),
          600: withOpacity("--clean-600"),
          700: withOpacity("--clean-700"),
        },
        owed: {
          50: withOpacity("--owed-50"),
          100: withOpacity("--owed-100"),
          500: withOpacity("--owed-500"),
          600: withOpacity("--owed-600"),
          700: withOpacity("--owed-700"),
        },
        skip: {
          50: withOpacity("--skip-50"),
          100: withOpacity("--skip-100"),
          500: withOpacity("--skip-500"),
          600: withOpacity("--skip-600"),
          700: withOpacity("--skip-700"),
        },
        primary: {
          50: withOpacity("--clean-50"),
          100: withOpacity("--clean-100"),
          500: withOpacity("--clean-500"),
          600: withOpacity("--clean-600"),
          700: withOpacity("--clean-700"),
        },
      },
      borderRadius: { xl: "0.75rem", "2xl": "1rem" },
      boxShadow: {
        card: "0 1px 2px rgb(var(--shadow) / 0.05), 0 8px 24px -16px rgb(var(--shadow) / 0.28)",
        lift: "0 2px 4px rgb(var(--shadow) / 0.06), 0 16px 32px -20px rgb(var(--shadow) / 0.38)",
      },
      transitionTimingFunction: { settle: "cubic-bezier(.32,.72,0,1)" },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
