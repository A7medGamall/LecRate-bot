import 'dotenv/config';
import { Telegraf, Markup, Scenes } from 'telegraf';
import LocalSession from 'telegraf-session-local';
import { supabase } from './supabase.js';

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('BOT_TOKEN missing in .env');

const bot = new Telegraf(BOT_TOKEN);

// ==========================================
// UTILS
// ==========================================
function getRatingKeyboard(prefix) {
    const buttons = [];
    let row = [];
    for (let i = 1; i <= 10; i++) {
        row.push(Markup.button.callback(`${i}`, `${prefix}:${i}`));
        if (row.length === 5 || i === 10) {
            buttons.push(row);
            row = [];
        }
    }
    return buttons;
}

// ==========================================
// SCENES DEFINITION (For Multi-step inputs)
// ==========================================

// 1. Scene for adding a new URL to an existing source
const addUrlScene = new Scenes.BaseScene('ADD_URL_SCENE');
addUrlScene.enter((ctx) => {
    ctx.reply("🔗 أرسل رابط المصدر الآن (أو أرسل /cancel للإلغاء):");
});
addUrlScene.command('cancel', (ctx) => {
    ctx.reply("❌ تم إلغاء الإضافة.");
    return ctx.scene.leave();
});
addUrlScene.on('text', async (ctx) => {
    const url = ctx.message.text;
    const sourceId = ctx.scene.state.sourceId;

    if (!url.startsWith('http')) {
        return ctx.reply("⚠️ الرابط غير صحيح. يجب أن يبدأ بـ http أو https. حاول مجدداً أو أرسل /cancel");
    }

    try {
        const { error } = await supabase.from('sources').update({ url }).eq('id', sourceId);
        if (error) throw error;
        
        ctx.reply("✅ تم إضافة الرابط للمصدر بنجاح! شكراً لمساهمتك.");
    } catch (err) {
        console.error(err);
        ctx.reply("❌ حدث خطأ أثناء حفظ الرابط.");
    }
    return ctx.scene.leave();
});

// 2. Scene for Rating an existing source
const rateScene = new Scenes.BaseScene('RATE_SCENE');
rateScene.enter(async (ctx) => {
    const sourceId = ctx.scene.state.sourceId;
    const sourceName = ctx.scene.state.sourceName;
    const userId = ctx.from.id.toString();
    
    // Check for duplicate rating
    try {
        const { data: existingRating } = await supabase
            .from('ratings')
            .select('id')
            .eq('source_id', sourceId)
            .eq('user_identifier', userId)
            .single();

        if (existingRating) {
            await ctx.reply("✅ لقد قمت بتقييم هذا المصدر بالفعل مسبقاً، شكراً لك!");
            return ctx.scene.leave();
        }
    } catch (err) {
        console.error("RATE SCENE ERROR:", err);
        await ctx.reply("❌ عذراً، يجب تحديث قاعدة البيانات أولاً ودعم ميزة (user_identifier).");
        return ctx.scene.leave();
    }

    await ctx.reply(`⭐ اختر تقييمك لمصدر "${sourceName}" من 1 لـ 10:\n\nأرسل /cancel لإلغاء التقييم`, Markup.inlineKeyboard(getRatingKeyboard('rate_score')));
});
rateScene.command('cancel', (ctx) => {
    ctx.reply("❌ تم إلغاء التقييم.");
    return ctx.scene.leave();
});
rateScene.action(/rate_score:(.+)/, async (ctx) => {
    ctx.scene.state.score = parseInt(ctx.match[1]);
    await ctx.editMessageText(`✅ التقييم: ${ctx.scene.state.score}/10\n\n✍️ هل تود إضافة تعليق أو رأي يوضح تجربتك مع هذا المصدر ليفيد باقي الطلبة؟\n\n(أرسل التعليق الآن، أو أرسل 'تخطي' إذا كنت لا ترغب في كتابة تعليق)\nأو /cancel للإلغاء`);
});
rateScene.on('text', async (ctx) => {
    const text = ctx.message.text;
    const score = ctx.scene.state.score;
    const sourceId = ctx.scene.state.sourceId;
    const userId = ctx.from.id.toString();
    
    // Safety check if they didn't click a score yet
    if (!score) return ctx.reply("الرجاء اختيار التقييم أولاً من الأزرار أعلاه.");

    const comment = text === 'تخطي' ? null : text;

    try {
        const { error } = await supabase.from('ratings').insert({
            source_id: sourceId,
            score: score,
            comment: comment,
            user_identifier: userId 
        });

        if (error) throw error;

        await ctx.reply(`✅ تم تسجيل تقييمك بنجاح! شكراً لمساهمتك.`);
    } catch (err) {
        console.error(err);
        ctx.reply("❌ حدث خطأ أثناء حفظ التقييم.");
    }
    return ctx.scene.leave();
});


// 3. Scene for adding a completely new source (Needs Name, Rating, Comment, URL)
const addSourceScene = new Scenes.BaseScene('ADD_SOURCE_SCENE');
addSourceScene.enter((ctx) => {
    ctx.scene.state.step = 'name';
    ctx.reply("📝 ما هو اسم المصدر الذي تود إضافته؟ (مثال: د. أحمد يوتيوب)\n\nأو أرسل /cancel للإلغاء");
});
addSourceScene.command('cancel', (ctx) => {
    ctx.reply("❌ تم إلغاء الإضافة.");
    return ctx.scene.leave();
});
addSourceScene.on('text', async (ctx) => {
    const text = ctx.message.text;
    
    if (ctx.scene.state.step === 'name') {
        ctx.scene.state.sourceName = text;
        ctx.scene.state.step = 'rating';
        return ctx.reply(`لقد قمت بإضافة "${text}".\n\n⭐ بما أنك أضفت هذا المصدر، نرجو منك تقييمه من 1 لـ 10:\n\nأو أرسل /cancel للإلغاء`, Markup.inlineKeyboard(getRatingKeyboard('rate_new_score')));
    }
    
    if (ctx.scene.state.step === 'duration') {
        const duration = parseInt(text);
        if (isNaN(duration) || duration < 0) {
            return ctx.reply("⚠️ يرجى إدخال رقم صحيح يمثل مدة المصدر بالدقائق (مثال: 45).\n\nأو أرسل /cancel للإلغاء");
        }
        ctx.scene.state.duration = duration;
        ctx.scene.state.step = 'comment';
        return ctx.reply("✍️ هل تود إضافة تعليق أو رأي عن المصدر؟\n\n(أرسل التعليق الآن، أو أرسل 'تخطي' لتجاهل هذه الخطوة)\n\nأو أرسل /cancel للإلغاء");
    }

    if (ctx.scene.state.step === 'comment') {
        ctx.scene.state.comment = text === 'تخطي' ? null : text;
        ctx.scene.state.step = 'url';
        return ctx.reply("🔗 رائع! الخطوة الأخيرة جزء مهم: أرسل رابط المصدر.\n\n(إذا كان المصدر ليس له رابط أو هو عبارة عن مكان على أرض الواقع، أرسل كلمة 'تخطي')\n\nأو أرسل /cancel للإلغاء");
    }

    if (ctx.scene.state.step === 'url') {
        let finalUrl = null;

        if (text !== 'تخطي') {
            if (!text.startsWith('http')) {
                return ctx.reply("⚠️ الرابط غير صحيح. يجب أن يبدأ بـ http أو https. حاول مجدداً، أو أرسل 'تخطي' إذا لم يكن هناك رابط، أو /cancel للإلغاء");
            }
            finalUrl = text;
        }
        
        const lectureId = ctx.scene.state.lectureId;
        const sourceName = ctx.scene.state.sourceName;
        const score = ctx.scene.state.score;
        const comment = ctx.scene.state.comment;
        const userId = ctx.from.id.toString();
        
        try {
            // 1. Create Source
            const durationMinutes = ctx.scene.state.duration || 0;
            
            const { data: sourceData, error: sourceError } = await supabase.from('sources').insert({
                lecture_id: lectureId,
                title: sourceName,
                url: finalUrl,
                duration_minutes: durationMinutes
            }).select().single();
            
            if (sourceError) throw sourceError;
            
            // 2. Create Rating for the new source
            const { error: ratingError } = await supabase.from('ratings').insert({
                source_id: sourceData.id,
                score: score,
                comment: comment,
                user_identifier: userId 
            });

            if (ratingError) throw ratingError;

            ctx.reply(`✅ تم إضافة المصدر "${sourceName}" وتقييمك له بنجاح! شكراً لمساهمتك العظيمة.`);
        } catch (err) {
            console.error(err);
            ctx.reply("❌ حدث خطأ أثناء حفظ المصدر أو التقييم.");
        }
        return ctx.scene.leave();
    }
});
// Action handler for the rating inside ADD_SOURCE_SCENE
addSourceScene.action(/rate_new_score:(.+)/, async (ctx) => {
    ctx.scene.state.score = parseInt(ctx.match[1]);
    ctx.scene.state.step = 'duration';
    await ctx.editMessageText(`✅ التقييم المبدئي: ${ctx.scene.state.score}/10\n\n⏱️ كم مدة هذا المصدر بالدقائق تقريباً؟ (أرسل رقماً فقط، مثلاً: 45)`);
});

const stage = new Scenes.Stage([addUrlScene, addSourceScene, rateScene]);

// Set up session and scenes middleware (Using /tmp for Netlify Serverless compatibility)
bot.use((new LocalSession({ database: '/tmp/session_db.json' })).middleware());
bot.use(stage.middleware());

// Debug all callbacks
bot.use((ctx, next) => {
    if (ctx.callbackQuery) {
        console.log('Received callback:', ctx.callbackQuery.data);
    }
    return next();
});

// ==========================================
// COMMANDS & INITIAL FLOW
// ==========================================

bot.start(async (ctx) => {
    try {
        await ctx.reply(
            "أهلاً بك في LecRate! 🎓\nماذا تريد أن تفعل اليوم؟",
            Markup.inlineKeyboard([
                [Markup.button.callback('أريد أن أقيم محاضرة', 'flow_rate')],
                [Markup.button.callback('أريد البحث عن تقييمات لمحاضرة', 'flow_browse')]
            ])
        );
    } catch (err) {
        console.error(err);
        ctx.reply("❌ عذراً، حدث خطأ.");
    }
});

// Redirect both choices to Batch Selection
bot.action(/flow_(.+)/, async (ctx) => {
    try {
        const { data: batches, error } = await supabase.from('batches').select('*').order('name');
        
        if (error) throw error;
        
        if (!batches || batches.length === 0) {
            return ctx.answerCbQuery("لا يوجد دفعات حالياً.", { show_alert: true });
        }

        const buttons = batches.map(b => [Markup.button.callback(b.name, `batch:${b.id}`)]);

        await ctx.editMessageText(
            "اختر الدفعة الخاصة بك:",
            Markup.inlineKeyboard(buttons)
        );
        await ctx.answerCbQuery();
    } catch (err) {
        console.error(err);
        ctx.answerCbQuery("❌ حدث خطأ أثناء جلب الدفعات.", { show_alert: true });
    }
});

// ==========================================
// ACTIONS (Navigation, Display, Comments)
// ==========================================

// Handle Batch Selection
bot.action(/batch:(.+)/, async (ctx) => {
    try {
        const batchId = ctx.match[1];
        
        const { data: modules, error } = await supabase
            .from('modules')
            .select('*')
            .eq('batch_id', batchId)
            .order('name');
            
        if (error) throw error;

        if (!modules || modules.length === 0) {
            return ctx.answerCbQuery("لا توجد مواد مسجلة لهذه الدفعة.", { show_alert: true });
        }

        const buttons = modules.map(m => [Markup.button.callback(m.name, `module:${m.id}`)]);
        buttons.push([Markup.button.callback('🔙 رجوع للبداية', 'start_menu')]);

        await ctx.editMessageText(
            "اختر المادة:",
            Markup.inlineKeyboard(buttons)
        );
        await ctx.answerCbQuery();
    } catch (err) {
        console.error(err);
        ctx.answerCbQuery("❌ حدث خطأ", { show_alert: true });
    }
});

bot.action('start_menu', async (ctx) => {
    try {
        await ctx.editMessageText(
            "ماذا تريد أن تفعل اليوم؟",
            Markup.inlineKeyboard([
                [Markup.button.callback('أريد أن أقيم محاضرة', 'flow_rate')],
                [Markup.button.callback('أريد البحث عن تقييمات لمحاضرة', 'flow_browse')]
            ])
        );
        await ctx.answerCbQuery();
    } catch {
        ctx.answerCbQuery("❌ خطأ", { show_alert: true });
    }
});

bot.action(/module:(.+)/, async (ctx) => {
    try {
        const moduleId = ctx.match[1];
        await ctx.editMessageText(
            "اختر نوع المحتوى:",
            Markup.inlineKeyboard([
                [
                    Markup.button.callback('📚 المحاضرات', `content_type:${moduleId}:lecture`),
                    Markup.button.callback('🔬 السكاشن', `content_type:${moduleId}:section`)
                ],
                [Markup.button.callback('🔙 رجوع للمواد', `flow_browse`)] 
            ])
        );
        await ctx.answerCbQuery();
    } catch (err) {
        console.error(err);
        ctx.answerCbQuery("❌ حدث خطأ", { show_alert: true });
    }
});

bot.action(/content_type:(.+):(.+)/, async (ctx) => {
    try {
        const moduleId = ctx.match[1];
        const type = ctx.match[2]; 
        
        const { data: lectures, error } = await supabase
            .from('lectures')
            .select('*')
            .eq('module_id', moduleId)
            .eq('type', type)
            .order('number', { ascending: true });
            
        if (error) throw error;

        const typeName = type === 'lecture' ? 'محاضرات' : 'سكاشن';

        if (!lectures || lectures.length === 0) {
            return ctx.answerCbQuery(`لا توجد ${typeName} متوفرة حالياً.`, { show_alert: true });
        }

        const buttons = [];
        lectures.forEach((l) => {
            const prefix = l.type === 'lecture' ? 'محاضرة' : 'سكشن';
            buttons.push([Markup.button.callback(`${prefix} ${l.number}: ${l.title}`, `lecture:${l.id}`)]);
        });
        
        buttons.push([Markup.button.callback('🔙 رجوع لنوع المحتوى', `module:${moduleId}`)]);

        await ctx.editMessageText(
            `اختر الـ ${type === 'lecture' ? 'محاضرة' : 'سكشن'}:`,
            Markup.inlineKeyboard(buttons)
        );
        await ctx.answerCbQuery();
    } catch (err) {
        console.error(err);
        ctx.answerCbQuery("❌ حدث خطأ", { show_alert: true });
    }
});

// Show Sources for a Lecture
bot.action(/lecture:(.+)/, async (ctx) => {
    try {
        const lectureId = ctx.match[1];
        
        const { data: lecture } = await supabase.from('lectures').select('*').eq('id', lectureId).single();
        if (!lecture) return ctx.answerCbQuery("المحاضرة غير موجودة", { show_alert: true });

        // Retrieve ratings with their comment field too
        const { data: sources, error } = await supabase
            .from('sources')
            .select('*, ratings(score, comment, created_at)')
            .eq('lecture_id', lectureId)
            .order('created_at', { ascending: true });
            
        if (error) throw error;

        let messageText = `📚 *${lecture.type === 'lecture' ? 'محاضرة' : 'سكشن'} ${lecture.number}: ${lecture.title}*\n\n`;
        const buttons = [];

        if (!sources || sources.length === 0) {
            messageText += `لا توجد مصادر مضافة حتى الآن. للمساهمة وإضافة مصدر، اضغط على الزر بالأسفل!`;
        } else {
            sources.forEach((s, index) => {
                const ratingsCount = s.ratings ? s.ratings.length : 0;
                const commentsCount = s.ratings ? s.ratings.filter(r => r.comment).length : 0;
                
                const avgScore = ratingsCount > 0 
                    ? (s.ratings.reduce((acc, r) => acc + r.score, 0) / ratingsCount).toFixed(1)
                    : "غير مقيم";

                const linkText = s.url ? `[اضغط هنا للمشاهدة](${s.url})` : `لا يوجد رابط`;
                
                messageText += `*${index + 1}. ${s.title}*\n`;
                messageText += `⭐ التقييم: ${avgScore}/10 (${ratingsCount} تقييمات)\n`;
                messageText += `🔗 الرابط: ${linkText}\n`;

                const shortTitle = s.title.length > 15 ? s.title.substring(0, 15) + '...' : s.title;
                const row = [Markup.button.callback(`⭐ تقييم "${shortTitle}"`, `rate_prompt:${s.id}`)];
                
                if (commentsCount > 0) {
                    row.push(Markup.button.callback(`💬 التعليقات (${commentsCount})`, `view_comments:${s.id}`));
                }

                if (!s.url) {
                    row.push(Markup.button.callback(`➕ أضف رابط`, `add_url:${s.id}`));
                }
                
                buttons.push(row);
                messageText += `\n`;
            });
        }

        buttons.push([Markup.button.callback('➕ أضف مصدر جديد', `add_source:${lectureId}`)]);
        buttons.push([Markup.button.callback('🔙 رجوع', `content_type:${lecture.module_id}:${lecture.type}`)]);

        await ctx.editMessageText(messageText, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            ...Markup.inlineKeyboard(buttons)
        });
        await ctx.answerCbQuery();
    } catch (err) {
        console.error(err);
        ctx.answerCbQuery("❌ حدث خطأ", { show_alert: true });
    }
});

// View Comments Action
bot.action(/view_comments:([a-f0-9\-]+)/, async (ctx) => {
    try {
        const sourceId = ctx.match[1];

        const { data: source } = await supabase.from('sources').select('title').eq('id', sourceId).single();
        const { data: ratings, error } = await supabase
            .from('ratings')
            .select('score, comment, created_at')
            .eq('source_id', sourceId)
            .not('comment', 'is', null)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!ratings || ratings.length === 0) {
            return ctx.answerCbQuery("لا توجد تعليقات لهذا المصدر.", { show_alert: true });
        }

        let messageText = `💬 *تعليقات وآراء الطلاب حول "${source?.title || 'المصدر'}":*\n\n`;
        
        ratings.forEach((r, idx) => {
            messageText += `*${idx+1}. (التقييم: ${r.score}/10)*\n✍️ "${r.comment}"\n\n`;
        });

        // Limit the length of the string if it's too long for Telegram
        if (messageText.length > 4000) {
            messageText = messageText.substring(0, 4000) + '... (تم اقتصاص باقي التعليقات)';
        }

        // We send this as a new message so it doesn't overwrite the sources list, 
        // making it easy to read while keeping the sources list active below it.
        await ctx.reply(messageText, { parse_mode: 'Markdown' });
        await ctx.answerCbQuery();
    } catch (err) {
        console.error(err);
        ctx.answerCbQuery("❌ حدث خطأ أثناء جلب التعليقات", { show_alert: true });
    }
});


// Enter Rate Scene
bot.action(/rate_prompt:([a-f0-9\-]+)/, async (ctx) => {
    try {
        // Instantly acknowledge the button press so Telegram stops the "loading" clock icon
        await ctx.answerCbQuery();
        
        const sourceId = ctx.match[1];
        
        // Fetch source title from DB instead of passing in callback_data to save bytes
        const { data: source } = await supabase.from('sources').select('title').eq('id', sourceId).single();
        if (!source) return ctx.reply("المصدر غير موجود");

        ctx.scene.enter('RATE_SCENE', { sourceId: sourceId, sourceName: source.title });
    } catch (err) {
        console.error(err);
        ctx.reply("❌ حدث خطأ");
    }
});

// Enter Add URL Scene
bot.action(/add_url:([a-f0-9\-]+)/, (ctx) => {
    ctx.answerCbQuery();
    ctx.scene.enter('ADD_URL_SCENE', { sourceId: ctx.match[1] });
});

// Enter Add Source Scene
bot.action(/add_source:([a-f0-9\-]+)/, (ctx) => {
    ctx.answerCbQuery();
    ctx.scene.enter('ADD_SOURCE_SCENE', { lectureId: ctx.match[1] });
});

export { bot };

// Launch Bot (Only in local development, Netlify uses the webhook handler)
if (process.env.NODE_ENV !== 'production') {
    bot.launch(() => {
        console.log('🤖 LecRate Bot is running in polling mode...');
    });
}

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
