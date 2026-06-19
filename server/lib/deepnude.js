const FormData = require('form-data');
const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');
const os = require('os');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const genHex = (bytes) => crypto.randomBytes(bytes).toString('hex');

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/5.0 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/5.0",
  "Accept": "application/json, text/plain, */*",
  "fp": "736a40aa4f1955107de07e754dd90a83",
  "fp1": "+7DgyHTn35SMUvUEJrBzpoN6iaxV5NNq4Nl2athfyJpprPzHxCGH9A04O/oHnFul",
  "x-guide": "GgnEiQoxF1/aBuSiJ70hQcXilAXI9507s4p9NwyLsJq27TDUQdbReZuzkjh6Rc2fO+sT4tlY7i+X26FceZhgplhyA5xCPd7CYAUQWu+24FGbYkwcy/EnVz2Ln2wXyhlb8QzpYMNOZNhP+iv15O1RE8fMvxniG4V8f48mlsaHU2o=",
  "theme-version": "83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q",
  "X-code": "1781249888197",
  "Brand-Key": "8f3f0c7387123ae0",
  "Origin": "https://live3d.io",
  "Referer": "https://live3d.io/"
};

const STATIC_ORIGIN_FROM = genHex(8);

const getGot = async () => {
  const { gotScraping } = await import('got-scraping');
  return gotScraping;
};

const deepNude = {
  upload: async (input) => {
    try {
      const tempDir = os.tmpdir();
      const filePath = path.join(tempDir, `temp_${Date.now()}.jpg`);
      
      const res = await axios({ url: input, method: 'GET', responseType: 'stream' });
      await new Promise((resolve, reject) => {
        res.data.pipe(fs.createWriteStream(filePath)).on('finish', resolve).on('error', reject);
      });

      const gotScraping = await getGot();
      let data = new FormData();
      data.append('file', fs.createReadStream(filePath), { filename: 'img.jpg', contentType: 'image/jpeg' });
      data.append('fn_name', 'cloth-change');
      data.append('request_from', '9');
      data.append('origin_from', STATIC_ORIGIN_FROM);

      const response = await gotScraping.post('https://app-v1.live3d.io/aitools/upload-img', { 
        body: data, 
        headers: { ...DEFAULT_HEADERS, ...data.getHeaders() },
        responseType: 'json' 
      });
      
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return response.body?.code === 200 ? response.body.data.path : null;
    } catch (e) { return null; }
  },

  make: async (imagePath) => {
    try {
      const gotScraping = await getGot();
      const payload = { 
        fn_name: "cloth-change", 
        call_type: 3, 
        input: { source_image: imagePath, prompt: "best quality, naked, nude. Maintain the pose, if the breasts are small then enlarge them, otherwise if they are already large then leave them! Don't make breasts smaller!!!!", cloth_type: "full_outfits", request_from: 9, type: 1 }, 
        request_from: 9, 
        origin_from: STATIC_ORIGIN_FROM 
      };
      const response = await gotScraping.post('https://app-v1.live3d.io/aitools/of/create', { json: payload, headers: DEFAULT_HEADERS, responseType: 'json' });
      return response.body?.code === 200 ? response.body.data.task_id : null;
    } catch (e) { return null; }
  },

  status: async (taskId) => {
    try {
      const gotScraping = await getGot();
      const payload = { task_id: taskId, fn_name: "cloth-change", call_type: 3, consume_type: 0, request_from: 9, origin_from: STATIC_ORIGIN_FROM };
      const response = await gotScraping.post('https://app-v1.live3d.io/aitools/of/check-status', { json: payload, headers: DEFAULT_HEADERS, responseType: 'json' });
      if (response.body?.code === 200 && response.body.data.status === 2) {
        return { status: 'success', url: 'https://temp.live3d.io/' + response.body.data.result_image };
      }
      return { status: 'pending' };
    } catch (e) { return { status: 'pending' }; }
  },

  create: async (input) => {
    try {
      const imagePath = await deepNude.upload(input);
      if (!imagePath) throw new Error('Upload gagal');
      const taskId = await deepNude.make(imagePath);
      if (!taskId) throw new Error('Task gagal');
      for (let i = 0; i < 15; i++) {
        await sleep(5000);
        const res = await deepNude.status(taskId);
        if (res.status === 'success') return { success: true, result: res.url };
      }
      throw new Error('Timeout');
    } catch (e) { return { success: false, result: e.message }; }
  }
};

export { deepNude };
