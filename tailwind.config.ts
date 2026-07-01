import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // MCD dark theme surfaces
        ink: {
          950: "#0b1220",
          900: "#0f1729",
          800: "#152036",
          700: "#1e2b45",
        },
        brand: {
          // teal/mint accent (aligns with the MCD brand direction)
          500: "#14b8a6",
          400: "#2dd4bf",
          600: "#0d9488",
        },
      },
    },
  },
  plugins: [],
};

export default config;
