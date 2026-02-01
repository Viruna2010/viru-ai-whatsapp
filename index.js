const { default: makeWASocket, useMultiFileAuthState, Browsers, delay } = require("@whiskeysockets/baileys");
const axios = require("axios");
const pino = require("pino");
const express = require("express");
const QRCode = require('qrcode-terminal'); // QR එක පේන්න ඕනේ නිසා

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Viru-AI Bot is Running! 🚀"));
app.listen(port);

async function startViruBot() {
    // /tmp පාවිච්චි කරන්නේ Render එකේ RAM එක ඉතුරු කරන්න
    const { state, saveCreds } = await useMultiFileAuthState('/tmp/auth_info');
    const sessionString = process.env.SESSION_ID;

    if (sessionString) {
        try {
            state.creds = JSON.parse(Buffer.from(sessionString, 'base64').toString());
        } catch (e) { console.log("Session Load Error"); }
    }

    const sock = makeWASocket({
        auth: state,
        // QR එක logs වල පේන්න මේක true කළා
        printQRInTerminal: true, 
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Desktop"),
        shouldIgnoreOldMessages: true
    });

    // QR Code එක logs වල පෙන්වන තැන
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("\n📷 මෙන්න QR Code එක! මේක දැන්ම WhatsApp එකෙන් Scan කරපන්:");
            // QR එක Terminal එකේ ලස්සනට පෙන්වන්න
            QRCode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            console.log("Connection closed, reconnecting...");
            startViruBot();
        } else if (connection === 'open') {
            console.log("✅ Bot Connected Successfully!");
        }
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        const credsString = Buffer.from(JSON.stringify(state.creds)).toString('base64');
        console.log("\n🔥🔥 SESSION_ID (මේක Render එකේ සේව් කරපන්):\n", credsString);
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const userText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (userText) {
            try {
                const response = await axios.post('https://viru-ai-api.vercel.app/api/chat', { prompt: userText });
                const aiText = response.data.reply || response.data.response || response.data.message;
                await sock.sendMessage(msg.key.remoteJid, { text: aiText });
            } catch (error) { console.log("API Error"); }
        }
    });
}

startViruBot();
