import { readFile, writeFile } from "fs/promises";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || process.cwd();
const BANNER_PATH = path.resolve(DATA_DIR, "banner-config.json");

let bannerConfig = {
  enabled: false,
  message: "",
  linkUrl: "",
  linkText: "",
};

// Only allow http(s) links — blocks javascript: and other unsafe schemes.
function sanitizeLinkUrl(url) {
  return typeof url === "string" && /^https?:\/\//i.test(url) ? url.slice(0, 500) : "";
}

export async function loadBannerConfig() {
  try {
    const raw = await readFile(BANNER_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    if (typeof parsed.enabled === "boolean") bannerConfig.enabled = parsed.enabled;
    if (typeof parsed.message === "string") bannerConfig.message = parsed.message;
    if (typeof parsed.linkUrl === "string") bannerConfig.linkUrl = sanitizeLinkUrl(parsed.linkUrl);
    if (typeof parsed.linkText === "string") bannerConfig.linkText = parsed.linkText.slice(0, 60);
  } catch {}
}

async function persistBannerConfig() {
  try {
    await writeFile(BANNER_PATH, JSON.stringify(bannerConfig, null, 2), "utf-8");
  } catch {}
}

export function getBannerConfig() {
  return { ...bannerConfig };
}

export function setBannerConfig(patch) {
  if (typeof patch.enabled === "boolean") bannerConfig.enabled = patch.enabled;
  if (typeof patch.message === "string") bannerConfig.message = patch.message.slice(0, 500);
  if (typeof patch.linkUrl === "string") bannerConfig.linkUrl = sanitizeLinkUrl(patch.linkUrl);
  if (typeof patch.linkText === "string") bannerConfig.linkText = patch.linkText.slice(0, 60);
  persistBannerConfig().catch(() => {});
  return getBannerConfig();
}
