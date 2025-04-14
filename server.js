import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = "AIzaSyAsealsJB-a5XioYFUe1VK0iKyOsVENlQM"; // Replace with your actual API key

// Multer config
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());

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
                    { 
                        text: "Carefully analyze the text in this image and determine if it contains potentially false information or fake news. " +
                              "First, extract and verify all factual claims made in the image text. " +
                              "Then, perform a web search to check the accuracy of these claims. " +
                              "Provide your assessment with reasoning, citing sources if available. " +
                              "Consider the following in your analysis:\n" +
                              "1. Are the claims verifiable through reputable sources?\n" +
                              "2. Does the image contain any signs of manipulation or misleading context?\n" +
                              "3. Are there any logical inconsistencies in the claims?\n" +
                              "Format your response with:\n" +
                              "- Summary of image content\n" +
                              "- Fact-checking results\n" +
                              "- Verdict (Likely True, Possibly Misleading, Likely False)\n" +
                              "- Supporting evidence"
                    },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: imageBase64
                        }
                    }
                ]
            }],
            generationConfig: {
                enableWebSearch: true  // Enable web search for fact-checking
            }
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

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
