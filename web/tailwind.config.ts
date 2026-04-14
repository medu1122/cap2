import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        border: "#E5E7EB",
        surface: "#F9FAFB",
        accent: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
