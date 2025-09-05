require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const shortid = require('shortid');
const { GoogleGenAI } = require('@google/genai');

const Thread = require('./models/Thread');
const Message = require('./models/Message');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI; // accepts both
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// ✅ Gemini client
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// connect mongodb
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=> console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  });

// image upload setup
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id = shortid.generate();
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, id + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB

// serve static
app.use('/', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR));

/* ---------------- THREAD ROUTES ---------------- */
app.get('/api/threads', async (req, res) => {
  const threads = await Thread.find().sort({ updatedAt: -1 });
  res.json(threads);
});
app.post('/api/threads', async (req, res) => {
  const { name } = req.body;
  const thread = new Thread({ name: name || 'New Thread' });
  await thread.save();
  res.json(thread);
});
app.put('/api/threads/:id', async (req, res) => {
  const { name } = req.body;
  const t = await Thread.findByIdAndUpdate(req.params.id, { name }, { new: true });
  res.json(t);
});
app.delete('/api/threads/:id', async (req, res) => {
  const { id } = req.params;
  const messages = await Message.find({ threadId: id });
  for (const m of messages) {
    if (m.imagePath) {
      try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(m.imagePath))); } catch {}
    }
  }
  await Message.deleteMany({ threadId: id });
  await Thread.findByIdAndDelete(id);
  res.json({ ok: true });
});

/* ---------------- MESSAGE ROUTES ---------------- */
app.get('/api/messages/:threadId', async (req, res) => {
  const msgs = await Message.find({ threadId: req.params.threadId }).sort({ createdAt: 1 });
  res.json(msgs);
});

app.post("/api/messages", upload.single("image"), async (req, res) => {
  try {
    const { threadId, text } = req.body;
    const image = req.file;

    // Save user message first
    const userMsg = new Message({
      threadId,
      role: "user",
      text,
      imagePath: image ? "/uploads/" + image.filename : null,
      waiting: false
    });
    await userMsg.save();

    // Add waiting assistant message
    const waitMsg = new Message({
      threadId,
      role: "assistant",
      text: "⏳ Thinking...",
      waiting: true
    });
    await waitMsg.save();

    res.json({ ok: true });

    // Call Gemini
    try {
      const result = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: text
      });

      // Update assistant message
      waitMsg.text = result.text || "(no response)";
      waitMsg.waiting = false;
      await waitMsg.save();
    } catch (err) {
      console.error("Gemini API error:", err.message);
      waitMsg.text = "⚠️ Gemini API is overloaded (503). Please try again later.";
      waitMsg.waiting = false;
      await waitMsg.save();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ---------------- IMAGE DELETE ---------------- */
app.post('/api/delete-image', (req, res) => {
  const { imagePath } = req.body;
  if (!imagePath) return res.json({ ok: false });
  const full = path.join(UPLOAD_DIR, path.basename(imagePath));
  try {
    fs.unlinkSync(full);
    res.json({ ok: true });
  } catch {
    res.json({ ok: false });
  }
});

app.listen(PORT, () => console.log(`🚀 Server running http://localhost:${PORT}`));
