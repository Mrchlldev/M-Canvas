import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mCanvasRoute from "./server/routes/m-canvas.js";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/", (req, res) => {
  res.json({
    status: true,
    name: "M-Canvas Backend",
    creator: "Mrchlldev",
    endpoints: {
      bratImage: "/api/m-canvas/brat?text=halo",
      bratVideo: "/api/m-canvas/brat-video?text=halo",
      iqc: "/api/m-canvas/iqc?text=Hello%20World&time=00.00",
      rinChat: "/api/m-canvas/rin-chat?text=Earth%20without%20art%20is%20just%20eh%20🌍🎨✨&time=16.34",
      fakeFF: "/api/m-canvas/fake-ff?username=Ditzzx&lobby=5",
      fakeML: "/api/m-canvas/fake-ml?avatar=https://example.com/avatar.jpg&username=Ditzzx&rank=imo&border=1"
    }
  });
});

app.use("/api/m-canvas", mCanvasRoute);

app.use((req, res) => {
  res.status(404).json({
    status: false,
    message: "Endpoint tidak ditemukan"
  });
});

app.listen(PORT, () => {
  console.log(`M-Canvas Backend running on http://localhost:${PORT}`);
});
