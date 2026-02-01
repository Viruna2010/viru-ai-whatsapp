const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const axios = require("axios");
const pino = require("pino");
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("Viru-AI Active! 🚀"));
app.listen(port);

async function startViruBot() {
    const { state, saveCreds } = await useMultiFileAuthState('/tmp/auth_info');
    const sessionString = process.env.SESSION_ID; // Render එකෙන් ID එක ගන්නවා

    if (sessionString) {
        try {
            // SESSION_ID එකෙන් කෙලින්ම WhatsApp එකට ලොග් වෙනවා
            state.creds = JSON.parse(Buffer.from(sessionString, 'base64').toString());
            console.log("✅ Bot Connected with Session ID!");
        } catch (e) { console.log("Session Error:", e.message); }
    }

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const userText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        
        if (userText) {
            try {
                // Vercel AI එකට මැසේජ් එක යවනවා
                const response = await axios.post('https://viru-ai-api.vercel.app/api/chat', { prompt: userText });
                const aiText = response.data.reply || response.data.response || response.data.message;
                await sock.sendMessage(msg.key.remoteJid, { text: aiText });
            } catch (error) { console.log("API Error"); }
        }
    });

    sock.ev.on('connection.update', (u) => { if (u.connection === 'close') startViruBot(); });
}
startViruBot();
