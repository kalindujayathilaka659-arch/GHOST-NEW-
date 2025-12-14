const { cmd } = require("../command");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const TEMP_DIR = path.join(process.cwd(), "temp");
const COOKIES_PATH = path.join(process.cwd(), "cookies/xhamster.txt");

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function formatDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return "Unknown";
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6)}`;
}

function formatSize(bytes) {
  if (!bytes) return "Unknown";
  const mb = bytes / (1024 * 1024);
  return mb.toFixed(2) + " MB";
}

function getMetadata(url) {
  return new Promise((resolve, reject) => {
    const cmd =
      `yt-dlp "${url}" ` +
      `--cookies "${COOKIES_PATH}" ` +
      `--referer "https://xhamster.com/" ` +
      `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" ` +
      `--dump-json --no-warnings --quiet`;

    exec(cmd, (err, stdout) => {
      if (err) return reject(err);
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("Metadata parse failed"));
      }
    });
  });
}

function findVideoFile(base) {
  return fs.readdirSync(TEMP_DIR).find(
    f =>
      f.startsWith(base) &&
      !f.endsWith(".info.json") &&
      !f.endsWith(".part")
  );
}

cmd(
  {
    pattern: "xhamster",
    react: "🎥",
    desc: "Download XHamster videos with full metadata",
    category: "nsfw",
    filename: __filename,
  },
  async (robin, mek, m, { q, reply, from }) => {
    try {
      if (!q)
        return reply("❗ Usage: xhamster [360p|720p] <xhamster link>");

      const args = q.trim().split(/\s+/);
      let quality = "720";
      let url;

      if (/^\d{3,4}p$/.test(args[0])) {
        quality = args[0].replace("p", "");
        url = args[1];
      } else {
        url = args[0];
      }

      if (!url || !url.includes("xhamster.com"))
        return reply("❌ Invalid XHamster URL.");

      const base = `xhamster_${Date.now()}`;

      // 🔹 FETCH METADATA FIRST
      let meta = {};
      try {
        meta = await getMetadata(url);
      } catch {}

      const title = meta.title || "XHamster Video";
      const thumbnail = meta.thumbnail || null;
      const channel = meta.uploader || "Unknown";
      const views = meta.view_count
        ? meta.view_count.toLocaleString()
        : "Unknown";
      const uploadDate = formatDate(meta.upload_date);

      // 🔹 SEND THUMBNAIL + DOWNLOAD MESSAGE
      if (thumbnail) {
        await robin.sendMessage(
          from,
          {
            image: { url: thumbnail },
            caption:
              `🎬 *Downloading Video...*\n\n` +
              `📝 *Title:* ${title}\n` +
              `👤 *Channel:* ${channel}\n` +
              `📅 *Uploaded:* ${uploadDate}\n` +
              `👁 *Views:* ${views}\n` +
              `🎞 *Quality:* ${quality}p\n\n` +
              `📦 *Size:* ${size}\n` +
              `⏳ Please wait...`,
          },
          { quoted: mek }
        );
      } else {
        reply("🎬 Downloading video...");
      }

      // 🔹 DOWNLOAD VIDEO
      const downloadCmd =
        `yt-dlp "${url}" ` +
        `--cookies "${COOKIES_PATH}" ` +
        `--referer "https://xhamster.com/" ` +
        `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" ` +
        `--force-ipv4 --geo-bypass ` +
        `-f "bv*[height<=${quality}]/b[height<=${quality}]/best" ` +
        `--merge-output-format mp4 ` +
        `--write-info-json ` +
        `--no-warnings --quiet ` +
        `--paths home:"${TEMP_DIR}" --paths temp:"${TEMP_DIR}" ` +
        `-o "${base}.%(ext)s"`;

      exec(downloadCmd, async (err) => {
        if (err) {
          console.error("yt-dlp error:", err.message);
          return reply("❌ Download failed (premium/restricted).");
        }

        const videoFile = findVideoFile(base);
        if (!videoFile)
          return reply("❌ Download finished but video file not found.");

        const videoPath = path.join(TEMP_DIR, videoFile);
        const stats = fs.statSync(videoPath);
        const size = formatSize(stats.size);

        const buffer = fs.readFileSync(videoPath);
        const safeName = title.replace(/[^a-z0-9]/gi, "_").slice(0, 50);

        await robin.sendMessage(
          from,
          {
            document: buffer,
            mimetype: "video/mp4",
            fileName: `${safeName}.mp4`,
            caption:
              `🎥 *XHamster Video*\n\n` +
              `📝 *Title:* ${title}\n` +
              `👤 *Channel:* ${channel}\n` +
              `👁 *Views:* ${views}\n` +
              `📦 *Size:* ${size}\n` +
              `🎞 *Quality:* ${quality}p\n` +
              `🔗 ${url}`,
          },
          { quoted: mek }
        );

        // 🔹 CLEAN TEMP FILES
        fs.readdirSync(TEMP_DIR)
          .filter(f => f.startsWith(base))
          .forEach(f => fs.unlinkSync(path.join(TEMP_DIR, f)));
      });

    } catch (e) {
      console.error("XHamster plugin error:", e);
      reply("❌ Unexpected error occurred.");
    }
  }
);
