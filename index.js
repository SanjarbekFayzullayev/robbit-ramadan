const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const cron = require('node-cron');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin
console.log('Initializing Firebase...');

const possibleKeys = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.join(__dirname, 'firebasekeys.json'),
    path.join(__dirname, 'serviceAccountKey.json'),
    path.join(__dirname, '..', 'firebasekeys.json'),
    path.join(__dirname, '..', 'serviceAccountKey.json')
];

let initialized = false;
for (const keyPath of possibleKeys) {
    if (keyPath && require('fs').existsSync(keyPath)) {
        console.log(`Using credentials from: ${keyPath}`);
        try {
            const serviceAccount = require(keyPath);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id
            });
            initialized = true;
            break;
        } catch (e) {
            console.error(`Failed to load key from ${keyPath}:`, e.message);
        }
    }
}

if (!initialized) {
    console.log('No specific key file found, attempting default initialization...');
    try {
        admin.initializeApp();
        initialized = true;
    } catch (e) {
        console.error("Firebase Admin initialization failed completely!");
        process.exit(1);
    }
}

console.log('Firebase initialized. Project ID:', admin.app().options.projectId);
const db = admin.firestore();
const bot = new Telegraf(process.env.BOT_TOKEN);

const WEB_APP_URL = process.env.WEB_APP_URL || 'https://robbit-ramadan.web.app';
const ADMIN_ID = 1398926724;

// Helper for Inline Keyboard (Message-based)
const mainInlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.webApp("📖 Kundalikni ochish", WEB_APP_URL)]
]);

// Helper for Persistent Bottom Menu (Reply Keyboard)
const menuReplyMarkup = Markup.keyboard([
    [Markup.button.webApp("📖 Kundalikni ochish", WEB_APP_URL)], // DIRECT WEB APP OPEN
    ["🌙 Saharlik duosi", "✨ Iftorlik duosi"]
]).resize();

// Set Bot Commands
bot.telegram.setMyCommands([
    { command: 'start', description: 'Botni ishga tushirish (yoki yangilash)' },
    { command: 'menu', description: 'Asosiy menyuni ko\'rsatish' },
    { command: 'status', description: 'Bot holatini tekshirish' }
]).then(() => console.log('Bot commands updated.')).catch(e => console.error('Failed to set commands:', e));

// 1. Bot Commands
bot.start(async (ctx) => {
    const user = ctx.from;

    await db.collection('users').doc(user.id.toString()).set({
        id: user.id,
        first_name: user.first_name,
        username: user.username,
        joined_at: admin.firestore.FieldValue.serverTimestamp(),
        chat_id: ctx.chat.id
    }, { merge: true });

    // Step 1: Send "Bismillah!" with the Expanded Persistent Bottom Menu
    await ctx.reply("Bismillah!",
        Markup.keyboard([
            ["📖 Kundalikni ochish"],
            ["🌙 Saharlik duosi", "✨ Iftorlik duosi"],
            ["✍️ Taklif va e’tirozlar", "ℹ️ Bot haqida"]
        ]).resize()
    );

    // Step 2: Send the main Welcome Message with Inline Button
    await ctx.reply(
        `Assalomu alaykum, ${user.first_name}!\n\nRamazon kundaligiga xush kelibsiz. Bu bot orqali siz kundalik amallaringizni kuzatib borishingiz mumkin.`,
        mainInlineKeyboard
    );
});

// Handler for the text-based "📖 Kundalikni ochish" button
bot.hears("📖 Kundalikni ochish", (ctx) => {
    ctx.reply("Ramazon kundaligini ochish uchun quyidagi tugmani bosing:", mainInlineKeyboard);
});

// "✍️ Taklif va e’tirozlar" Handler
bot.hears("✍️ Taklif va e’tirozlar", (ctx) => {
    ctx.reply("Marhamat, o‘z taklif yoki e’tirozlaringizni yozib qoldiring. Sizning xabaringiz adminga yetkaziladi.");
});

// "ℹ️ Bot haqida" Handler
bot.hears("ℹ️ Bot haqida", (ctx) => {
    ctx.reply(
        `Ushbu bot [Ikrom Sharif](https://t.me/IkromSharif/6886) ustozni kanaliga joylangan Ramazon [jadval](https://t.me/IkromSharif/6886) asosida tayyorlandi.\n\n` +
        `Alloh ta'olo ushbu Ramazonni barchamizga barokatli qilsin, Alloh barchamizdan rozi bo‘lsin. Omiyn!`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
});

// Dua Menu Handlers
bot.hears("🌙 Saharlik duosi", (ctx) => {
    ctx.reply(
        `🌙 *SAHARLIK DUOSI*\n\n` +
        `*Navaytu an asuma sovma shahri ramazona minal fajri ilal mag‘ribi, xolisan lillahi ta’ala. Allohu akbar.*\n\n` +
        `_Ma'nosi:_ Ramazon oyining ro‘zasini xolis Alloh uchun subhdan to kun botguncha tutmoqni niyat qildim. Alloh buyukdir.`,
        { parse_mode: 'Markdown' }
    );
});

bot.hears("✨ Iftorlik duosi", (ctx) => {
    ctx.reply(
        `✨ *IFTORLIK DUOSI*\n\n` +
        `*Allohumma laka sumtu va bika amantu va ‘alayka tavakkaltu va ‘ala rizqika aftartu, fag‘firli ya g‘offaru ma qoddamtu va ma axxortu.*\n\n` +
        `_Ma'nosi:_ Ey Alloh, ushbu ro‘zamni Sen uchun tutdim va Senga iymon keltirdim va Senga tavakkal qildim va bergan rizqing bilan iftor qildim. Ey gunohlarni afv etuvchi Zot, mening avvalgi va keyingi gunohlarimni mag‘firat qil.`,
        { parse_mode: 'Markdown' }
    );
});

// Menu Command to explicitly show the keyboard
bot.command('menu', (ctx) => {
    ctx.reply("Asosiy menyu:", Markup.keyboard([
        ["📖 Kundalikni ochish"],
        ["🌙 Saharlik duosi", "✨ Iftorlik duosi"],
        ["✍️ Taklif va e’tirozlar", "ℹ️ Bot haqida"]
    ]).resize());
});

// --- Feedback & Admin Reply Logic ---
bot.on('message', async (ctx) => {
    const user = ctx.from;
    const text = ctx.message.text;

    // 1. If Admin replies to a forwarded feedback message
    if (user.id === ADMIN_ID && ctx.message.reply_to_message) {
        const replyTo = ctx.message.reply_to_message;

        // Find the original user in Firestore mapping
        const feedbackRef = db.collection('feedback_map').doc(replyTo.message_id.toString());
        const doc = await feedbackRef.get();

        if (doc.exists) {
            const originalUser = doc.data();
            try {
                await bot.telegram.sendMessage(originalUser.chat_id, `💌 *Admindan javob keldi:*\n\n${text}`, { parse_mode: 'Markdown' });
                await ctx.reply("✅ Javobingiz foydalanuvchiga yuborildi.");
            } catch (err) {
                console.error("Failed to push reply:", err);
                await ctx.reply("❌ Xatolik: Foydalanuvchiga yuborish imkoni bo'lmadi.");
            }
            return;
        }
    }

    // 2. If it's a regular user sending feedback (and not a command)
    const isCommand = text && (text.startsWith('/') || ["📖 Kundalikni ochish", "🌙 Saharlik duosi", "✨ Iftorlik duosi", "✍️ Taklif va e’tirozlar"].includes(text));

    if (text && !isCommand) {
        try {
            // Forward to admin with user info
            const userInfo = `👤 *Kimdan:* ${user.first_name} ${user.last_name || ''}\n` +
                `🆔 *ID:* ${user.id}\n` +
                `🔗 *Username:* ${user.username ? '@' + user.username : 'yo\'q'}\n\n` +
                `💬 *Xabar:* ${text}`;

            const forwardSent = await bot.telegram.sendMessage(ADMIN_ID, userInfo, { parse_mode: 'Markdown' });

            // Store mapping for admin to reply later
            await db.collection('feedback_map').doc(forwardSent.message_id.toString()).set({
                chat_id: ctx.chat.id,
                user_id: user.id,
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            await ctx.reply("✅ Xabaringiz adminga yuborildi. Rahmat!");
        } catch (err) {
            console.error("Feedback error:", err);
        }
    }
});

// 2. Test Commands
bot.command('status', (ctx) => ctx.reply('Bot ishlamoqda! ✅', mainInlineKeyboard));

bot.command('test_morning', async (ctx) => {
    ctx.reply("Saharlik xabarnomasi testi yuborilmoqda...");
    const userDoc = await db.collection('users').doc(ctx.from.id.toString()).get();
    if (userDoc.exists) {
        bot.telegram.sendMessage(userDoc.data().chat_id,
            "🌙 TEST: Assalomu alaykum! Saharlik vaqti bo'ldi. Bugungi kuningiz xayrli va ibodatlarga boy bo'lsin.\n\nKundalikni to'ldirishni unutmang!",
            mainInlineKeyboard
        );
    }
});

bot.command('test_evening', async (ctx) => {
    ctx.reply("Kechki hisobot xabarnomasi testi yuborilmoqda...");
    const userId = ctx.from.id.toString();
    const userDoc = await db.collection('users').doc(userId).get();
    const diaryDoc = await db.collection('user_data').doc(userId).get();

    if (userDoc.exists) {
        let statsMsg = "✨ TEST: Kun yakunlandi. Bugungi amallaringizni sarhisob qilish vaqti keldi.\n\n";
        if (diaryDoc.exists) {
            const data = diaryDoc.data().day1;
            if (data) {
                const goodDone = data.good.filter(v => v).length;
                const badDone = data.bad.filter(v => v).length;
                statsMsg += `📊 *Bugungi natijangiz (1-kun):*\n✅ Yaxshiliklar: ${goodDone} / 25\n⚠️ Kamchiliklar: ${badDone} / 25\n\n`;
            }
        }
        statsMsg += "Kundalikni to'ldirib, o'zingizni hisob-kitob qiling.";
        bot.telegram.sendMessage(userDoc.data().chat_id, statsMsg, { parse_mode: 'Markdown', ...mainInlineKeyboard });
    }
});

// 3. Scheduled Notifications
cron.schedule('0 5 * * *', async () => {
    console.log('Sending morning reminders...');
    const usersSnapshot = await db.collection('users').get();
    usersSnapshot.forEach(doc => {
        const user = doc.data();
        bot.telegram.sendMessage(user.chat_id,
            "🌙 Assalomu alaykum! Saharlik vaqti bo'ldi. Bugungi kuningiz xayrli va ibodatlarga boy bo'lsin.\n\nKundalikni to'ldirishni unutmang!",
            mainInlineKeyboard
        ).catch(e => console.error(`Error sending to ${user.id}:`, e.message));
    });
}, { timezone: "Asia/Tashkent" });

cron.schedule('0 20 * * *', async () => {
    console.log('Sending evening report reminders...');
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
        const user = userDoc.data();
        const diaryDoc = await db.collection('user_data').doc(user.id.toString()).get();
        let statsMsg = "✨ Kun yakunlandi. Bugungi amallaringizni sarhisob qilish vaqti keldi.\n\n";
        if (diaryDoc.exists) {
            const data = diaryDoc.data().day1;
            if (data) {
                const goodDone = data.good.filter(v => v).length;
                const badDone = data.bad.filter(v => v).length;
                statsMsg += `📊 *Bugungi natijangiz (1-kun):*\n✅ Yaxshiliklar: ${goodDone} / 25\n⚠️ Kamchiliklar: ${badDone} / 25\n\n`;
            }
        }
        statsMsg += "Kundalikni to'ldirib, o'zingizni hisob-kitob qiling.";
        bot.telegram.sendMessage(user.chat_id, statsMsg, { parse_mode: 'Markdown', ...mainInlineKeyboard })
            .catch(e => console.error(`Error sending to ${user.id}:`, e.message));
    }
}, { timezone: "Asia/Tashkent" });

// 4. Broadcast Listener
db.collection('broadcasts').where('status', '==', 'pending').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
            const broadcast = change.doc.data();
            const broadcastId = change.doc.id;
            const { target, message } = broadcast;

            console.log(`Processing broadcast: ${broadcastId} for target: ${target}`);

            try {
                if (target === 'all') {
                    const usersSnapshot = await db.collection('users').get();
                    for (const userDoc of usersSnapshot.docs) {
                        const user = userDoc.data();
                        await bot.telegram.sendMessage(user.chat_id, message, mainInlineKeyboard);
                    }
                } else {
                    const userDoc = await db.collection('users').doc(target).get();
                    if (userDoc.exists) {
                        await bot.telegram.sendMessage(userDoc.data().chat_id, message, mainInlineKeyboard);
                    }
                }

                await db.collection('broadcasts').doc(broadcastId).update({
                    status: 'sent',
                    sent_at: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Broadcast ${broadcastId} sent successfully.`);
            } catch (error) {
                console.error(`Broadcast ${broadcastId} failed:`, error.message);
                await db.collection('broadcasts').doc(broadcastId).update({
                    status: 'error',
                    error: error.message
                });
            }
        }
    });
});

console.log('Launching bot...');
bot.launch().then(() => {
    console.log('Bot is running! ✅');
}).catch(err => {
    console.error('Bot launch failed! ❌', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));


