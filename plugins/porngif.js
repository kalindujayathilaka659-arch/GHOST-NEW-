const fs = require("fs");
const path = require("path");
const axios = require("axios");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function processVideo(sourceUrl) {
  const tempDir = path.join(process.cwd(), "temp");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  const rawPath = path.join(tempDir, `raw_${Date.now()}.mp4`);
  const finalPath = path.join(tempDir, `final_${Date.now()}.mp4`);

  // ⬇️ Download
  const res = await axios.get(sourceUrl, { responseType: "stream" });
  await new Promise((resolve, reject) => {
    const s = fs.createWriteStream(rawPath);
    res.data.pipe(s);
    s.on("finish", resolve);
    s.on("error", reject);
  });

  // 🔁 TRY STREAM COPY (keeps original size)
  try {
    await new Promise((resolve, reject) => {
      ffmpeg(rawPath)
        .outputOptions([
          "-c:v copy",
          "-c:a copy",
          "-movflags +faststart",
        ])
        .save(finalPath)
        .on("end", resolve)
        .on("error", reject);
    });

    return finalPath; // ✅ original size preserved
  } catch {
    // ⬇️ FALLBACK: SAFE RE-ENCODE
    await new Promise((resolve, reject) => {
      ffmpeg(rawPath)
        .outputOptions([
          "-movflags +faststart",
          "-vf scale=trunc(iw/2)*2:trunc(ih/2)*2",
          "-pix_fmt yuv720p",
          "-crf 23",
          "-preset medium",
          "-b:a 128k",
          "-shortest",
        ])
        .videoCodec("libx264")
        .audioCodec("aac")
        .format("mp4")
        .save(finalPath)
        .on("end", resolve)
        .on("error", reject);
    });

    return finalPath;
  }
}

module.exports = { processVideo };
