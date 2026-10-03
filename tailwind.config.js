/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF500B',
          dark: '#E64D0A',
        },
        perrific: {
          paper: '#FFFEF7',
          graphite: '#1A1A1E',
          violet: '#FF500B',
          amber: '#FF8A3D',
          mint: '#FFB088',
          red: '#CC3E0A',
          wood: '#FF500B',
          'wood-dark': '#E64D0A',
          grid: 'rgba(255,80,11,0.06)',
          line: 'rgba(255,80,11,0.12)',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', '"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        body: ['Manrope', '"Work Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        space: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        'space-grotesk': ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        manrope: ['Manrope', 'system-ui', 'sans-serif'],
      },
      height: {
        screen: 'var(--app-vh, 100vh)',
      },
      minHeight: {
        screen: 'var(--app-vh, 100vh)',
      },
      maxHeight: {
        screen: 'var(--app-vh, 100vh)',
      },
    },
  },
  plugins: [],
};
