import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f7f8",
          100: "#eeeef0",
          200: "#d9d9de",
          300: "#b6b6bf",
          400: "#8a8a96",
          500: "#5f5f6a",
          600: "#43434c",
          700: "#2e2e36",
          800: "#1f1f25",
          900: "#121217",
        },
        flow: {
          50: "#eef4ff",
          100: "#dde8ff",
          200: "#b9d0ff",
          300: "#8db1ff",
          400: "#5a8aff",
          500: "#3563f5",
          600: "#234bd1",
          700: "#1c3ba6",
          800: "#1a3382",
          900: "#172b65",
        },
        agent: {
          inbox: "#7c5cff",
          calendar: "#10b981",
          ar: "#f59e0b",
          report: "#06b6d4",
          health: "#ef4444",
          time: "#8b5cf6",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.04)",
        card: "0 1px 0 rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.06)",
      },
    },
  },
  plugins: [],
};

export default config;
