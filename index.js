const { default: makeWASocket, useMultiFileAuthState, Browsers } = require("@whiskeysockets/baileys");
const axios = require("axios");
const pino = require("pino");
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Viru-AI Bot is Running! 🚀"));
app.listen(port, () => console.log(`Server listening on port ${port}`));

async function startViruBot() {
    const { state, saveCreds } = await useMultiFileAuthState('/tmp/auth_info');
    const sessionString = process.env.SESSION_ID;

    if (sessionString) {
        try {
            state.creds = JSON.parse(Buffer.from(sessionString, 'base64').toString());
        } catch (e) {
            console.log("Session ID Load Error");
        }
    }

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Desktop"),
        shouldIgnoreOldMessages: true
    });

    // 🚀 අලුත් අංකයට Pairing Code එක ඉල්ලීම
    if (!sock.authState.creds.registered) {
        const myNumber = "94765852011"; // 👈 අලුත් අංකය මෙතන තියෙනවා
        
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(myNumber);
                console.log("\n========================================");
                console.log("👉 YOUR WHATSAPP PAIRING CODE:", code);
                console.log("========================================\n");
            } catch (err) {
                console.log("Pairing Code Error: ", err.message);
            }
        }, 10000); // තත්පර 10ක් දුන්නා කනෙක්ෂන් එක හැදෙන්න
    }

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        const credsString = Buffer.from(JSON.stringify(state.creds)).toString('base64');
        console.log("\n🔥🔥 COPY THIS TO RENDER 'SESSION_ID' VARIABLE:\n", credsString);
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const userText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        const sender = msg.key.remoteJid;

        if (userText) {
            try {
                // Vercel AI API එකට යවනවා
                const response = await axios.post('https://viru-ai-api.vercel.app/api/chat', {
                    prompt: userText 
                });

                const aiText = response.data.reply || response.data.response || response.data.message || "No reply from AI";
                await sock.sendMessage(sender, { text: aiText });
            } catch (error) {
                console.log("API Error:", error.message);
            }
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'close') startViruBot();
    });
}

startViruBot();
