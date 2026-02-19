import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const DATA_DIR = process.env.DATA_DIR || process.cwd();
export const STYLES_PATH = path.resolve(DATA_DIR, 'overlay-styles.json');

export const DEFAULT_STYLE = {
  fontSize: 64,
  color: '#000000',
  bg: 'rgba(0,0,0,0)',
  transparent: true,
  font: 'Inter,system-ui,Arial,sans-serif',
  label: false,
  title: 'Stream Countdown',
  align: 'center',
  weight: 700,
  shadow: false,
  shadowColor: 'rgba(0,0,0,0.7)',
  shadowBlur: 8,
  stroke: 0,
  strokeColor: '#000000',
  warnEnabled: true,
  warnUnderSeconds: 300,
  warnColor: '#FFA500',
  dangerEnabled: true,
  dangerUnderSeconds: 60,
  dangerColor: '#FF4D4D',
  flashEnabled: true,
  flashUnderSeconds: 0,
  timeFormat: 'mm:ss',
  addEffectEnabled: true,
  addEffectMode: 'pulse',
  hypeLabelEnabled: true,
  hypeLabel: '🔥 Hype Train active'
};

const overlayStyles = new Map();

export function normKey(k) { return String(k || 'default'); }

export function getSavedStyle(k) {
  return overlayStyles.get(normKey(k)) || DEFAULT_STYLE;
}

export function setSavedStyle(k, s = {}) {
  const key = normKey(k);
  const clean = {};
  if ('fontSize' in s) clean.fontSize = Number(s.fontSize) || DEFAULT_STYLE.fontSize;
  if ('color' in s) clean.color = String(s.color || DEFAULT_STYLE.color);
  if ('bg' in s) clean.bg = String(s.bg || DEFAULT_STYLE.bg);
  if ('transparent' in s) clean.transparent = Boolean(s.transparent);
  if ('font' in s) clean.font = String(s.font || DEFAULT_STYLE.font);
  if ('label' in s) clean.label = Boolean(s.label);
  if ('title' in s) clean.title = String(s.title || DEFAULT_STYLE.title);
  if ('align' in s) clean.align = ['left','center','right'].includes(s.align) ? s.align : DEFAULT_STYLE.align;
  if ('weight' in s) clean.weight = Number(s.weight) || DEFAULT_STYLE.weight;
  if ('shadow' in s) clean.shadow = Boolean(s.shadow);
  if ('shadowColor' in s) clean.shadowColor = String(s.shadowColor || DEFAULT_STYLE.shadowColor);
  if ('shadowBlur' in s) clean.shadowBlur = Number(s.shadowBlur) || DEFAULT_STYLE.shadowBlur;
  if ('stroke' in s) clean.stroke = Number(s.stroke) || 0;
  if ('strokeColor' in s) clean.strokeColor = String(s.strokeColor || DEFAULT_STYLE.strokeColor);
  if ('warnEnabled' in s) clean.warnEnabled = Boolean(s.warnEnabled);
  if ('warnUnderSeconds' in s) clean.warnUnderSeconds = Math.max(0, Number(s.warnUnderSeconds) || 0);
  if ('warnColor' in s) clean.warnColor = String(s.warnColor || DEFAULT_STYLE.warnColor);
  if ('dangerEnabled' in s) clean.dangerEnabled = Boolean(s.dangerEnabled);
  if ('dangerUnderSeconds' in s) clean.dangerUnderSeconds = Math.max(0, Number(s.dangerUnderSeconds) || 0);
  if ('dangerColor' in s) clean.dangerColor = String(s.dangerColor || DEFAULT_STYLE.dangerColor);
  if ('flashEnabled' in s) clean.flashEnabled = Boolean(s.flashEnabled);
  if ('flashUnderSeconds' in s) clean.flashUnderSeconds = Math.max(0, Number(s.flashUnderSeconds) || 0);
  if ('timeFormat' in s) {
    const tf = String(s.timeFormat || DEFAULT_STYLE.timeFormat);
    clean.timeFormat = ['hh:mm:ss', 'dd:hh:mm:ss', 'auto'].includes(tf) ? tf : 'mm:ss';
  }
  if ('addEffectEnabled' in s) clean.addEffectEnabled = Boolean(s.addEffectEnabled);
  if ('addEffectMode' in s) {
    const m = String(s.addEffectMode || DEFAULT_STYLE.addEffectMode);
    clean.addEffectMode = ['pulse', 'shake', 'bounce', 'none'].includes(m) ? m : DEFAULT_STYLE.addEffectMode;
  }
  if ('hypeLabelEnabled' in s) clean.hypeLabelEnabled = Boolean(s.hypeLabelEnabled);
  if ('hypeLabel' in s) clean.hypeLabel = String(s.hypeLabel || DEFAULT_STYLE.hypeLabel);
  overlayStyles.set(key, { ...DEFAULT_STYLE, ...clean });
  persistStyles().catch(() => {});
  return overlayStyles.get(key);
}

export async function loadStyles() {
  try {
    const raw = await readFile(STYLES_PATH, 'utf-8');
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) overlayStyles.set(normKey(k), { ...DEFAULT_STYLE, ...v });
  } catch {}
}

export async function persistStyles() {
  try {
    const obj = {};
    for (const [k, v] of overlayStyles.entries()) obj[k] = v;
    await writeFile(STYLES_PATH, JSON.stringify(obj, null, 2), 'utf-8');
  } catch {}
}
