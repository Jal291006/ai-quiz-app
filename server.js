const express = require('express');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

function loadEnvFile() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        return;
    }

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    lines.forEach((line) => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            return;
        }

        const separatorIndex = trimmedLine.indexOf('=');
        if (separatorIndex === -1) {
            return;
        }

        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = trimmedLine.slice(separatorIndex + 1).trim();

        if (key && !process.env[key]) {
            process.env[key] = value;
        }
    });
}

loadEnvFile();

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function createPrompt({ topic, amount, type, difficulty }) {
    const normalizedType = type === 'true or false' ? 'true/false' : 'multiple-choice';

    return `
Generate exactly ${amount} quiz questions about "${topic}".

Rules:
- Question type: ${normalizedType}
- Difficulty: ${difficulty}
- Return only valid JSON.
- Keep questions clear, fact-based, and suitable for a quiz app.
- For true/false questions, options must be exactly ["True", "False"].
- For multiple-choice questions, provide exactly 4 options.
- The correctAnswer must match one of the options exactly.
- Include a short explanation for each answer.

Return JSON in this shape:
{
  "questions": [
    {
      "question": "string",
      "options": ["string"],
      "correctAnswer": "string",
      "explanation": "string",
      "difficulty": "easy|medium|hard|extreme|true/false"
    }
  ]
}`.trim();
}

function validateGeneratedQuestions(questions, requestedType, requestedAmount) {
    if (!Array.isArray(questions) || questions.length !== requestedAmount) {
        throw new Error('Gemini did not return the expected number of questions.');
    }

    return questions.map((question, index) => {
        if (!question || typeof question.question !== 'string' || !question.question.trim()) {
            throw new Error(`Question ${index + 1} is missing its text.`);
        }

        if (!Array.isArray(question.options)) {
            throw new Error(`Question ${index + 1} is missing options.`);
        }

        if (requestedType === 'true or false') {
            if (question.options.length !== 2 || !question.options.includes('True') || !question.options.includes('False')) {
                throw new Error(`Question ${index + 1} must use True and False options.`);
            }
        } else if (question.options.length !== 4) {
            throw new Error(`Question ${index + 1} must have exactly 4 options.`);
        }

        if (!question.options.includes(question.correctAnswer)) {
            throw new Error(`Question ${index + 1} has an invalid correct answer.`);
        }

        return {
            question: question.question.trim(),
            options: question.options.map((option) => String(option).trim()),
            correctAnswer: String(question.correctAnswer).trim(),
            explanation: question.explanation ? String(question.explanation).trim() : 'No explanation provided.',
            difficulty: requestedType === 'true or false'
                ? 'true/false'
                : String(question.difficulty || 'medium').toLowerCase()
        };
    });
}

app.post('/api/generate-quiz', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                error: 'Missing GEMINI_API_KEY. Add it to your environment before using Gemini mode.'
            });
        }

        const { topic, amount, type, difficulty } = req.body || {};

        if (!topic || typeof topic !== 'string') {
            return res.status(400).json({ error: 'Topic is required.' });
        }

        const parsedAmount = Number(amount);
        if (!Number.isInteger(parsedAmount) || parsedAmount < 1 || parsedAmount > 20) {
            return res.status(400).json({ error: 'Amount must be between 1 and 20.' });
        }

        if (!['multiple-choice', 'true or false'].includes(type)) {
            return res.status(400).json({ error: 'Invalid question type.' });
        }

        const normalizedDifficulty = type === 'true or false' ? 'true/false' : difficulty;
        if (!['easy', 'medium', 'hard', 'extreme', 'true/false'].includes(normalizedDifficulty)) {
            return res.status(400).json({ error: 'Invalid difficulty.' });
        }

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: createPrompt({
                topic: topic.trim(),
                amount: parsedAmount,
                type,
                difficulty: normalizedDifficulty
            }),
            config: {
                responseMimeType: 'application/json'
            }
        });

        const parsed = JSON.parse(response.text);
        const questions = validateGeneratedQuestions(parsed.questions, type, parsedAmount);

        return res.json({ questions });
    } catch (error) {
        console.error('Gemini quiz generation failed:', error);
        return res.status(500).json({
            error: error.message || 'Unable to generate quiz questions right now.'
        });
    }
});

app.listen(PORT, () => {
    console.log(`AI Quiz app running at http://localhost:${PORT}`);
});
