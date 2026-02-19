const { Telegraf, Markup } = require('telegraf');
const admin = require('firebase-admin');
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
    process.exit(1);
}

let serviceAccount;
try {
    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    console.log(`📁 Key loaded: project="${serviceAccount.project_id}"`);
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
const bot = new Telegraf(process.env.BOT_TOKEN);
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://robbit-ramadan.web.app';
const ADMIN_ID = 1398926724;

// ==========================================
// 2. DYNAMIC STATE (from Firestore)
// ==========================================
let dynamicButtons = [];
let notificationSettings = {
    morning: { enabled: true, hour: 5, minute: 0, message: "🌙 Assalomu alaykum! Saharlik vaqti bo'ldi. Bugungi kuningiz xayrli va ibodatlarga boy bo'lsin.\n\nKundalikni to'ldirishni unutmang!" },
    evening: { enabled: true, hour: 20, minute: 0, message: "✨ Kun yakunlandi. Bugungi amallaringizni sarhisob qilish vaqti keldi.\n\nKundalikni to'ldirib, o'zingizni hisob-kitob qiling." }
};
let dailyContent = {}; // { "1": { text: "...", type: "hadith" }, ... }
let lastMorningSent = null;
let lastEveningSent = null;

// Inline keyboard (message-based)
const mainInlineKeyboard = Markup.inlineKeyboard([
    [Markup.button.webApp("📖 Kundalikni ochish", WEB_APP_URL)]
]);

// Build dynamic reply keyboard from Firestore buttons
function buildReplyKeyboard() {
    if (dynamicButtons.length === 0) {
        // Default fallback
        return Markup.keyboard([
            [Markup.button.webApp("📖 Kundalikni ochish", WEB_APP_URL)],
            ["🌙 Saharlik duosi", "✨ Iftorlik duosi"],
            ["✍️ Taklif va e'tirozlar", "ℹ️ Bot haqida"]
        ]).resize();
    }

    const rows = [];
    let currentRow = [];

    for (const btn of dynamicButtons) {
        if (btn.type === 'webapp') {
            // WebApp buttons must be alone in a row
            if (currentRow.length > 0) {
                rows.push(currentRow);
                currentRow = [];
            }
            rows.push([Markup.button.webApp(btn.text, btn.url || WEB_APP_URL)]);
        } else {
            currentRow.push(btn.text);
            if (currentRow.length >= 2) {
                rows.push(currentRow);
                currentRow = [];
            }
        }
    }
    if (currentRow.length > 0) rows.push(currentRow);

    return Markup.keyboard(rows).resize();
}

// ==========================================
// 3. FIRESTORE LISTENERS (Real-time)
// ==========================================

// Listen for button changes
db.collection('settings').doc('buttons').onSnapshot(snap => {
    if (snap.exists) {
        const data = snap.data();
        dynamicButtons = data.buttons || [];
        console.log(`🔄 Buttons updated: ${dynamicButtons.length} buttons`);
    } else {
        // Create default buttons
        const defaultButtons = [
            { text: "📖 Kundalikni ochish", type: "webapp", url: WEB_APP_URL },
            { text: "🌙 Saharlik duosi", type: "text" },
            { text: "✨ Iftorlik duosi", type: "text" },
            { text: "✍️ Taklif va e'tirozlar", type: "text" },
            { text: "ℹ️ Bot haqida", type: "text" }
        ];
        db.collection('settings').doc('buttons').set({ buttons: defaultButtons })
            .then(() => console.log('📋 Default buttons created'))
            .catch(e => console.error('Default buttons error:', e.message));
    }
}, err => console.error('Buttons listener error:', err.message));

// Listen for notification settings
db.collection('settings').doc('notifications').onSnapshot(snap => {
    if (snap.exists) {
        const data = snap.data();
        if (data.morning) notificationSettings.morning = { ...notificationSettings.morning, ...data.morning };
        if (data.evening) notificationSettings.evening = { ...notificationSettings.evening, ...data.evening };
        console.log(`🔄 Notifications updated: morning=${notificationSettings.morning.hour}:${String(notificationSettings.morning.minute).padStart(2, '0')}, evening=${notificationSettings.evening.hour}:${String(notificationSettings.evening.minute).padStart(2, '0')}`);
    } else {
        // Create default notification settings
        db.collection('settings').doc('notifications').set(notificationSettings)
            .then(() => console.log('⏰ Default notification settings created'))
            .catch(e => console.error('Default notifications error:', e.message));
    }
}, err => console.error('Notifications listener error:', err.message));

// Listen for daily content
db.collection('daily_content').onSnapshot(snap => {
    dailyContent = {};
    snap.forEach(doc => {
        dailyContent[doc.id] = doc.data();
    });
    console.log(`🔄 Daily content loaded: ${Object.keys(dailyContent).length} items`);
}, err => console.error('Daily content listener error:', err.message));

// ==========================================
// 4. HEALTH CHECK
// ==========================================
async function healthCheck() {
    try {
        const testRef = db.collection('settings').doc('ramadan');
        const doc = await testRef.get();
        if (!doc.exists) {
            await testRef.set({ startDate: '2026-02-18', endDate: '2026-03-20' });
            console.log('✅ Default ramadan settings created.');
        }
        console.log('✅ Firestore connection OK!');
        return true;
    } catch (e) {
        console.error('❌ Firestore Health Check FAILED:', e.message);
        if (e.code === 16 || e.code === 7) {
            console.error('🔑 Service account key yaroqsiz! Yangi key yarating.');
        }
        return false;
    }
}

// ==========================================
// 5. HELPER: Get current Ramadan day
// ==========================================
function getCurrentRamadanDay(startDate) {
    const now = new Date();
    const start = new Date(startDate);
    const diffTime = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.min(30, diffDays));
}

// ==========================================
// 6. BOT COMMANDS
// ==========================================

bot.telegram.setMyCommands([
    { command: 'start', description: 'Botni ishga tushirish' },
    { command: 'menu', description: 'Asosiy menyuni ko\'rsatish' },
    { command: 'status', description: 'Bot holatini tekshirish' },
    { command: 'hadis', description: 'Bugungi hadis/duo' },
    { command: 'streak', description: 'Ketma-ketlik hisobingiz' }
]).then(() => console.log('📋 Bot commands updated.'))
    .catch(e => console.error('⚠️ Failed to set commands:', e.message));

// /start
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

        // Send "Bismillah!" with dynamic keyboard
        await ctx.reply("Bismillah!", buildReplyKeyboard());

        // Welcome message with inline button
        await ctx.reply(
            `Assalomu alaykum, ${user.first_name}!\n\nRamazon kundaligiga xush kelibsiz. Bu bot orqali siz kundalik amallaringizni kuzatib borishingiz mumkin.`,
            mainInlineKeyboard
        );

        console.log(`✅ /start completed for: ${user.first_name} (${user.id})`);
    } catch (err) {
        console.error(`❌ /start error for ${ctx.from?.id}:`, err.message);
        try { await ctx.reply("⚠️ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring: /start"); } catch (_) { }
    }
});

// /menu
bot.command('menu', (ctx) => {
    ctx.reply("Asosiy menyu:", buildReplyKeyboard())
        .catch(e => console.error('menu error:', e.message));
});

// /status
bot.command('status', (ctx) => {
    ctx.reply('Bot ishlamoqda! ✅', mainInlineKeyboard)
        .catch(e => console.error('status error:', e.message));
});

// /hadis — show today's hadith
bot.command('hadis', async (ctx) => {
    try {
        const settingsDoc = await db.collection('settings').doc('ramadan').get();
        const startDate = settingsDoc.exists ? settingsDoc.data().startDate : '2026-02-18';
        const day = getCurrentRamadanDay(startDate);
        const content = dailyContent[day.toString()];

        if (content && content.text) {
            await ctx.reply(
                `📖 *${day}-kun ${content.type === 'hadith' ? 'hadisi' : 'duosi'}:*\n\n${content.text}`,
                { parse_mode: 'Markdown' }
            );
        } else {
            await ctx.reply(`📖 Bugun (${day}-kun) uchun maxsus kontent hali qo'shilmagan.`);
        }
    } catch (e) {
        console.error('hadis error:', e.message);
        ctx.reply("⚠️ Xatolik yuz berdi.").catch(() => { });
    }
});

// /streak — show user's streak
bot.command('streak', async (ctx) => {
    try {
        const userId = ctx.from.id.toString();
        const userDataDoc = await db.collection('user_data').doc(userId).get();

        if (!userDataDoc.exists) {
            await ctx.reply("📊 Siz hali kundalikni to'ldirishni boshlamadingiz. /start buyrug'ini yuboring.");
            return;
        }

        const data = userDataDoc.data();
        let streak = 0;
        let totalDays = 0;
        let totalGood = 0;
        let totalBad = 0;

        // Count filled days and calculate streak
        for (let i = 30; i >= 1; i--) {
            const dayData = data[`day${i}`];
            if (dayData) {
                const goodCount = (dayData.good || []).filter(v => v).length;
                const badCount = (dayData.bad || []).filter(v => v).length;
                if (goodCount > 0 || badCount > 0) {
                    totalDays++;
                    totalGood += goodCount;
                    totalBad += badCount;
                }
            }
        }

        // Calculate consecutive streak from latest day
        const settingsDoc = await db.collection('settings').doc('ramadan').get();
        const startDate = settingsDoc.exists ? settingsDoc.data().startDate : '2026-02-18';
        const currentDay = getCurrentRamadanDay(startDate);

        for (let i = currentDay; i >= 1; i--) {
            const dayData = data[`day${i}`];
            if (dayData) {
                const goodCount = (dayData.good || []).filter(v => v).length;
                if (goodCount > 0) {
                    streak++;
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        const progressPercent = totalDays > 0 ? Math.round((totalGood / (totalDays * 25)) * 100) : 0;

        let msg = `🔥 *Sizning natijalaringiz:*\n\n`;
        msg += `📅 To'ldirilgan kunlar: *${totalDays}*\n`;
        msg += `🔥 Ketma-ketlik (streak): *${streak} kun*\n`;
        msg += `✅ Jami yaxshiliklar: *${totalGood}*\n`;
        msg += `⚠️ Jami kamchiliklar: *${totalBad}*\n`;
        msg += `📊 Umumiy progress: *${progressPercent}%*\n\n`;

        if (streak >= 7) msg += `🏆 Barakallo! Ajoyib natija!`;
        else if (streak >= 3) msg += `💪 Yaxshi ketayapsiz! Davom eting!`;
        else msg += `🌱 Har bir kun yangi imkoniyat. Davom eting!`;

        await ctx.reply(msg, { parse_mode: 'Markdown' });
    } catch (e) {
        console.error('streak error:', e.message);
        ctx.reply("⚠️ Xatolik yuz berdi.").catch(() => { });
    }
});

// ==========================================
// 7. TEXT HANDLERS
// ==========================================

// Static text handlers (always available even with dynamic buttons)
bot.hears("📖 Kundalikni ochish", (ctx) => {
    ctx.reply("Ramazon kundaligini ochish uchun quyidagi tugmani bosing:", mainInlineKeyboard)
        .catch(e => console.error('diary error:', e.message));
});

bot.hears("🌙 Saharlik duosi", (ctx) => {
    ctx.reply(
        `🌙 *SAHARLIK DUOSI*\n\n*Navaytu an asuma sovma shahri ramazona minal fajri ilal mag'ribi, xolisan lillahi ta'ala. Allohu akbar.*\n\n_Ma'nosi:_ Ramazon oyining ro'zasini xolis Alloh uchun subhdan to kun botguncha tutmoqni niyat qildim. Alloh buyukdir.`,
        { parse_mode: 'Markdown' }
    ).catch(e => console.error('saharlik error:', e.message));
});

bot.hears("✨ Iftorlik duosi", (ctx) => {
    ctx.reply(
        `✨ *IFTORLIK DUOSI*\n\n*Allohumma laka sumtu va bika amantu va 'alayka tavakkaltu va 'ala rizqika aftartu, fag'firli ya g'offaru ma qoddamtu va ma axxortu.*\n\n_Ma'nosi:_ Ey Alloh, ushbu ro'zamni Sen uchun tutdim va Senga iymon keltirdim va Senga tavakkal qildim va bergan rizqing bilan iftor qildim. Ey gunohlarni afv etuvchi Zot, mening avvalgi va keyingi gunohlarimni mag'firat qil.`,
        { parse_mode: 'Markdown' }
    ).catch(e => console.error('iftorlik error:', e.message));
});

bot.hears("✍️ Taklif va e'tirozlar", (ctx) => {
    ctx.reply("Marhamat, o'z taklif yoki e'tirozlaringizni yozib qoldiring. Sizning xabaringiz adminga yetkaziladi.")
        .catch(e => console.error('feedback prompt error:', e.message));
});

bot.hears("ℹ️ Bot haqida", (ctx) => {
    ctx.reply(
        `Ushbu bot [Ikrom Sharif](https://t.me/IkromSharif/6886) ustozni kanaliga joylangan Ramazon [jadval](https://t.me/IkromSharif/6886) asosida tayyorlandi.\n\nAlloh ta'olo ushbu Ramazonni barchamizga barokatli qilsin, Alloh barchamizdan rozi bo'lsin. Omiyn!`,
        { parse_mode: 'Markdown', disable_web_page_preview: true }
    ).catch(e => console.error('about error:', e.message));
});

// ==========================================
// 8. DYNAMIC BUTTON HANDLER (URL type)
// ==========================================
// Handle dynamic URL buttons — they send text, we respond with the URL
bot.on('text', async (ctx, next) => {
    const text = ctx.message.text;

    // Check if it matches a dynamic URL button
    const urlButton = dynamicButtons.find(b => b.type === 'url' && b.text === text);
    if (urlButton && urlButton.url) {
        try {
            await ctx.reply(
                `🔗 ${urlButton.text}`,
                Markup.inlineKeyboard([
                    [Markup.button.url(urlButton.text, urlButton.url)]
                ])
            );
        } catch (e) {
            console.error('Dynamic URL button error:', e.message);
        }
        return;
    }

    // Check if it matches a dynamic text button with custom response
    const textButton = dynamicButtons.find(b => b.type === 'text_custom' && b.text === text);
    if (textButton && textButton.response) {
        try {
            await ctx.reply(textButton.response, { parse_mode: 'Markdown' });
        } catch (e) {
            console.error('Dynamic text button error:', e.message);
        }
        return;
    }

    return next();
});

// ==========================================
// 9. FEEDBACK & ADMIN REPLY
// ==========================================
bot.on('message', async (ctx) => {
    try {
        const user = ctx.from;
        const text = ctx.message.text;
        if (!text) return;

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

        // Regular user feedback
        const knownTexts = ["📖 Kundalikni ochish", "🌙 Saharlik duosi", "✨ Iftorlik duosi", "✍️ Taklif va e'tirozlar", "ℹ️ Bot haqida"];
        const dynamicTexts = dynamicButtons.map(b => b.text);
        const allKnown = [...knownTexts, ...dynamicTexts];
        const isCommand = text.startsWith('/') || allKnown.includes(text);

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
// 10. NOTIFICATION SCHEDULER (interval-based)
// ==========================================
async function sendNotification(type) {
    const settings = notificationSettings[type];
    if (!settings || !settings.enabled) return;

    console.log(`📢 Sending ${type} notification...`);
    try {
        const usersSnapshot = await db.collection('users').get();
        let sent = 0, failed = 0;

        // Get daily hadith to include
        let hadithText = '';
        try {
            const settingsDoc = await db.collection('settings').doc('ramadan').get();
            const startDate = settingsDoc.exists ? settingsDoc.data().startDate : '2026-02-18';
            const day = getCurrentRamadanDay(startDate);
            const content = dailyContent[day.toString()];
            if (content && content.text) {
                hadithText = `\n\n📖 *${day}-kun ${content.type === 'hadith' ? 'hadisi' : 'duosi'}:*\n${content.text}`;
            }
        } catch (e) {
            console.error('Hadith load error:', e.message);
        }

        const fullMessage = settings.message + hadithText;

        for (const doc of usersSnapshot.docs) {
            const user = doc.data();
            try {
                await bot.telegram.sendMessage(user.chat_id, fullMessage, {
                    parse_mode: 'Markdown',
                    ...mainInlineKeyboard
                });
                sent++;
            } catch (e) {
                console.error(`  ⚠️ Failed to send to ${user.id}:`, e.message);
                failed++;
            }
        }
        console.log(`  📊 ${type}: sent=${sent}, failed=${failed}`);
    } catch (e) {
        console.error(`${type} notification error:`, e.message);
    }
}

// Check every minute if it's time to send notifications
setInterval(() => {
    const now = new Date();
    // Convert to Tashkent time (UTC+5)
    const tashkentOffset = 5 * 60; // minutes
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const tashkentMinutes = (utcMinutes + tashkentOffset) % (24 * 60);
    const tashkentHour = Math.floor(tashkentMinutes / 60);
    const tashkentMinute = tashkentMinutes % 60;

    const today = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;

    // Morning notification
    if (notificationSettings.morning.enabled &&
        tashkentHour === notificationSettings.morning.hour &&
        tashkentMinute === notificationSettings.morning.minute &&
        lastMorningSent !== today) {
        lastMorningSent = today;
        sendNotification('morning');
    }

    // Evening notification
    if (notificationSettings.evening.enabled &&
        tashkentHour === notificationSettings.evening.hour &&
        tashkentMinute === notificationSettings.evening.minute &&
        lastEveningSent !== today) {
        lastEveningSent = today;
        sendNotification('evening');
    }
}, 60 * 1000); // Every minute

// ==========================================
// 11. BROADCAST LISTENER
// ==========================================
db.collection('broadcasts').where('status', '==', 'pending').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
            const broadcast = change.doc.data();
            const broadcastId = change.doc.id;
            const { target, message } = broadcast;

            console.log(`📢 Processing broadcast: ${broadcastId} → ${target}`);

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
                            console.error(`  ⚠️ Broadcast failed for ${user.id}:`, e.message);
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
                console.log(`✅ Broadcast ${broadcastId} sent.`);
            } catch (error) {
                console.error(`❌ Broadcast ${broadcastId} failed:`, error.message);
                await db.collection('broadcasts').doc(broadcastId).update({
                    status: 'error',
                    error: error.message
                }).catch(() => { });
            }
        }
    });
}, err => console.error('Broadcast listener error:', err.message));

// ==========================================
// 12. TEST COMMANDS (admin only)
// ==========================================
bot.command('test_morning', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        await ctx.reply("Saharlik testi yuborilmoqda...");
        await sendNotification('morning');
        await ctx.reply("✅ Saharlik testi yuborildi.");
    } catch (e) {
        console.error('test_morning error:', e.message);
    }
});

bot.command('test_evening', async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;
    try {
        await ctx.reply("Kechki hisobot testi yuborilmoqda...");
        await sendNotification('evening');
        await ctx.reply("✅ Kechki hisobot testi yuborildi.");
    } catch (e) {
        console.error('test_evening error:', e.message);
    }
});

// ==========================================
// 13. LAUNCH
// ==========================================
async function startBot() {
    const isHealthy = await healthCheck();
    if (!isHealthy) {
        console.error('❌ Firestore health check failed. Bot will NOT start.');
        process.exit(1);
    }

    // Wait a moment for Firestore listeners to populate
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('🚀 Launching bot...');
    try {
        await bot.launch();
        console.log('');
        console.log('╔════════════════════════════════════════╗');
        console.log('║   🤖 Bot is running! ✅                ║');
        console.log('║   📊 Project: ' + (admin.app().options.projectId || '').padEnd(24) + '║');
        console.log('║   🔘 Buttons: ' + String(dynamicButtons.length).padEnd(24) + '║');
        console.log('║   ⏰ Morning: ' + `${notificationSettings.morning.hour}:${String(notificationSettings.morning.minute).padStart(2, '0')}`.padEnd(24) + '║');
        console.log('║   🌙 Evening: ' + `${notificationSettings.evening.hour}:${String(notificationSettings.evening.minute).padStart(2, '0')}`.padEnd(24) + '║');
        console.log('╚════════════════════════════════════════╝');
        console.log('');
    } catch (err) {
        console.error('❌ Bot launch failed!', err.message);
        if (err.message && err.message.includes('409')) {
            console.error('⚠️ Boshqa bot instansiya ishlayapti! Avval to\'xtating.');
        }
        process.exit(1);
    }
}

startBot();

process.once('SIGINT', () => { console.log('🛑 SIGINT'); bot.stop('SIGINT'); });
process.once('SIGTERM', () => { console.log('🛑 SIGTERM'); bot.stop('SIGTERM'); });
