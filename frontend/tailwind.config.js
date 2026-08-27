/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#12181a",
        paper: "#f7f5f0",
        surface: "#ffffff",
        line: "#e3e0d8",
        muted: "#6b7270",
        brand: {
          50: "#eef7ef",
          100: "#d7ecda",
          200: "#aed7b4",
          300: "#7ebd88",
          400: "#4d9d5c",
          500: "#2f7d3f",
          600: "#256633",
          700: "#1e5229",
          800: "#194422",
          900: "#0f2c15",
        },
        amber: {
          50: "#fdf6ea",
          100: "#faebc7",
          200: "#f3d38a",
          300: "#eab84f",
          400: "#dd9f2b",
          500: "#c1841c",
          600: "#966516",
          700: "#6d4a10",
        },
        crit: {
          50: "#fdecec",
          100: "#f8cfcf",
          200: "#ee9c9c",
          300: "#e06767",
          400: "#cc3d3d",
          500: "#ab2626",
          600: "#821c1c",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(18,24,26,0.06), 0 1px 1px rgba(18,24,26,0.04)",
      },
    },
  },
  plugins: [],
};
