const { cmd } = require("../command");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

cmd(
  {
    pattern: "pornclip",
    react: "🔞",
    desc: "Send RedGifs clip (mobile safe)",
    category: "nsfw",
    filename: __filename,
  },
  async (robin, mek, m, { q, reply, from }) => {
    try {
      const rawTag = q ? q.trim().toLowerCase() : "ass";
      const keywords = rawTag.split(/\s+/);

      await reply(`🔍 Searching for: *${rawTag}*`);

      // 🔑 Auth
      const auth = await axios.get("https://api.redgifs.com/v2/auth/temporary");
      const token = auth.data?.token;
      if (!token) return reply("❌ Auth failed");

      // 🔍 Search
      const search = await axios.get(
        `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(rawTag)}&count=80`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const gifs = search.data?.gifs || [];
      if (!gifs.length) return reply("❌ No results");

      const accurate = gifs.filter(g => {
        const t = (g.title || "").toLowerCase();
        const tg = (g.tags || []).join(" ").toLowerCase();
        return keywords.every(k => t.includes(k) || tg.includes(k));
      });

      if (!accurate.length) return reply("❌ No close match");

      const selected = accurate[Math.floor(Math.random() * accurate.length)];
      const sourceUrl = selected.urls?.sd || selected.urls?.hd;
      if (!sourceUrl) return reply("❌ No video URL");

      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

      const rawPath = path.join(tempDir, `rg_raw_${Date.now()}.mp4`);
      const fixedPath = path.join(tempDir, `rg_fixed_${Date.now()}.mp4`);

      // 📥 Download
      const res = await axios.get(sourceUrl, { responseType: "stream" });
      await new Promise((resolve, reject) => {
        const s = fs.createWriteStream(rawPath);
        res.data.pipe(s);
        s.on("finish", resolve);
        s.on("error", reject);
      });

      // 🎞️ RE-ENCODE FOR WHATSAPP MOBILE
      await new Promise((resolve, reject) => {
        ffmpeg(rawPath)
          .outputOptions([
            "-movflags +faststart",
            "-pix_fmt yuv420p",
            "-profile:v baseline",
            "-level 3.0",
          ])
          .videoCodec("libx264")
          .audioCodec("aac")
          .audioBitrate("128k")
          .format("mp4")
          .save(fixedPath)
          .on("end", resolve)
          .on("error", reject);
      });

      // 📤 SEND (MOBILE SAFE)
      await robin.sendMessage(
        from,
        {
          video: fs.readFileSync(fixedPath),
          mimetype: "video/mp4",
          caption: `🎞️ *${selected.title || rawTag}*`,
          gifPlayback: false,
        },
        { quoted: mek }
      );

      fs.unlinkSync(rawPath);
      fs.unlinkSync(fixedPath);

    } catch (e) {
      console.error("pornclip error:", e.message);
      reply("❌ Failed to send clip");
    }
  }
);
