const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ==========================================
// 1. FIREBASE INITIALIZATION
// ==========================================
console.log('🔥 Initializing Firebase...');

const keyPath = path.join(__dirname, 'firebasekeys.json');

if (!fs.existsSync(keyPath)) {
    console.error('❌ FATAL: firebasekeys.json not found at:', keyPath);
    console.error('📌 Download a new service account key from Firebase Console');
    console.error('   → Project Settings → Service accounts → Generate new private key');
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    console.log(`📁 Key loaded: project="${serviceAccount.project_id}", email="${serviceAccount.client_email}"`);
} catch (e) {
    console.error('❌ FATAL: Failed to parse firebasekeys.json:', e.message);
    process.exit(1);
}

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
    });
    console.log('✅ Firebase initialized. Project:', admin.app().options.projectId);
} catch (e) {
    console.error('❌ FATAL: Firebase Admin initialization failed:', e.message);
    process.exit(1);
}

const db = admin.firestore();

// ==========================================
// 2. FIRESTORE HEALTH CHECK
// ==========================================
async function healthCheck() {
    try {
        const testRef = db.collection('settings').doc('ramadan');
        const doc = await testRef.get();
        if (doc.exists) {
            console.log('✅ Firestore connection OK! Settings:', JSON.stringify(doc.data()));
        } else {
            // Document doesn't exist yet — create default settings
            console.log('⚠️ Settings document not found. Creating default...');
            await testRef.set({
                startDate: '2026-02-18',
                endDate: '2026-03-20'
            });
            console.log('✅ Default settings created. Firestore connection OK!');
        }
        return true;
    } catch (e) {
        console.error('❌ Firestore Health Check FAILED:', e.message);
        console.error('🔍 Details:', e.code, e.details || '');
        if (e.code === 16 || e.code === 7) {
            console.error('');
            console.error('╔══════════════════════════════════════════════════╗');
            console.error('║  SERVICE ACCOUNT KEY YAROQSIZ!                  ║');
            console.error('║                                                  ║');
            console.error('║  Yechim:                                         ║');
            console.error('║  1. Firebase Console → Project Settings          ║');
            console.error('║  2. Service accounts → Generate new private key  ║');
            console.error('║  3. Yuklab olingan faylni firebasekeys.json      ║');
            console.error('║     nomi bilan bot-server/ papkasiga qo\'ying     ║');
            console.error('║  4. pm2 restart ramadan-bot                      ║');
            console.error('╚══════════════════════════════════════════════════╝');
            console.error('');
        }
        return false;
    }
}

// ==========================================
// 3. BOT SETUP
// ==========================================
const bot = new Telegraf(process.env.BOT_TOKEN);
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://robbit-ramadan.web.app';
const ADMIN_ID = 1398926724;

// Inline keyboard (message-based)
const mainInlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.webApp("📖 Kundalikni ochish", WEB_APP_URL)]
]);

// Persistent bottom menu (reply keyboard)
const menuKeyboard = Markup.keyboard([
    [Markup.button.webApp("📖 Kundalikni ochish", WEB_APP_URL)],
    ["🌙 Saharlik duosi", "✨ Iftorlik duosi"]
]).resize();

// Full menu with extra buttons
const fullMenuKeyboard = Markup.keyboard([
    ["📖 Kundalikni ochish"],
    ["🌙 Saharlik duosi", "✨ Iftorlik duosi"],
    ["✍️ Taklif va e'tirozlar", "ℹ️ Bot haqida"]
]).resize();

// ==========================================
// 4. BOT COMMANDS
// ==========================================

// Set commands list
bot.telegram.setMyCommands([
    { command: 'start', description: 'Botni ishga tushirish (yoki yangilash)' },
    { command: 'menu', description: 'Asosiy menyuni ko\'rsatish' },
    { command: 'status', description: 'Bot holatini tekshirish' }
]).then(() => console.log('📋 Bot commands updated.'))
    .catch(e => console.error('⚠️ Failed to set commands:', e.message));

// /start command
bot.start(async (ctx) => {
    try {
        const user = ctx.from;
        console.log(`📥 /start from: ${user.first_name} (${user.id})`);

        await db.collection('users').doc(user.id.toString()).set({
            id: user.id,
            first_name: user.first_name,
            username: user.username || null,
            joined_at: admin.firestore.FieldValue.serverTimestamp(),
            chat_id: ctx.chat.id
        }, { merge: true });

        // Step 1: Send "Bismillah!" with bottom menu
        await ctx.reply("Bismillah!", fullMenuKeyboard);

        // Step 2: Send welcome message with inline button
        await ctx.reply(
            `Assalomu alaykum, ${user.first_name}!\n\nRamazon kundaligiga xush kelibsiz. Bu bot orqali siz kundalik amallaringizni kuzatib borishingiz mumkin.`,
            mainInlineKeyboard
        );

        console.log(`✅ /start completed for: ${user.first_name} (${user.id})`);
    } catch (err) {
        console.error(`❌ /start error for ${ctx.from?.id}:`, err.message);
        try {
            await ctx.reply("⚠️ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring: /start");
        } catch (_) { }
    }
});

// /menu command
bot.command('menu', (ctx) => {
    ctx.reply("Asosiy menyu:", fullMenuKeyboard)
        .catch(e => console.error('menu error:', e.message));
});

// /status command
bot.command('status', (ctx) => {
    ctx.reply('Bot ishlamoqda! ✅', mainInlineKeyboard)
        .catch(e => console.error('status error:', e.message));
});

// ==========================================
// 5. TEXT HANDLERS
// ==========================================

// "📖 Kundalikni ochish" button handler
bot.hears("📖 Kundalikni ochish", (ctx) => {
    ctx.reply("Ramazon kundaligini ochish uchun quyidagi tugmani bosing:", mainInlineKeyboard)
        .catch(e => console.error('diary open error:', e.message));
});

// Saharlik duosi
bot.hears("🌙 Saharlik duosi", (ctx) => {
    ctx.reply(
        `🌙 *SAHARLIK DUOSI*\n\n` +
        `*Navaytu an asuma sovma shahri ramazona minal fajri ilal mag'ribi, xolisan lillahi ta'ala. Allohu akbar.*\n\n` +
        `_Ma'nosi:_ Ramazon oyining ro'zasini xolis Alloh uchun subhdan to kun botguncha tutmoqni niyat qildim. Alloh buyukdir.`,
        { parse_mode: 'Markdown' }
    ).catch(e => console.error('saharlik error:', e.message));
});

// Iftorlik duosi
bot.hears("✨ Iftorlik duosi", (ctx) => {
    ctx.reply(
        `✨ *IFTORLIK DUOSI*\n\n` +
        `*Allohumma laka sumtu va bika amantu va 'alayka tavakkaltu va 'ala rizqika aftartu, fag'firli ya g'offaru ma qoddamtu va ma axxortu.*\n\n` +
        `_Ma'nosi:_ Ey Alloh, ushbu ro'zamni Sen uchun tutdim va Senga iymon keltirdim va Senga tavakkal qildim va bergan rizqing bilan iftor qildim. Ey gunohlarni afv etuvchi Zot, mening avvalgi va keyingi gunohlarimni mag'firat qil.`,
        { parse_mode: 'Markdown' }
    ).catch(e => console.error('iftorlik error:', e.message));
});

// Taklif va e'tirozlar
bot.hears("✍️ Taklif va e'tirozlar", (ctx) => {
    ctx.reply("Marhamat, o'z taklif yoki e'tirozlaringizni yozib qoldiring. Sizning xabaringiz adminga yetkaziladi.")
        .catch(e => console.error('feedback prompt error:', e.message));
});

// Bot haqida
bot.hears("ℹ️ Bot haqida", (ctx) => {
    ctx.reply(
        `Ushbu bot [Ikrom Sharif](https://t.me/IkromSharif/6886) ustozni kanaliga joylangan Ramazon [jadval](https://t.me/IkromSharif/6886) asosida tayyorlandi.\n\n` +
        `Alloh ta'olo ushbu Ramazonni barchamizga barokatli qilsin, Alloh barchamizdan rozi bo'lsin. Omiyn!`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
    ).catch(e => console.error('about error:', e.message));
});

// ==========================================
// 6. FEEDBACK & ADMIN REPLY
// ==========================================
bot.on('message', async (ctx) => {
    try {
        const user = ctx.from;
        const text = ctx.message.text;
        if (!text) return; // Ignore non-text messages

        // Admin replies to forwarded feedback
        if (user.id === ADMIN_ID && ctx.message.reply_to_message) {
            const replyTo = ctx.message.reply_to_message;
            const feedbackRef = db.collection('feedback_map').doc(replyTo.message_id.toString());
            const doc = await feedbackRef.get();

            if (doc.exists) {
                const originalUser = doc.data();
                try {
                    await bot.telegram.sendMessage(originalUser.chat_id, `💌 *Admindan javob keldi:*\n\n${text}`, { parse_mode: 'Markdown' });
                    await ctx.reply("✅ Javobingiz foydalanuvchiga yuborildi.");
                } catch (err) {
                    console.error("Failed to push reply:", err.message);
                    await ctx.reply("❌ Xatolik: Foydalanuvchiga yuborish imkoni bo'lmadi.");
                }
                return;
            }
        }

        // Regular user feedback (skip commands and button texts)
        const knownTexts = ["📖 Kundalikni ochish", "🌙 Saharlik duosi", "✨ Iftorlik duosi", "✍️ Taklif va e'tirozlar", "ℹ️ Bot haqida"];
        const isCommand = text.startsWith('/') || knownTexts.includes(text);

        if (!isCommand) {
            try {
                const userInfo = `👤 *Kimdan:* ${user.first_name} ${user.last_name || ''}\n` +
                    `🆔 *ID:* ${user.id}\n` +
                    `🔗 *Username:* ${user.username ? '@' + user.username : 'yo\'q'}\n\n` +
                    `💬 *Xabar:* ${text}`;

                const forwardSent = await bot.telegram.sendMessage(ADMIN_ID, userInfo, { parse_mode: 'Markdown' });

                await db.collection('feedback_map').doc(forwardSent.message_id.toString()).set({
                    chat_id: ctx.chat.id,
                    user_id: user.id,
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });

                await ctx.reply("✅ Xabaringiz adminga yuborildi. Rahmat!");
            } catch (err) {
                console.error("Feedback error:", err.message);
            }
        }
    } catch (err) {
        console.error('Message handler error:', err.message);
    }
});

// ==========================================
// 7. TEST COMMANDS (admin only)
// ==========================================
bot.command('test_morning', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        ctx.reply("Saharlik xabarnomasi testi yuborilmoqda...");
        const userDoc = await db.collection('users').doc(ctx.from.id.toString()).get();
        if (userDoc.exists) {
            await bot.telegram.sendMessage(userDoc.data().chat_id,
                "🌙 TEST: Assalomu alaykum! Saharlik vaqti bo'ldi. Bugungi kuningiz xayrli va ibodatlarga boy bo'lsin.\n\nKundalikni to'ldirishni unutmang!",
                mainInlineKeyboard
            );
        }
    } catch (e) {
        console.error('test_morning error:', e.message);
    }
});

bot.command('test_evening', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
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
            await bot.telegram.sendMessage(userDoc.data().chat_id, statsMsg, { parse_mode: 'Markdown', ...mainInlineKeyboard });
        }
    } catch (e) {
        console.error('test_evening error:', e.message);
    }
});

// ==========================================
// 8. SCHEDULED NOTIFICATIONS
// ==========================================
cron.schedule('0 5 * * *', async () => {
    console.log('⏰ Sending morning reminders...');
    try {
        const usersSnapshot = await db.collection('users').get();
        let sent = 0, failed = 0;
        for (const doc of usersSnapshot.docs) {
            const user = doc.data();
            try {
                await bot.telegram.sendMessage(user.chat_id,
                    "🌙 Assalomu alaykum! Saharlik vaqti bo'ldi. Bugungi kuningiz xayrli va ibodatlarga boy bo'lsin.\n\nKundalikni to'ldirishni unutmang!",
                    mainInlineKeyboard
                );
                sent++;
            } catch (e) {
                console.error(`  ⚠️ Failed to send to ${user.id}:`, e.message);
                failed++;
            }
        }
        console.log(`  📊 Morning: sent=${sent}, failed=${failed}`);
    } catch (e) {
        console.error('Morning cron error:', e.message);
    }
}, { timezone: "Asia/Tashkent" });

cron.schedule('0 20 * * *', async () => {
    console.log('⏰ Sending evening report reminders...');
    try {
        const usersSnapshot = await db.collection('users').get();
        let sent = 0, failed = 0;
        for (const userDoc of usersSnapshot.docs) {
            const user = userDoc.data();
            try {
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
                await bot.telegram.sendMessage(user.chat_id, statsMsg, { parse_mode: 'Markdown', ...mainInlineKeyboard });
                sent++;
            } catch (e) {
                console.error(`  ⚠️ Failed to send to ${user.id}:`, e.message);
                failed++;
            }
        }
        console.log(`  📊 Evening: sent=${sent}, failed=${failed}`);
    } catch (e) {
        console.error('Evening cron error:', e.message);
    }
}, { timezone: "Asia/Tashkent" });

// ==========================================
// 9. BROADCAST LISTENER
// ==========================================
db.collection('broadcasts').where('status', '==', 'pending').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
            const broadcast = change.doc.data();
            const broadcastId = change.doc.id;
            const { target, message } = broadcast;

            console.log(`📢 Processing broadcast: ${broadcastId} for target: ${target}`);

            try {
                if (target === 'all') {
                    const usersSnapshot = await db.collection('users').get();
                    let sent = 0;
                    for (const userDoc of usersSnapshot.docs) {
                        const user = userDoc.data();
                        try {
                            await bot.telegram.sendMessage(user.chat_id, message, mainInlineKeyboard);
                            sent++;
                        } catch (e) {
                            console.error(`  ⚠️ Broadcast send failed for ${user.id}:`, e.message);
                        }
                    }
                    console.log(`  📊 Broadcast sent to ${sent} users`);
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
                console.log(`✅ Broadcast ${broadcastId} sent successfully.`);
            } catch (error) {
                console.error(`❌ Broadcast ${broadcastId} failed:`, error.message);
                await db.collection('broadcasts').doc(broadcastId).update({
                    status: 'error',
                    error: error.message
                }).catch(() => { });
            }
        }
    });
}, (error) => {
    console.error('❌ Broadcast listener error:', error.message);
});

// ==========================================
// 10. LAUNCH BOT
// ==========================================
async function startBot() {
    // Step 1: Health check
    const isHealthy = await healthCheck();
    if (!isHealthy) {
        console.error('❌ Firestore health check failed. Bot will NOT start.');
        console.error('🔧 Fix the service account key and restart.');
        process.exit(1);
    }

    // Step 2: Launch bot with retry
    console.log('🚀 Launching bot...');
    try {
        await bot.launch();
        console.log('');
        console.log('╔══════════════════════════════════════╗');
        console.log('║   🤖 Bot is running! ✅              ║');
        console.log('║   📊 Project: ' + (admin.app().options.projectId || '').padEnd(22) + '║');
        console.log('╚══════════════════════════════════════╝');
        console.log('');
    } catch (err) {
        console.error('❌ Bot launch failed!', err.message);
        if (err.message && err.message.includes('409')) {
            console.error('');
            console.error('╔══════════════════════════════════════════════════╗');
            console.error('║  BOSHQA BOT INSTANSIYA ALLAQACHON ISHLAYAPTI!   ║');
            console.error('║                                                  ║');
            console.error('║  Yechim (serverdagi):                            ║');
            console.error('║  1. pm2 stop all                                 ║');
            console.error('║  2. pm2 delete all                               ║');
            console.error('║  3. pm2 start index.js --name ramadan-bot        ║');
            console.error('║                                                  ║');
            console.error('║  Yechim (lokaldagi):                             ║');
            console.error('║  1. taskkill /F /IM node.exe                     ║');
            console.error('║  2. node index.js                                ║');
            console.error('╚══════════════════════════════════════════════════╝');
        }
        process.exit(1);
    }
}

startBot();

// Graceful stop
process.once('SIGINT', () => { console.log('🛑 SIGINT received'); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { console.log('🛑 SIGTERM received'); bot.stop('SIGTERM'); });
