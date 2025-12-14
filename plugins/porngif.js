const { cmd } = require("../command");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

cmd(
  {
    pattern: "pornclip",
    react: "🔞",
    desc: "Send a short clip (RedGifs, mobile safe)",
    category: "nsfw",
    filename: __filename,
  },
  async (robin, mek, m, { q, reply, from }) => {
    try {
      const rawTag = q ? q.trim().toLowerCase() : "ass";
      const keywords = rawTag.split(/\s+/);

      await reply(`🔍 Searching for: *${rawTag}*`);

      // 🔑 Auth
      const authRes = await axios.get(
        "https://api.redgifs.com/v2/auth/temporary",
        { timeout: 15000 }
      );

      const token = authRes.data?.token;
      if (!token) return reply("❌ Auth failed.");

      // 🔍 Search
      const searchRes = await axios.get(
        `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(rawTag)}&count=80`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 20000,
        }
      );

      const gifs = searchRes.data?.gifs || [];
      if (!gifs.length) return reply("❌ No results.");

      // 🎯 Accurate filter
      const accurate = gifs.filter(g => {
        const title = (g.title || "").toLowerCase();
        const tags = (g.tags || []).join(" ").toLowerCase();
        return keywords.every(k => title.includes(k) || tags.includes(k));
      });

      if (!accurate.length) {
        return reply("❌ No close match found.");
      }

      const selected =
        accurate[Math.floor(Math.random() * accurate.length)];

      const mediaUrl =
        selected.urls?.sd || selected.urls?.hd;

      if (!mediaUrl) return reply("❌ No playable clip.");

      // 📥 Download to temp
      const tempDir = path.join(process.cwd(), "temp");
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

      const filePath = path.join(
        tempDir,
        `redgifs_${Date.now()}.mp4`
      );

      const videoRes = await axios.get(mediaUrl, {
        responseType: "stream",
        timeout: 30000,
      });

      await new Promise((resolve, reject) => {
        const stream = fs.createWriteStream(filePath);
        videoRes.data.pipe(stream);
        stream.on("finish", resolve);
        stream.on("error", reject);
      });

      // 📤 Send LOCAL FILE (mobile-safe)
      await robin.sendMessage(
        from,
        {
          video: fs.readFileSync(filePath),
          mimetype: "video/mp4",
          caption: `🎞️ *${selected.title || rawTag}*`,
          gifPlayback: false,
        },
        { quoted: mek }
      );

      fs.unlinkSync(filePath);

    } catch (err) {
      console.error("RedGifs error:", err.message);
      reply("❌ Failed to fetch clip.");
    }
  }
);
