const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const app = express();
const port = 3000;

// Middleware
app.use(cors()); 
app.use(express.json()); 

const ai = new GoogleGenAI({});

app.get('/', (req, res) => {
    res.send('Quiz Backend is running!');
});

// THIS IS THE UPDATED ROUTE!
app.get('/api/generate-quiz', async (req, res) => {
    try {
        // 1. Grabs the specific category from your frontend dropdown!
        const category = req.query.category || 'a completely random educational topic';
        const amount=req.query.amount || 5;
        const type = req.query.type|| 'multiple choice'
       console.log(`Asking Gemini for ${amount} ${type} questions about: ${category}...`);
        
        // 2. Inserts that category directly into the Gemini prompt
        const prompt = `Generate ${amount} ${type} questions about ${category}. You must return ONLY valid JSON. The JSON should be an array of objects. Each object must have three keys: "question" (a string), "options" (an array of strings representing the choices), and "correctAnswer" (a string that matches one of the options).`;
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        console.log("Quiz generated successfully!");
        res.send(response.text);

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: 'Failed to generate quiz' });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});