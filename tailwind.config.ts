import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
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
