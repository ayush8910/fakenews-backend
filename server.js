import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import multer from "multer";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = "AIzaSyAsealsJB-a5XioYFUe1VK0iKyOsVENlQM"; // Replace with your actual API key

// Simple cache implementation to store results by image hash
const resultCache = new Map();

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
        
        // Create a hash of the image buffer to use as cache key
        const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
        
        // Check if we have a cached result for this exact image
        if (resultCache.has(imageHash)) {
            console.log("Returning cached result for image");
            return res.json({ result: resultCache.get(imageHash) });
        }
        
        const imageBase64 = imageBuffer.toString('base64');

        // Use Gemini 2.0 Flash endpoint
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

        const requestBody = {
            contents: [{
                parts: [
                    { 
                        text: "You are a consistent fact-checking system analyzing images for misleading or false information. Follow these exact steps for every analysis:\n\n" +
                              "Step 1: Extract all text visible in the image precisely.\n" +
                              "Step 2: Identify specific factual claims present in the text.\n" +
                              "Step 3: Evaluate each claim systematically using these criteria:\n" +
                              "   - Logical consistency\n" +
                              "   - Presence of verifiable facts\n" +
                              "   - Apparent source credibility\n" +
                              "   - Consistency with established knowledge\n\n" +
                              "CRITICAL INSTRUCTION: Your response MUST begin with EXACTLY ONE of these three words: \"True\", \"False\", or \"Uncertain\" followed by a space and then your detailed analysis. Choose the word that best represents your overall assessment.\n\n" +
                              "After that first word, your detailed analysis MUST follow this exact structure:\n" +
                              "1. IMAGE CONTENT: [Brief factual description of what's in the image]\n" +
                              "2. EXTRACTED CLAIMS: [Numbered list of specific claims made]\n" +
                              "3. ANALYSIS: [Systematic assessment of each claim]\n" +
                              "4. CONFIDENCE: [HIGH, MEDIUM, or LOW]\n" +
                              "5. REASONING: [Brief explanation of your verdict]\n\n" +
                              "Example starting format:\n" +
                              "\"True IMAGE CONTENT: ...\" or \"False IMAGE CONTENT: ...\" or \"Uncertain IMAGE CONTENT: ...\"\n\n" +
                              "Important: Focus only on verifiable facts. Do not speculate beyond what can be determined from the image content. Maintain a neutral tone throughout your analysis."
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
                temperature: 0.2,       // Lower temperature for more deterministic results
                topP: 0.8,              // Lower top-p for more focused outputs
                topK: 40,               // Standard top-k parameter
                maxOutputTokens: 1024    // Limit output size
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
            
            // Store the result in cache
            resultCache.set(imageHash, resultText);
            
            // Limit cache size to prevent memory issues (optional)
            if (resultCache.size > 1000) {
                const oldestKey = resultCache.keys().next().value;
                resultCache.delete(oldestKey);
            }
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
