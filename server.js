import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = "AIzaSyAsealsJB-a5XioYFUe1VK0iKyOsVENlQM"; // Replace with your actual API key

// Multer config
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Enable CORS for all routes
app.use(cors());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Image + text prompt handling with Gemini 2.0 Flash
app.post("/check-fake-news", upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded." });
    }

    try {
        const imageBuffer = req.file.buffer;
        const mimeType = req.file.mimetype;
        const imageBase64 = imageBuffer.toString('base64');

        // Use Gemini 2.0 Flash endpoint
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

        const requestBody = {
            contents: [{
                parts: [
                    { text: "Analyze this image and tell me if it might be fake news or misinformation. Provide a reason." },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: imageBase64
                        }
                    }
                ]
            }]
        };

        const geminiResponse = await fetch(geminiApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.text();
            console.error("Gemini API Error Status:", geminiResponse.status);
            console.error("Gemini API Error Response:", errorData);
            throw new Error(`Gemini API request failed with status: ${geminiResponse.status}`);
        }

        const data = await geminiResponse.json();

        let resultText = "No analysis available.";
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            resultText = data.candidates[0].content.parts[0].text;
        } else {
            console.warn("Unexpected Gemini response structure:", data);
        }

        res.json({ result: resultText });

    } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).json({ error: "Failed to process image and get analysis." });
    }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
