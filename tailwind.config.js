/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0F0D",
        panel: "#101915",
        line: "rgba(255,255,255,0.08)",
        accent: "#22C55E",
        mint: "#9AE6B4",
      },
      fontFamily: {
        heading: ["Sora", "sans-serif"],
        body: ["DM Sans", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(34, 197, 94, 0.12), 0 20px 60px rgba(4, 15, 8, 0.55)",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        pulseLine: {
          "0%": { transform: "scaleX(0.4)", opacity: "0.3" },
          "50%": { transform: "scaleX(1)", opacity: "1" },
          "100%": { transform: "scaleX(0.4)", opacity: "0.3" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        pulseLine: "pulseLine 1.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

