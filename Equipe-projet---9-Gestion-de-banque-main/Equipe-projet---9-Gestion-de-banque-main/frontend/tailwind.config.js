/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        leon: {
          navy: "#071A2B",
          navy2: "#0B2A44",
          gold: "#D4AF37",
          gold2: "#F6D365",
          sky: "#38BDF8",
          ink: "#0B1220",
        },
      },
      boxShadow: {
        leon: "0 18px 50px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
};

