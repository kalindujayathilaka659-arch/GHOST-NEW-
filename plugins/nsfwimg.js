const { cmd } = require("../command");
const axios = require("axios");
const xml2js = require("xml2js");
const fs = require("fs");
const path = require("path");

const cookiesPath = path.resolve(process.cwd(), "cookies/rule34_cookies.txt");

cmd(
  {
    pattern: "nsfwimg",
    react: "🍑",
    desc: "Get 3 NSFW images by keyword or random (rule34.xxx)",
    category: "nsfw",
    filename: __filename,
  },
  async (robin, mek, m, { q, from, reply }) => {
    try {
      // 🔒 Optional: restrict to groups / owner
      // if (!m.isGroup) return reply("❌ This command works in groups only.");

      const tag = q?.trim().replace(/\s+/g, "_") || "";
      const limit = 100;

      // 🍪 Load cookies
      const cookies = fs.existsSync(cookiesPath)
        ? fs.readFileSync(cookiesPath, "utf-8").trim()
        : "";

      const apiUrl =
        `https://rule34.xxx/index.php?page=dapi&s=post&q=index&limit=${limit}` +
        (tag ? `&tags=${encodeURIComponent(tag)}` : "");

      const res = await axios.get(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          Referer: "https://rule34.xxx/",
          Cookie: cookies,
        },
        timeout: 15000,
      });

      // 🧠 Parse XML
      const parsed = await xml2js.parseStringPromise(res.data);
      const posts = parsed?.posts?.post;

      if (!posts || posts.length === 0) {
        return reply(`❌ No images found for: ${q || "random"}`);
      }

      // 🎯 Pick 3 random images
      const selected = [];
      const used = new Set();

      while (selected.length < 3 && selected.length < posts.length) {
        const i = Math.floor(Math.random() * posts.length);
        if (!used.has(i)) {
          used.add(i);
          selected.push(posts[i].$);
        }
      }

      // 📤 Send images
      for (const post of selected) {
        const imageUrl = post.file_url.startsWith("http")
          ? post.file_url
          : `https://rule34.xxx/${post.file_url}`;

        const caption = `🍑 *NSFW Image*
🔍 *Tags:* ${post.tags || "Unknown"}
🔞 *Rating:* ${post.rating?.toUpperCase() || "N/A"}
🆔 *ID:* ${post.id}`;

        await robin.sendMessage(
          from,
          {
            image: { url: imageUrl },
            caption,
          },
          { quoted: mek }
        );
      }
    } catch (err) {
      console.error("Rule34 error:", err.message);
      reply("❌ Failed to fetch images. Try another keyword.");
    }
  }
);
