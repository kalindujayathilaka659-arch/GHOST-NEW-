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
    desc: "Send RedGifs clip (max quality, mobile safe)",
    category: "nsfw",
    filename: __filename,
  },
  async (robin, mek, m, { q, reply, from }) => {
    try {
      const rawTag = q ? q.trim().toLowerCase() : "ass";
      const keywords = rawTag.split(/\s+/);

      await reply(`🔍 Searching for: *${rawTag}*`);

      // 🔑 AUTH
      const auth = await axios.get(
        "https://api.redgifs.com/v2/auth/temporary",
        { timeout: 15000 }
      );
      const token = auth.data?.token;
      if (!token) return reply("❌ RedGifs auth failed.");

      // 🔍 SEARCH
      const search = await axios.get(
        `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(rawTag)}&count=80`,
        { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 }
      );

      const gifs = search.data?.gifs || [];
      if (!gifs.length) return reply("❌ No results found.");

      // 🎯 ACCURACY FILTER
      const accurate = gifs.filter(g => {
        const title = (g.title || "").toLowerCase();
        const tags = (g.tags || []).join(" ").toLowerCase();
        return keywords.every(k => title.includes(k) || tags.includes(k));
      });

      if (!accurate.length)
        return reply("❌ No closely matched clips.");

      const selected =
        accurate[Math.floor(Math.random() * accurate.length)];

      // 🏆 MAX QUALITY SOURCE
      const sourceUrl =
        selected.urls?.hd || selected.urls?.sd;

      if (!sourceUrl)
        return reply("❌ No playable video found.");

      // 📁 TEMP
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

      const rawPath = path.join(tempDir, `rg_raw_${Date.now()}.mp4`);
      const fixedPath = path.join(tempDir, `rg_final_${Date.now()}.mp4`);

      // 📥 DOWNLOAD
      const videoRes = await axios.get(sourceUrl, {
        responseType: "stream",
        timeout: 30000,
      });

      await new Promise((resolve, reject) => {
        const stream = fs.createWriteStream(rawPath);
        videoRes.data.pipe(stream);
        stream.on("finish", resolve);
        stream.on("error", reject);
      });

      // 🎞️ RE-ENCODE (MAX QUALITY + MOBILE SAFE)
      await new Promise((resolve, reject) => {
        ffmpeg(rawPath)
          .outputOptions([
            "-movflags +faststart",
            "-vf scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-pix_fmt yuv420p",
            "-crf 18",           // 🔥 HIGH QUALITY
            "-preset slow",      // 🔥 BETTER COMPRESSION
            "-profile:v baseline",
            "-level 3.0",
            "-shortest",
          ])
          .videoCodec("libx264")
          .audioCodec("aac")
          .audioBitrate("128k")
          .format("mp4")
          .save(fixedPath)
          .on("end", resolve)
          .on("error", reject);
      });

      // 📤 SEND (WORKS ON MOBILE)
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

    } catch (err) {
      console.error("pornclip error:", err.message);
      reply("❌ Failed to send clip.");
    }
  }
);
