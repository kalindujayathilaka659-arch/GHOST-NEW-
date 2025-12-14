const { cmd } = require("../command");
const axios = require("axios");

cmd(
  {
    pattern: "pornclip",
    react: "🔞",
    desc: "Send a short clip (RedGifs, accurate search)",
    category: "nsfw",
    filename: __filename,
  },
  async (robin, mek, m, { q, reply, from }) => {
    try {
      const rawTag = q ? q.trim().toLowerCase() : "ass";
      const keywords = rawTag.split(/\s+/); // 🔍 keyword list

      await reply(`🔍 Searching RedGifs for: *${rawTag}*`);

      // 🔑 Auth
      const authRes = await axios.get(
        "https://api.redgifs.com/v2/auth/temporary",
        {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
          },
          timeout: 15000,
        }
      );

      const token = authRes.data?.token;
      if (!token) return reply("❌ RedGifs auth failed.");

      // 🔍 Search (keep original spacing for accuracy)
      const searchRes = await axios.get(
        `https://api.redgifs.com/v2/gifs/search?search_text=${encodeURIComponent(
          rawTag
        )}&count=80`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
          },
          timeout: 20000,
        }
      );

      const gifs = searchRes.data?.gifs;
      if (!Array.isArray(gifs) || gifs.length === 0) {
        return reply(`❌ No results for: *${rawTag}*`);
      }

      // 🎯 ACCURACY FILTER
      const accurate = gifs.filter(g => {
        const title = (g.title || "").toLowerCase();
        const tags = (g.tags || []).join(" ").toLowerCase();

        // every keyword must appear
        return keywords.every(
          k => title.includes(k) || tags.includes(k)
        );
      });

      if (!accurate.length) {
        return reply(`❌ No closely matched clips for: *${rawTag}*`);
      }

      // 🎲 Pick random accurate clip
      const selected =
        accurate[Math.floor(Math.random() * accurate.length)];

      const mediaUrl =
        selected.urls?.sd ||
        selected.urls?.hd ||
        selected.urls?.gif;

      if (!mediaUrl) return reply("❌ No playable clip found.");

      const pageUrl = `https://www.redgifs.com/watch/${selected.id}`;

      // 📤 Send as NORMAL video (no gif playback)
      await robin.sendMessage(
        from,
        {
          video: { url: mediaUrl },
          caption: `🎞️ *${selected.title || rawTag}*\n🔗 ${pageUrl}`,
          mimetype: "video/mp4",
          gifPlayback: false, // ❌ GIF playback OFF
        },
        { quoted: mek }
      );

    } catch (err) {
      console.error("RedGifs error:", err.response?.status, err.message);
      reply("❌ Failed to fetch clip.");
    }
  }
);
