import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: "#F9F5F0",
        sand: "#EDE6DC",
        terracotta: "#B36B4D",
        "terracotta-dark": "#8F4F38",
        charcoal: "#2C2622",
        "sidebar-dark": "#332C26",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "1rem",
        pill: "9999px",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(44, 38, 34, 0.08)",
        modal: "0 24px 80px rgba(44, 38, 34, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
