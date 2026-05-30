import express from "express";
import { bratGen } from "brat-canvas";
import { bratVid } from "brat-canvas/video";
import { generateIQC } from "iqc-canvas";

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    status: true,
    name: "M-Canvas API",
    endpoints: [
      {
        name: "Brat Image",
        method: "GET",
        path: "/api/m-canvas/brat",
        query: {
          text: "string"
        }
      },
      {
        name: "Brat Video",
        method: "GET",
        path: "/api/m-canvas/brat-video",
        query: {
          text: "string"
        }
      },
      {
        name: "IQC Canvas",
        method: "GET",
        path: "/api/m-canvas/iqc",
        query: {
          text: "string",
          time: "string",
          battery: "string",
          charging: "true/false",
          operator: "true/false",
          timebar: "true/false",
          wifi: "true/false"
        }
      }
    ]
  });
});

router.get("/brat", async (req, res) => {
  try {
    const text = String(req.query.text || "Hello World").trim();

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text wajib diisi"
      });
    }

    const buffer = await bratGen(text);

    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="brat.png"');

    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate Brat Image"
    });
  }
});

router.get("/brat-video", async (req, res) => {
  try {
    const text = String(req.query.text || "Hello World").trim();

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text wajib diisi"
      });
    }

    const buffer = await bratVid(text, {
      outputFormat: "mp4"
    });

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", 'inline; filename="brat-video.mp4"');

    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate Brat Video"
    });
  }
});

router.get("/iqc", async (req, res) => {
  try {
    const text = String(req.query.text || "Hello World").trim();
    const time = String(req.query.time || "00.00").trim();

    const battery = String(req.query.battery || "100").trim();

    const charging = String(req.query.charging || "false") === "true";
    const operator = String(req.query.operator || "true") !== "false";
    const timebar = String(req.query.timebar || "true") !== "false";
    const wifi = String(req.query.wifi || "true") !== "false";

    if (!text) {
      return res.status(400).json({
        status: false,
        message: "Parameter text wajib diisi"
      });
    }

    const result = await generateIQC(text, time, {
      baterai: [charging, battery],
      operator,
      timebar,
      wifi
    });

    const imageBuffer = result?.image;

    if (!result?.success || !Buffer.isBuffer(imageBuffer)) {
      return res.status(500).json({
        status: false,
        message: "Gagal mengambil buffer gambar IQC",
        result: {
          success: result?.success || false,
          mimeType: result?.mimeType || null,
          message: result?.message || null
        }
      });
    }

    res.setHeader("Content-Type", result.mimeType || "image/png");
    res.setHeader("Content-Disposition", 'inline; filename="iqc.png"');

    return res.send(imageBuffer);
  } catch (err) {
    return res.status(500).json({
      status: false,
      message: err.message || "Gagal generate IQC Canvas"
    });
  }
});

export default router;
