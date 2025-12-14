const { cmd } = require("../command");
const yts = require("yt-search");
const ytdlp = require("yt-dlp-exec");
const fs = require("fs");
const path = require("path");
const os = require("os");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

// Set FFmpeg binary path for yt-dlp merging
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const cookiesPath = path.resolve(process.cwd(), "cookies/youtube_cookies.txt");

cmd(
  {
    pattern: "video",
    react: "🎥",
    desc: "YouTube downloader (720p max, requires cookies)",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    if (!q) return reply("❌ Please provide a YouTube URL or search term.");

    if (!fs.existsSync(cookiesPath))
      return reply(
        "⚠️ `youtube_cookies.txt` not found in `/cookies/`. Please add your YouTube cookies for age-restricted videos."
      );

    try {
      let url = q;

      // If search term instead of URL → search it
      if (!q.includes("youtube.com") && !q.includes("youtu.be")) {
        const search = await yts(q);
        if (!search.videos.length) return reply("❌ No results found.");
        url = search.videos[0].url;
      }

      // Temp output file path
      const outputPath = path.join(os.tmpdir(), `yt_${Date.now()}.mp4`);

      // Download + merge video up to 720p
      await ytdlp(url, {
        format: "bestvideo[height<=720]+bestaudio/best[height<=720]",
        mergeOutputFormat: "mp4",
        output: outputPath,
        noCheckCertificates: true,
        quiet: true,
        noWarnings: true,
        cookies: cookiesPath,
        addHeader: [
          "referer:youtube.com",
          "user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        ],
        // FFmpeg path added
        ffmpegLocation: ffmpegInstaller.path,
      });

      // Get video metadata
      const info = await ytdlp(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        quiet: true,
        noWarnings: true,
        cookies: cookiesPath,
      });

      const sizeMB = fs.existsSync(outputPath)
        ? (fs.statSync(outputPath).size / 1048576).toFixed(2) + " MB"
        : "Unknown";
      const views = info.view_count
        ? info.view_count.toLocaleString()
        : "Unknown";
      const duration = info.duration
        ? new Date(info.duration * 1000).toISOString().substr(11, 8)
        : "Unknown";

      const metadata = `👻 GHOST VIDEO DOWNLOADER

🎥 *${info.title}*
📺 *Channel:* ${info.uploader}
🕒 *Duration:* ${duration}
👁 *Views:* ${views}
📅 *Uploaded:* ${info.upload_date || "Unknown"}
📦 *Quality:* 720p (merged)
📁 *Size:* ${sizeMB}
🔗 ${url}`;

      // Thumbnail with details
      await robin.sendMessage(
        from,
        { image: { url: info.thumbnail }, caption: metadata },
        { quoted: mek }
      );

      // Send video
      await robin.sendMessage(
        from,
        {
          video: fs.readFileSync(outputPath),
          mimetype: "video/mp4",
          caption: `🎬 *${info.title}*\n📦 720p merged video • ${sizeMB}`,
        },
        { quoted: mek }
      );

      // Remove temp file
      fs.unlinkSync(outputPath);
    } catch (error) {
      console.error("yt-dlp error:", error);

      if (
        error.stderr?.includes("Sign in to confirm") ||
        error.message?.includes("Sign in to confirm")
      ) {
        return reply(
          "⚠️ This video requires YouTube login. Update your `youtube_cookies.txt` file."
        );
      }

      reply(`❌ Error: ${error.message || "Failed to download video."}`);
    }
  }
);
