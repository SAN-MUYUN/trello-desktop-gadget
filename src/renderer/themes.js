'use strict';

// Contrast-safe theme presets. Each maps directly to the CSS custom
// properties defined in styles.css. Every preset pairs a background with a
// clearly-distinct foreground (dark bg -> light text; light bg -> dark text)
// so text is never hard to read.

const THEMES = {
  'kiro-dark-blue': {
    label: 'Kiro Dark Blue',
    vars: {
      '--bg-1': '#0f1020',
      '--bg-2': '#14162b',
      '--bg-3': '#1b1e38',
      '--fg': '#ececf4',
      '--fg-dim': '#a8abc7',
      '--accent': '#a78bfa',
      '--accent-soft': '#7c5cff',
      '--danger': '#ff6b81',
      '--ok': '#4fdda3',
      '--panel': 'rgba(255, 255, 255, 0.05)',
      '--panel-hover': 'rgba(167, 139, 250, 0.18)',
      '--border': 'rgba(167, 139, 250, 0.22)',
      '--border-soft': 'rgba(255, 255, 255, 0.10)',
      '--gadget-bg': 'linear-gradient(160deg, rgba(20,22,43,0.97) 0%, rgba(15,16,32,0.97) 100%)',
    },
  },
  midnight: {
    label: 'Midnight',
    vars: {
      '--bg-1': '#07080c',
      '--bg-2': '#0e1016',
      '--bg-3': '#161922',
      '--fg': '#eef2f6',
      '--fg-dim': '#9aa3b2',
      '--accent': '#38bdf8',
      '--accent-soft': '#0ea5e9',
      '--danger': '#fb7185',
      '--ok': '#34d399',
      '--panel': 'rgba(255, 255, 255, 0.05)',
      '--panel-hover': 'rgba(56, 189, 248, 0.18)',
      '--border': 'rgba(56, 189, 248, 0.22)',
      '--border-soft': 'rgba(255, 255, 255, 0.10)',
      '--gadget-bg': 'linear-gradient(160deg, rgba(14,16,22,0.97) 0%, rgba(7,8,12,0.97) 100%)',
    },
  },
  slate: {
    label: 'Slate',
    vars: {
      '--bg-1': '#1a1f28',
      '--bg-2': '#222836',
      '--bg-3': '#2b3242',
      '--fg': '#eef1f5',
      '--fg-dim': '#aeb7c4',
      '--accent': '#2dd4bf',
      '--accent-soft': '#14b8a6',
      '--danger': '#f87171',
      '--ok': '#4ade80',
      '--panel': 'rgba(255, 255, 255, 0.05)',
      '--panel-hover': 'rgba(45, 212, 191, 0.18)',
      '--border': 'rgba(45, 212, 191, 0.22)',
      '--border-soft': 'rgba(255, 255, 255, 0.10)',
      '--gadget-bg': 'linear-gradient(160deg, rgba(34,40,54,0.97) 0%, rgba(26,31,40,0.97) 100%)',
    },
  },
  forest: {
    label: 'Forest',
    vars: {
      '--bg-1': '#0c1710',
      '--bg-2': '#122016',
      '--bg-3': '#1a2c1f',
      '--fg': '#eaf3ec',
      '--fg-dim': '#a3c0aa',
      '--accent': '#a3e635',
      '--accent-soft': '#84cc16',
      '--danger': '#f87171',
      '--ok': '#4ade80',
      '--panel': 'rgba(255, 255, 255, 0.05)',
      '--panel-hover': 'rgba(163, 230, 53, 0.16)',
      '--border': 'rgba(163, 230, 53, 0.22)',
      '--border-soft': 'rgba(255, 255, 255, 0.10)',
      '--gadget-bg': 'linear-gradient(160deg, rgba(18,32,22,0.97) 0%, rgba(12,23,16,0.97) 100%)',
    },
  },
  light: {
    label: 'Light',
    vars: {
      '--bg-1': '#f4f5f8',
      '--bg-2': '#ffffff',
      '--bg-3': '#eef0f5',
      '--fg': '#1c2030', // dark text on light bg
      '--fg-dim': '#5b6376',
      '--accent': '#6d3ff5',
      '--accent-soft': '#7c5cff',
      '--danger': '#e11d48',
      '--ok': '#0f9d63',
      '--panel': 'rgba(20, 22, 43, 0.05)',
      '--panel-hover': 'rgba(109, 63, 245, 0.14)',
      '--border': 'rgba(109, 63, 245, 0.30)',
      '--border-soft': 'rgba(20, 22, 43, 0.12)',
      '--gadget-bg': 'linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(244,245,248,0.98) 100%)',
    },
  },
  'apple-light': {
    label: 'Apple Light',
    vars: {
      // macOS / iOS light: near-white frosted surfaces, SF blue accent,
      // near-black text for strong contrast.
      '--bg-1': '#f5f5f7',
      '--bg-2': '#ffffff',
      '--bg-3': '#f2f2f4',
      '--fg': '#1d1d1f', // Apple's signature near-black text
      '--fg-dim': '#6e6e73', // Apple secondary label grey
      '--accent': '#0071e3', // Apple system blue
      '--accent-soft': '#0a84ff',
      '--danger': '#ff3b30', // Apple system red
      '--ok': '#34c759', // Apple system green
      '--panel': 'rgba(0, 0, 0, 0.04)',
      '--panel-hover': 'rgba(0, 113, 227, 0.10)',
      '--border': 'rgba(0, 0, 0, 0.12)',
      '--border-soft': 'rgba(0, 0, 0, 0.08)',
      '--gadget-bg': 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(245,245,247,0.92) 100%)',
    },
  },
  'apple-dark': {
    label: 'Apple Dark',
    vars: {
      // macOS dark: deep neutral greys, brighter SF blue, light text.
      '--bg-1': '#1c1c1e',
      '--bg-2': '#2c2c2e',
      '--bg-3': '#3a3a3c',
      '--fg': '#f5f5f7',
      '--fg-dim': '#98989d',
      '--accent': '#0a84ff', // Apple system blue (dark)
      '--accent-soft': '#409cff',
      '--danger': '#ff453a',
      '--ok': '#30d158',
      '--panel': 'rgba(255, 255, 255, 0.06)',
      '--panel-hover': 'rgba(10, 132, 255, 0.20)',
      '--border': 'rgba(255, 255, 255, 0.14)',
      '--border-soft': 'rgba(255, 255, 255, 0.10)',
      '--gadget-bg': 'linear-gradient(180deg, rgba(44,44,46,0.94) 0%, rgba(28,28,30,0.94) 100%)',
    },
  },
};

const DEFAULT_THEME = 'kiro-dark-blue';

function applyTheme(id) {
  const resolved = THEMES[id] ? id : DEFAULT_THEME;
  const theme = THEMES[resolved];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(theme.vars)) {
    root.style.setProperty(k, v);
  }
  // Expose the active theme id as a class so CSS can target a single theme
  // (e.g. light themes that need extra contrast tweaks) without affecting
  // the others.
  root.setAttribute('data-theme', resolved);
}

function themeList() {
  return Object.entries(THEMES).map(([id, t]) => ({ id, label: t.label }));
}

window.gadgetThemes = { THEMES, DEFAULT_THEME, applyTheme, themeList };
