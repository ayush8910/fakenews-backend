import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fetch from 'node-fetch';
import { createServer } from '@vercel/node';

const app = express();
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

const API_KEY = "AIzaSyAsealsJB-a5XioYFUe1VK0iKyOsVENlQM";

app.post('/api/check-fake-news', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  try {
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
    const requestBody = {
      contents: [
        {
          parts: [
            { text: "Analyze this image and tell me if it might be fake news or misinformation. Provide a reason." },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Image
              }
            }
          ]
        }
      ]
    };

    const response = await fetch(geminiApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    const finalText = result.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini";
    res.json({ result: finalText });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

export default createServer(app);
