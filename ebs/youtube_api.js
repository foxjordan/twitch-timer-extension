import { execFile } from "child_process";
import { promisify } from "util";
import { stat } from "fs/promises";
import { logger } from "./logger.js";

const execFileAsync = promisify(execFile);

// Anchored to actual YouTube hostnames only — never a substring match, same
// discipline as the thumbnail-source SSRF allowlist elsewhere in this app.
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

export function isYoutubeUrl(url) {
  try {
    const { hostname } = new URL(url);
    return YOUTUBE_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

// Kept short on purpose — this is meant to convert clip-sized highlights,
// not let the platform be used to mirror full videos. Also means we reject
// obviously-too-long videos before ever spending time downloading them.
export const MAX_YOUTUBE_DURATION_SEC = 180;

/**
 * Fetch metadata for a YouTube video without downloading it.
 * Returns { title, duration, thumbnail_url } or { error }.
 */
export async function fetchYoutubeInfo(url) {
  if (!isYoutubeUrl(url)) return { error: "Not a YouTube URL" };
  try {
    const { stdout } = await execFileAsync(
      "yt-dlp",
      ["--dump-json", "--no-playlist", "--skip-download", url],
      { timeout: 30000, maxBuffer: 10 * 1024 * 1024 },
    );
    const info = JSON.parse(stdout);
    const duration = Number(info.duration) || 0;
    if (duration > MAX_YOUTUBE_DURATION_SEC) {
      return {
        error: `Video is too long (${Math.round(duration / 60)} min). Max is ${Math.round(MAX_YOUTUBE_DURATION_SEC / 60)} minutes — this is meant for short clips, not full videos.`,
      };
    }
    return {
      title: info.title || "",
      duration,
      thumbnail_url: info.thumbnail || "",
    };
  } catch (err) {
    logger.warn("youtube_info_fetch_failed", { url, message: err?.message, stderr: err?.stderr?.slice?.(0, 300) });
    return { error: "Could not fetch video info. Check that the URL is valid and the video is public." };
  }
}

/**
 * Download a YouTube video to a local file path as MP4.
 * Returns { ok, error } — same shape as twitch_api.js's downloadClipVideo,
 * since routes_sounds.js's clip route treats both interchangeably.
 */
export async function downloadYoutubeVideo(url, destPath) {
  if (!isYoutubeUrl(url) || !destPath) return { ok: false, error: "Missing url or path" };
  try {
    logger.info("youtube_download_start", { url, destPath });
    await execFileAsync(
      "yt-dlp",
      [
        "-f", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format", "mp4",
        "--no-playlist",
        "-o", destPath,
        url,
      ],
      { timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
    );
    // yt-dlp can exit 0 without producing the requested merged file — e.g.
    // if ffmpeg is ever missing, it silently leaves separate .fNNN video/
    // audio streams instead of merging them, and still reports success.
    // Confirmed this exact failure mode locally; don't trust the exit code
    // alone.
    const fileStat = await stat(destPath).catch(() => null);
    if (!fileStat || fileStat.size === 0) {
      logger.warn("youtube_download_no_output_file", { url, destPath });
      return { ok: false, error: "Download completed but no video file was produced." };
    }
    return { ok: true, contentType: "video/mp4" };
  } catch (err) {
    logger.warn("youtube_download_failed", { url, message: err?.message, stderr: err?.stderr?.slice?.(0, 300) });
    return { ok: false, error: "Failed to download video. It may be private, age-restricted, or region-locked." };
  }
}
