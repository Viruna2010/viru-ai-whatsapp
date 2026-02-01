const { default: makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const axios = require("axios");
const pino = require("pino");
const express = require("express");

const app = express();
const port = process.env.PORT || 3000;

// Render එක ලයිව් තියාගන්න පාවිච්චි කරන Route එක
app.get("/", (req, res) => res.send("Viru-AI Bot is Active! 🚀"));
app.listen(port, () => console.log(`Server is running on port ${port}`));

async function startViruBot() {
    // Render Environment Variables වලින් Session එක ගන්නවා (Restart වුණාම ලොගින් වෙන්න ඕනේ නැති වෙන්න)
    const sessionString = process.env.SESSION_ID;
    const { state, saveCreds } = await useMultiFileAuthState('/tmp/auth_info');

    // පරණ Session එකක් තිබුණොත් ඒක ලෝඩ් කරනවා
    if (sessionString) {
        try {
            const creds = JSON.parse(Buffer.from(sessionString, 'base64').toString());
            state.creds = creds;
        } catch (e) {
            console.log("Session ID Error:", e);
        }
    }

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: "fatal" }),
        browser: ["Viru-AI", "Chrome", "1.0.0"]
    });

    // 1. WhatsApp අංකය ලින්ක් කිරීම (Pairing Code)
    if (!sock.authState.creds.registered) {
        const myNumber = "94788120118"; // 👈 උඹේ අංකය මෙතන තියෙනවා
        
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(myNumber);
                console.log("\n========================================");
                console.log("👉 YOUR WHATSAPP PAIRING CODE:", code);
                console.log("========================================\n");
            } catch (err) {
                console.log("Pairing Code Error:", err);
            }
        }, 5000);
    }

    // 2. ලොග් වුණාම Session String එක Logs වල පෙන්වනවා
    sock.ev.on('creds.update', async () => {
        await saveCreds();
        const credsString = Buffer.from(JSON.stringify(state.creds)).toString('base64');
        console.log("\n🔥🔥 COPY THIS TO RENDER 'SESSION_ID' VARIABLE:\n", credsString);
    });

    // 3. මැසේජ් එකක් ආවම API එකට යැවීම
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const userText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        const sender = msg.key.remoteJid;

        if (userText) {
            try {
                // 🚀 උඹේ Vercel AI API එකට මැසේජ් එක යවනවා
                const response = await axios.post('https://viru-ai-api.vercel.app/api/chat', {
                    prompt: userText 
                });

                // API එකෙන් එන Reply එක ගන්නවා
                const aiText = response.data.reply || response.data.response || response.data.message || "සොරි මචං, මට රිප්ලයි එකක් ගන්න බැරි වුණා.";
                
                // ✅ WhatsApp එකට AI රිප්ලයි එක යවනවා
                await sock.sendMessage(sender, { text: aiText });
            } catch (error) {
                console.log("API Error:", error.message);
            }
        }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'close') startViruBot(); // Connection එක කැපුණොත් ආයේ පටන් ගන්නවා
    });
}

startViruBot();
