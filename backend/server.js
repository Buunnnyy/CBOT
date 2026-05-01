import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import Groq from 'groq-sdk';
import { extractText } from 'unpdf';
import fs from 'fs';

// Verify API Key on startup
const GROQ_KEY = process.env.GROQ_API_KEY || 'YOUR_GROQ_API_KEY_HERE';
console.log("Groq Key setup ready! 🚀");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const groq = new Groq({ apiKey: GROQ_KEY });
const MODEL = "llama-3.3-70b-versatile";

const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200MB total across all docs

const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 200 * 1024 * 1024 }
});

// ─── In-Memory Store ────────────────────────────────────────────────────────
// Each entry: { text, fileName, fileSize }
let knowledgeBase = [];

// Track files: { fileName, chunks, size, uploadedAt }
let uploadedFiles = [];

function getTotalSize() {
    return uploadedFiles.reduce((sum, f) => sum + f.size, 0);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function chunkText(text, size = 2000, overlap = 300) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + size));
        i += size - overlap;
    }
    return chunks;
}

function getRelevantChunks(query, topK = 6) {
    if (knowledgeBase.length === 0) return [];
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scored = knowledgeBase.map(item => {
        const text = item.text.toLowerCase();
        let score = 0;
        for (const word of queryWords) {
            const safeWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const matches = (text.match(new RegExp(safeWord, 'g')) || []).length;
            score += matches;
        }
        return { ...item, score };
    });
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Get all uploaded files info
app.get('/files', (req, res) => {
    res.json({
        files: uploadedFiles,
        totalSize: getTotalSize(),
        maxSize: MAX_TOTAL_BYTES,
        totalChunks: knowledgeBase.length
    });
});

// Remove a specific file from the knowledge base
app.delete('/files/:fileName', (req, res) => {
    const fileName = decodeURIComponent(req.params.fileName);
    const before = knowledgeBase.length;
    knowledgeBase = knowledgeBase.filter(item => item.fileName !== fileName);
    uploadedFiles = uploadedFiles.filter(f => f.fileName !== fileName);
    const removed = before - knowledgeBase.length;
    console.log(`Removed ${removed} chunks for: ${fileName}`);
    res.json({ message: `Removed "${fileName}" from knowledge base.` });
});

// Clear all documents
app.delete('/files', (req, res) => {
    knowledgeBase = [];
    uploadedFiles = [];
    console.log('Cleared all documents from knowledge base.');
    res.json({ message: 'All documents cleared.' });
});

// Upload a new document (ACCUMULATES — does not replace existing docs)
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file was received.' });
        }

        const filePath = req.file.path;
        const originalName = req.file.originalname;
        const fileSize = req.file.size;

        // Check if this file is already uploaded
        if (uploadedFiles.find(f => f.fileName === originalName)) {
            try { fs.unlinkSync(filePath); } catch (_) {}
            return res.status(400).json({ error: `"${originalName}" is already in your knowledge base. Remove it first if you want to re-upload.` });
        }

        // Check combined size limit
        if (getTotalSize() + fileSize > MAX_TOTAL_BYTES) {
            try { fs.unlinkSync(filePath); } catch (_) {}
            const usedMB = (getTotalSize() / 1024 / 1024).toFixed(1);
            return res.status(400).json({ error: `Storage full! You've used ${usedMB}MB of 200MB. Remove some documents first.` });
        }

        console.log(`Processing file: ${originalName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

        let text = '';
        if (originalName.toLowerCase().endsWith('.txt')) {
            text = fs.readFileSync(filePath, 'utf-8');
        } else {
            const dataBuffer = fs.readFileSync(filePath);
            const { text: extractedText } = await extractText(new Uint8Array(dataBuffer), { mergePages: true });
            text = extractedText;
        }

        if (!text || text.trim().length === 0) {
            try { fs.unlinkSync(filePath); } catch (_) {}
            throw new Error('Could not extract text. This might be a scanned/image-only PDF with no readable text.');
        }

        console.log(`Extracted ${text.length} characters. Chunking...`);
        const chunks = chunkText(text);

        // APPEND to knowledge base (do NOT clear existing docs)
        for (const chunk of chunks) {
            knowledgeBase.push({ text: chunk, fileName: originalName, fileSize });
        }

        uploadedFiles.push({
            fileName: originalName,
            size: fileSize,
            chunks: chunks.length,
            uploadedAt: new Date().toISOString()
        });

        // Clean up temp file (ignore Windows lock errors)
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}

        console.log(`Indexed ${chunks.length} chunks. Total knowledge base: ${knowledgeBase.length} chunks across ${uploadedFiles.length} file(s).`);

        res.json({
            message: `"${originalName}" is indexed and ready!`,
            fileName: originalName,
            chunks: chunks.length,
            totalFiles: uploadedFiles.length,
            totalChunks: knowledgeBase.length
        });

    } catch (error) {
        console.error("UPLOAD ERROR:", error.message);
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
        res.status(500).json({ error: error.message || 'Failed to process the file.' });
    }
});

// Chat
app.post('/chat', async (req, res) => {
    try {
        const { message, history } = req.body;

        let contextSection = '';
        if (knowledgeBase.length > 0) {
            const relevant = getRelevantChunks(message, 6);
            const contextText = relevant.map(r => `[From: ${r.fileName}]\n${r.text}`).join('\n\n---\n\n');
            const fileList = uploadedFiles.map(f => f.fileName).join(', ');
            contextSection = `\n\nDocuments in knowledge base: ${fileList}\n\nRelevant content:\n\n${contextText}\n\n`;
        } else {
            contextSection = '\n\n(No documents uploaded yet. Politely ask the user to upload one first.)\n\n';
        }

        const systemPrompt = `You are a chill, super-knowledgeable, and genuinely helpful friend.
Help the user understand their documents clearly and accurately.
Use casual, friendly language. Say things like "bro", "dude", "here you go", "no worries", "got you".
NEVER use the word "bestie". Keep it cool, direct, and helpful.
When referencing info, mention which document it came from naturally.
Base your answers strictly on the document context provided below. If the answer isn't in the documents, say so honestly.
${contextSection}`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...(history || [])
                .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                .map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: message }
        ];

        const chatCompletion = await groq.chat.completions.create({
            messages,
            model: MODEL,
            temperature: 0.7,
            max_tokens: 1500,
        });

        const reply = chatCompletion.choices[0]?.message?.content || "Hey, I couldn't generate a response. Try again!";
        res.json({ reply });

    } catch (error) {
        console.error("CHAT ERROR:", error.message);
        res.status(500).json({ reply: 'Something went wrong, dude! 😵 Error: ' + error.message });
    }
});

app.listen(port, () => {
    console.log(`Backend running at http://localhost:${port} — powered by Groq 🚀`);
});
