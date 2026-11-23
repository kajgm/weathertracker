import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Tokens live in src/style.css :root.
      colors: Object.fromEntries(
        ['page', 'panel', 'line', 'raised', 'pressed', 'faint', 'muted', 'soft', 'ink', 'strong', 'rain', 'warn', 'warn-wash'].map(
          (name) => [name, `var(--color-${name})`]
        )
      ),
      spacing: {
        'pi-w': '480px',
        'pi-h': '320px'
      },
      animation: {
        'bounce-slow': 'slow-bounce 3s ease-in-out infinite'
      },
      keyframes: {
        'slow-bounce': {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '50%': { transform: 'translate3d(0, 5px, 0)' }
        }
      }
    }
  },
  plugins: []
} satisfies Config;
