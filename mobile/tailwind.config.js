/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#0f0f0f',
        surface: '#1a1a1a',
        'surface-2': '#252525',
        border: '#2a2a2a',
        primary: '#3b82f6',
        'primary-dark': '#2563eb',
        success: '#22c55e',
        danger: '#ef4444',
        muted: '#9ca3af',
      },
    },
  },
  darkMode: 'class',
};
