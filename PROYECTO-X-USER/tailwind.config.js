/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['"Outfit"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        'mono': ['"Outfit"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        'orbitron': ['"Outfit"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'], // Alias for Headings
        'rajdhani': ['"Outfit"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'], // Alias for Headings
        'tech-mono': ['"Outfit"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'], // Alias for Data
        'mono-tech': ['"Outfit"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'], // Alias for Data
      },
      colors: {
        proyecto: {
          // Legacy support
          blue: '#0a192f',
          gold: '#ffd700',
          green: '#00ff9d', // More neon green
          dark: '#020617',
          accent: '#00f3ff', // Cyan Neon
          brand: '#2563eb',

          // New Palette
          space: '#030712', // Darker background
          neon: {
            cyan: '#00f3ff',
            purple: '#bc13fe',
            pink: '#ff0055',
            gold: '#ffb700'
          }
        }
      },
      boxShadow: {
        'neon-cyan': '0 0 5px theme("colors.proyecto.neon.cyan"), 0 0 20px theme("colors.proyecto.neon.cyan")',
        'neon-purple': '0 0 5px theme("colors.proyecto.neon.purple"), 0 0 20px theme("colors.proyecto.neon.purple")',
        'holo': '0 0 30px rgba(0, 243, 255, 0.1), inset 0 0 20px rgba(0, 243, 255, 0.05)',
      },
      animation: {
        'slide-in': 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 0.4s ease-out forwards',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scanLine 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(50px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.98)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        }
      }
    }
  },
  plugins: [],
}
