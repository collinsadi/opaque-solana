/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          900: "#0f0f14",
          800: "#18181f",
          700: "#26262f",
          600: "#383844",
          500: "#6b6b7e",
          400: "#9999b0",
        },
        mist: "#a8a8c0",
        "sol-purple": "#9945ff",
        "sol-green": "#14f195",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
