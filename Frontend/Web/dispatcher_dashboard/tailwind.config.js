export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#FF4F52',
          hover: '#E63946',
          light: '#FF6B6E',
          dark: '#CC3D42',
        },
        secondary: {
          DEFAULT: '#134178',
          hover: '#0f3256',
          light: '#1a5290',
        },
        background: 'var(--color-background)',
        card: 'var(--color-card)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        border: 'var(--color-border)',
        destructive: '#DC2626',
        severity: {
          critical: '#FF4F52',
          warning: '#F59E0B',
          resolved: '#6EE7B7',
        },
      },
      boxShadow: {
        card: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
      transitionDuration: {
        '400': '400ms',
      },
    },
  },
  plugins: [],
}
