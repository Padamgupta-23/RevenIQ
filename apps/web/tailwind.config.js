/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        olive: {
          50: '#F4F6F0',
          100: '#E8EDE0',
          200: '#D3DCC5',
          300: '#B5C4A0',
          400: '#94A879',
          500: '#758D54',
          600: '#5A6F3F',
          700: '#475731',
          800: '#384527',
          900: '#2F3A21',
          950: '#181E11',
        },
        cream: {
          50: '#FDFCF9',
          100: '#FAF8F2',
          200: '#F4F0E4',
          300: '#EBE5D3',
          400: '#DFD7BE',
          500: '#CEBE9A',
          600: '#B8A479',
          700: '#9A855D',
          800: '#7D6C4B',
          900: '#67583D',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(45, 55, 30, 0.05), 0 4px 6px -2px rgba(45, 55, 30, 0.025)',
        'premium': '0 20px 25px -5px rgba(45, 55, 30, 0.06), 0 8px 10px -6px rgba(45, 55, 30, 0.04)',
      },
    },
  },
  plugins: [],
};
