// frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx}', './public/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // --- Light Theme Colors ---
        'light-background': '#f3f6f9',
        'light-foreground': '#1a202c',
        'light-card': '#ffffff',
        'light-card-foreground': '#1a202c',
        'light-popover': '#ffffff',
        'light-popover-foreground': '#1a202c',
        'light-primary': {
          DEFAULT: '#0ea5e9', // sky-500
          foreground: '#ffffff',
          light: '#38bdf8',
          dark: '#0284c7',
        },
        'light-secondary': {
          DEFAULT: '#e2e8f0', // slate-200
          foreground: '#334155',
        },
        'light-muted': {
          DEFAULT: '#f1f5f9', // slate-100
          foreground: '#64748b',
        },
        'light-accent': {
          DEFAULT: '#ef4444', // red-500
          foreground: '#ffffff',
        },
        'light-destructive': { DEFAULT: '#e11d48', foreground: '#ffffff' }, // rose-600
        'light-border': '#cbd5e1', // slate-300
        'light-input-bg': '#ffffff',
        'light-input-border': '#cbd5e1',
        'light-ring': '#0ea5e9', // sky-500

        // --- Dark Theme Colors ---
        'dark-background': '#0a0f17',
        'dark-foreground': '#e1e7ef',
        'dark-card': '#161e29',
        'dark-card-foreground': '#e1e7ef',
        'dark-popover': '#161e29',
        'dark-popover-foreground': '#e1e7ef',
        'dark-primary': {
          DEFAULT: '#3b82f6', // blue-500
          foreground: '#ffffff',
          light: '#60a5fa',
          dark: '#2563eb',
        },
        'dark-secondary': {
          DEFAULT: '#334155', // slate-700
          foreground: '#cbd5e1',
        },
        'dark-muted': {
          DEFAULT: '#1e293b', // slate-800
          foreground: '#94a3b8',
        },
        'dark-accent': {
          DEFAULT: '#f472b6', // pink-400
          foreground: '#ffffff',
        },
        'dark-destructive': { DEFAULT: '#f43f5e', foreground: '#ffffff' }, // rose-500
        'dark-border': '#2c3646',
        'dark-input-bg': '#0f172a',
        'dark-input-border': '#334155',
        'dark-ring': '#3b82f6', // blue-500
      },
      backgroundImage: {
        'page-gradient-light': 'linear-gradient(180deg, #e6eff9 0%, #f3f6f9 50%, #e6eff9 100%)',
        'page-gradient-dark': 'linear-gradient(180deg, #0a0f17 0%, #111827 50%, #0a0f17 100%)',
        // CORRECTED: Replaced theme() with static hex values
        'text-gradient-light': 'linear-gradient(135deg, #0ea5e9 0%, #ef4444 100%)', // light-primary.DEFAULT to light-accent.DEFAULT
        'text-gradient-dark': 'linear-gradient(135deg, #60a5fa 0%, #f472b6 100%)',   // dark-primary.light to dark-accent.DEFAULT
      },
      animation: { /* Your existing animations */ },
      keyframes: { /* Your existing keyframes */ },
      boxShadow: {
        'interactive-light': '0 0 0 3px rgba(14, 165, 233, 0.3)',
        'interactive-dark': '0 0 0 3px rgba(59, 130, 246, 0.3)',
        'card-light': '0 5px 15px rgba(0,0,0,0.04), 0 2px 5px rgba(0,0,0,0.02)',
        'card-dark': '0 5px 15px rgba(0,0,0,0.15), 0 2px 5px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.03)',
        'soft-xl': '0 10px 20px -5px rgba(26, 32, 44, 0.1), 0 4px 6px -4px rgba(26, 32, 44, 0.06)',
        'dark-soft-xl': '0 10px 15px -3px rgba(0,0,0,0.2), 0 4px 6px -4px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.05)',
      },
      typography: (theme) => ({ // theme() is correctly available here
        DEFAULT: { // For light mode: .prose
          css: {
            '--tw-prose-body': theme('colors.light-foreground'),
            '--tw-prose-headings': theme('colors.slate.800'),
            '--tw-prose-links': theme('colors.light-primary.DEFAULT'),
            '--tw-prose-bold': theme('colors.slate.800'),
            '--tw-prose-counters': theme('colors.light-primary.DEFAULT'),
            '--tw-prose-bullets': theme('colors.light-primary.DEFAULT'),
            '--tw-prose-hr': theme('colors.light-border'),
            '--tw-prose-quotes': theme('colors.slate.700'),
            '--tw-prose-quote-borders': theme('colors.light-primary.DEFAULT'),
            '--tw-prose-captions': theme('colors.slate.500'),
            '--tw-prose-code': theme('colors.light-accent.DEFAULT'),
            '--tw-prose-pre-code': theme('colors.slate.100'),
            '--tw-prose-pre-bg': theme('colors.slate.800'),
            '--tw-prose-th-borders': theme('colors.light-border'),
            '--tw-prose-td-borders': theme('colors.light-border'),
            'code::before': { content: '""' }, 'code::after': { content: '""' },
            table: { fontSize: theme('fontSize.sm'), marginTop: theme('spacing.6'), marginBottom: theme('spacing.6'), width: '100%' },
            thead: { borderBottomWidth: '1px', borderBottomColor: theme('colors.light-border')},
            'thead th': { paddingTop: theme('spacing.2'), paddingBottom: theme('spacing.2'), paddingLeft: theme('spacing.3'), paddingRight: theme('spacing.3'), fontWeight: theme('fontWeight.semibold'), color: theme('colors.light-foreground'), textAlign: 'left'},
            'tbody tr': { borderBottomWidth: '1px', borderBottomColor: theme('colors.light-border')},
            'tbody tr:last-child': { borderBottomWidth: '0px' },
            'tbody td': { paddingTop: theme('spacing.2'), paddingBottom: theme('spacing.2'), paddingLeft: theme('spacing.3'), paddingRight: theme('spacing.3'), verticalAlign: 'baseline'},
            ul: { paddingLeft: theme('spacing.5')}, ol: { paddingLeft: theme('spacing.5')}, li: { marginTop: theme('spacing.1'), marginBottom: theme('spacing.1')},
            'li::marker': { color: theme('colors.light-primary.DEFAULT') },
          },
        },
        invert: { // For dark mode: .prose-invert
          css: {
            '--tw-prose-body': theme('colors.dark-foreground'),
            '--tw-prose-headings': theme('colors.neutral[100]'),
            '--tw-prose-links': theme('colors.dark-primary.light'),
            '--tw-prose-bold': theme('colors.neutral[100]'),
            '--tw-prose-counters': theme('colors.dark-primary.DEFAULT'),
            '--tw-prose-bullets': theme('colors.dark-primary.DEFAULT'),
            '--tw-prose-hr': theme('colors.dark-border'),
            '--tw-prose-quotes': theme('colors.neutral[300]'),
            '--tw-prose-quote-borders': theme('colors.dark-primary.dark'),
            '--tw-prose-captions': theme('colors.neutral[400]'),
            '--tw-prose-code': theme('colors.dark-accent.DEFAULT'),
            '--tw-prose-pre-code': theme('colors.neutral[200]'),
            '--tw-prose-pre-bg': theme('colors.neutral[800]'),
            '--tw-prose-th-borders': theme('colors.neutral[600]'),
            '--tw-prose-td-borders': theme('colors.neutral[700]'),
            table: { fontSize: theme('fontSize.sm'), marginTop: theme('spacing.6'), marginBottom: theme('spacing.6'), width: '100%' },
            thead: { borderBottomWidth: '1px', borderBottomColor: theme('colors.neutral[600]')},
            'thead th': { paddingTop: theme('spacing.2'), paddingBottom: theme('spacing.2'), paddingLeft: theme('spacing.3'), paddingRight: theme('spacing.3'), fontWeight: theme('fontWeight.semibold'), color: theme('colors.neutral[100]'), textAlign: 'left'},
            'tbody tr': { borderBottomWidth: '1px', borderBottomColor: theme('colors.neutral[700]')},
            'tbody tr:last-child': { borderBottomWidth: '0px' },
            'tbody td': { paddingTop: theme('spacing.2'), paddingBottom: theme('spacing.2'), paddingLeft: theme('spacing.3'), paddingRight: theme('spacing.3'), verticalAlign: 'baseline'},
            ul: { paddingLeft: theme('spacing.5')}, ol: { paddingLeft: theme('spacing.5')}, li: { marginTop: theme('spacing.1'), marginBottom: theme('spacing.1')},
            'li::marker': { color: theme('colors.dark-primary.DEFAULT') },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
