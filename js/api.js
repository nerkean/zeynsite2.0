require('dotenv').config();
require('express-async-errors');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const CommandStats = require('./CommandStats');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const session = require('express-session');
const { fetch } = require('undici');
const Item = require('./Item');
const Inventory = require('./inventory');
const Reputation = require('./Reputation')
const Deposit = require('./Deposit');
const { Client, IntentsBitField } = require('discord.js');
const NodeCache = require('node-cache');
const rateLimit = require("express-rate-limit");
const path = require('path');
const {
    NotFoundError,
    BadRequestError,
    AuthenticationError,
    ForbiddenError
} = require('./AppError');
const logger = require('../config/logger');
const morgan = require('morgan');

const PORT = process.env.PORT;
const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET;
const DISCORD_CLIENT_ID = process.env.CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.CLIENT_SECRET;
const BOT_TOKEN = process.env.TOKEN;

const IS_PRODUCTION = process.env.NODE_ENV;
const CORS_ORIGIN = process.env.CORS_ORIGIN;
const DISCORD_CALLBACK_URL = process.env.DISCORD_CALLBACK_URL;
const FRONTEND_REDIRECT_URL = process.env.FRONTEND_REDIRECT_URL;

const DISCORD_GUILD_ID = process.env.GUILD_ID;
const ALLOWED_ROLE_IDS = [
    '1043565185509630022', '1243243180800082001', '1075072592005824563',
    '1043614651444899991', '1043615386660257872'
];
const PERMANENT_DISCOUNT_ROLE_ID = '1260383669839724634';
const DEFAULT_AVATAR_SIZE = 32;

const CACHE_GENERAL_TTL_S = 3600;
const CACHE_USER_MEMBER_TTL_S = 3600;
const CACHE_USER_MEMBER_CHECK_S = 600; 
const CACHE_LEADERBOARD_TTL_S = 300;
const CACHE_PROFILE_TTL_S = 60; 

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; 
const RATE_LIMIT_MAX_REQUESTS = 300;

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; 

const LEADERBOARD_DEFAULT_LIMIT = 100;

const SHOP_WEEKEND_DISCOUNT_PERCENT = 5;

const DEPOSIT_INTEREST_RATE = 0.05;
const DEPOSIT_COMMISSION_RATE = 0.02; 
const DEPOSIT_MAX_AMOUNT = 1000;
const DEPOSIT_MIN_MONTHS_TO_WITHDRAW = 1;

if (!SESSION_SECRET) { console.error("ОШИБКА: SESSION_SECRET не установлен!"); process.exit(1); }
if (!BOT_TOKEN) { console.error("ОШИБКА: TOKEN (BOT_TOKEN) не установлен!"); process.exit(1); }
if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) { console.error("ОШИБКА: CLIENT_ID или CLIENT_SECRET не установлены!"); process.exit(1); }
if (!MONGODB_URI) { console.error("ОШИБКА: MONGODB_URI не установлен!"); process.exit(1); }

const limiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_REQUESTS,
    message: "Слишком много запросов с вашего IP, пожалуйста, попробуйте позже.",
    handler: (req, res, next, options) => {
     res.status(429).setHeader('Retry-After', Math.ceil(options.windowMs / 1000)).send(options.message);
    }
});

const cache = new NodeCache({ stdTTL: CACHE_GENERAL_TTL_S });
const userMemberCache = new NodeCache({
    stdTTL: CACHE_USER_MEMBER_TTL_S,
    checkperiod: CACHE_USER_MEMBER_CHECK_S,
    useClones: false
});

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildMessageReactions
    ],
});

const app = express();

const corsOptions = {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200,
    credentials: true
};
app.use(cors(corsOptions));
app.use(limiter);
app.use(express.json());

app.use(morgan(IS_PRODUCTION ? 'combined' : 'dev', { stream: logger.stream }));

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => logger.info('💾 Подключено к MongoDB')) 
    .catch(err => {
        logger.error('КРИТИЧЕСКАЯ ОШИБКА ПОДКЛЮЧЕНИЯ К MONGODB:', err); 
        process.exit(1);
    });

app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: IS_PRODUCTION,
        maxAge: SESSION_MAX_AGE_MS,
        sameSite: IS_PRODUCTION ? 'lax' : undefined,
        httpOnly: true
    }
}));
if (IS_PRODUCTION) { app.set('trust proxy', 1); }
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    logger.debug("Сериализация пользователя:", { userId: user._id });
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    logger.debug("Десериализация пользователя:", { id }); 
    try {
        const user = await CommandStats.findById(id);
        if (!user) {
             logger.warn("Пользователь не найден при десериализации", { id }); 
            return done(new AuthenticationError('Пользователь сессии не найден в БД'));
        }
        logger.debug("Десериализованный пользователь:", { user: user._id });
        done(null, user);
    } catch (err) {
        logger.error("Ошибка при десериализации пользователя:", err); 
        done(err);
    }
});

async function fetchUserGuildMember(userId) {
    const cacheKey = `discordMember_${userId}`;
    const cachedMember = userMemberCache.get(cacheKey);
    if (cachedMember !== undefined) {
        logger.debug(`[Cache] Участник ${userId} найден в кэше приложения.`);
        return cachedMember;
    }

    logger.debug(`[Fetch] Попытка получить данные участника ${userId} через discord.js`); 

    if (!client || !client.isReady()) {
        logger.warn('[Fetch] Клиент discord.js временно не готов (переподключение?).');
        return null;
    }

    try {
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        if (!guild) {
            logger.error(`[Fetch] Гильдия ${DISCORD_GUILD_ID} не найдена клиентом discord.js.`); 
            return null;
        }

        const member = await guild.members.fetch({ user: userId, force: false }).catch(err => {
            if (err.code === 10007) {
                 logger.info(`[Fetch] Участник ${userId} не найден на сервере ${DISCORD_GUILD_ID}.`); 
                userMemberCache.set(cacheKey, null);
            } else {
                 logger.error(`[Fetch] Ошибка при получении участника ${userId} через discord.js`, err); 
            }
            return null;
        });

        if (!member) return null;

        logger.debug(`[Fetch] Данные участника ${userId} успешно получены через discord.js`); 
        userMemberCache.set(cacheKey, member);
        return member;

    } catch (error) {
        logger.error(`[Fetch] Критическая ошибка при получении данных участника ${userId}`, error);
        return null;
    }
}

passport.use(new DiscordStrategy({
    clientID: process.env.CLIENT_ID, 
    clientSecret: process.env.CLIENT_SECRET, 
    callbackURL: DISCORD_CALLBACK_URL,
    scope: ['identify', 'guilds.members.read']
},
async (accessToken, refreshToken, profile, done) => {
    logger.info("Сработал обратный вызов Discord Strategy", { profileId: profile.id, username: profile.username }); 
    try {
        logger.debug("Профиль с дискорда:", { profile });
        let user = await CommandStats.findOne({ userId: profile.id, serverId: DISCORD_GUILD_ID }).lean();
        let isNewUser = false;

        if (!user) {
            isNewUser = true;
            logger.info("Новый пользователь, подготовка данных", { profileId: profile.id }); 
            user = { /* ... */ };
        } else {
            logger.info("Существующий пользователь, обновление данных", { userId: user.userId });
            user.username = profile.username;
            user.userAvatar = profile.avatar;
        }

        const userGuildMember = await fetchUserGuildMember(profile.id);
        const roleAcquisitionDates = (!isNewUser && user.roleAcquisitionDates) ? { ...user.roleAcquisitionDates } : {};
        const now = new Date();

        if (!userGuildMember) {
             logger.error(`[Passport] Не удалось получить данные участника ${profile.id} с Discord.`); 
        } else {
            logger.debug(`[Passport] Проверка ролей для пользователя ${profile.id}`);
            for (const allowedRoleId of ALLOWED_ROLE_IDS) {
                if (userGuildMember.roles.cache.has(allowedRoleId) && !roleAcquisitionDates[allowedRoleId]) {
                    logger.info(`[Passport] Обнаружена новая роль ${allowedRoleId} для пользователя ${profile.id}`);
                    roleAcquisitionDates[allowedRoleId] = now;
                } else if (!userGuildMember.roles.cache.has(allowedRoleId) && roleAcquisitionDates[allowedRoleId]) {
                     logger.info(`[Passport] Обнаружено удаление роли ${allowedRoleId} у пользователя ${profile.id}`); 
                    delete roleAcquisitionDates[allowedRoleId];
                }
            }
        }

        const updateData = {
            username: user.username,
            userAvatar: user.userAvatar,
            roleAcquisitionDates: roleAcquisitionDates
        };
        if (isNewUser) {
            updateData.userId = user.userId;
            updateData.serverId = user.serverId;
        }

        logger.debug("[Passport] Данные пользователя перед сохранением:", { updateData });
        const updateResult = await CommandStats.updateOne(
            { userId: profile.id, serverId: DISCORD_GUILD_ID },
            { $set: updateData },
            { upsert: true }
        );
         logger.info("[Passport] Результат обновления/вставки:", { updateResult });

        const finalUser = await CommandStats.findOne({ userId: profile.id, serverId: DISCORD_GUILD_ID });
         if (!finalUser) {
             logger.error(`[Passport] КРИТИЧЕСКАЯ ОШИБКА: не удалось найти пользователя ${profile.id} после upsert!`); 
             return done(new Error(`Failed to find user ${profile.id} after upsert.`));
         }
        return done(null, finalUser);

    } catch (err) {
        logger.error("Ошибка в Discord Strategy", err); 
        return done(err);
    }
}));

app.get('/leaderboard', async (req, res) => {
    const sortBy = req.query.sortBy || 'totalMessages';
    const cacheKey = `leaderboard_${sortBy}`;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || LEADERBOARD_DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const cachedData = cache.get(cacheKey);
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_LEADERBOARD_TTL_S * 1000) {
        return res.json({
            data: cachedData.data,
            nextUpdateIn: Math.max(0, CACHE_LEADERBOARD_TTL_S * 1000 - (Date.now() - cachedData.timestamp))
        });
    }

    let sortOption = {};
    if (sortBy === 'voiceTime') sortOption = { voiceTime: -1 };
    else if (sortBy === 'stars') sortOption = { stars: -1 };
    else sortOption = { totalMessages: -1 };

    const topUsers = await CommandStats.find({})
        .sort(sortOption).skip(skip).limit(limit)
        .select('username totalMessages voiceTime stars').lean();

    cache.set(cacheKey, { data: topUsers, timestamp: Date.now() }, CACHE_LEADERBOARD_TTL_S);

    res.json({
        data: topUsers,
        nextUpdateIn: CACHE_LEADERBOARD_TTL_S * 1000
    });
});

app.get('/profile/:uuid', async (req, res) => {
    const uuid = req.params.uuid;
    const cacheKey = `profile_${uuid}`;
    logger.debug(`Запрос профиля uuid: ${uuid}`); 

    const cachedProfile = cache.get(cacheKey);
    if (cachedProfile) {
        logger.debug(`Профиль ${uuid} найден в кэше.`);
        return res.json(cachedProfile);
    }
    logger.debug(`Профиль ${uuid} НЕ найден в кэше.`); 

    const userStats = await CommandStats.findOne({ uuid }).select('-__v').lean();
    if (!userStats) throw new NotFoundError('Пользователь не найден');

    const userId = userStats.userId;
    let userReputation = 0;
    const reputationRecord = await Reputation.findOne({ userId: userId, guildId: DISCORD_GUILD_ID }).lean();
    if (reputationRecord) {
        userReputation = reputationRecord.reputation;
    }

    let userRolesIds = [];
    const discordMember = await fetchUserGuildMember(userId);
    if (discordMember && discordMember.roles) {
        userRolesIds = Array.from(discordMember.roles.cache.keys());
         logger.info(`[Профиль ${uuid}] Роли (${userRolesIds.length}) успешно получены для userId: ${userId}`); 
    } else {
         logger.warn(`[Профиль ${uuid}] Не удалось получить роли для userId: ${userId}`);
    }

    const userRankAllTime = await CommandStats.countDocuments({ totalMessages: { $gt: userStats.totalMessages ?? 0 } }) + 1;
    const userRankToday = await CommandStats.countDocuments({ messagesToday: { $gt: userStats.messagesToday ?? 0 } }) + 1;
    const userRankLast7Days = await CommandStats.countDocuments({ messagesLast7Days: { $gt: userStats.messagesLast7Days ?? 0 } }) + 1;
    const userRankLast30Days = await CommandStats.countDocuments({ messagesLast30Days: { $gt: userStats.messagesLast30Days ?? 0 } }) + 1;
    const userRankVoiceTime = await CommandStats.countDocuments({ voiceTime: { $gt: userStats.voiceTime ?? 0 } }) + 1;
    const userRankStars = await CommandStats.countDocuments({ stars: { $gt: userStats.stars ?? 0 } }) + 1;

    const achievementsList = [
        { name: 'message_master', description: 'Написать 500 сообщений за 24 часа', target: 500 },
        { name: 'voice_champion', description: 'Попасть в топ 1 за 24 часа по голосовому времени' },
        { name: 'lovebird', description: 'Создать брак через бота' },
        { name: 'voice_time_10s', description: 'Просидеть 1 час в голосовом канале подряд', target: 3600 },
    ];
    const userAchievements = achievementsList.map(achievement => {
        let progress = 0;
        const userAchData = Array.isArray(userStats.achievements) ? userStats.achievements : [];
        const completed = userAchData.some(a => a.name === achievement.name && a.completed);
        if (achievement.name === 'message_master') {
            progress = userStats.messagesToday ?? 0;
        } else if (achievement.name === 'voice_time_10s') {
            progress = Math.floor((userStats.voiceTime ?? 0) / 1000);
        }
        return { ...achievement, progress, completed };
    });

    let finalAvatarUrl = null;
    if (userStats.userAvatar) {
        if (userStats.userAvatar.startsWith('http')) {
            finalAvatarUrl = userStats.userAvatar;
         } else {
             const extension = userStats.userAvatar.startsWith('a_') ? 'gif' : 'png';
             finalAvatarUrl = `https://cdn.discordapp.com/avatars/${userStats.userId}/${userStats.userAvatar}.${extension}?size=128`;
         }
     } else {
         logger.debug(`У пользователя ${userStats.username} нет аватара.`); 
         finalAvatarUrl = null;
     }

    const profileData = {
        ...userStats,
        reputation: userReputation,
        userAvatar: finalAvatarUrl,
        userRankAllTime,
        userRankToday,
        userRankLast7Days,
        userRankLast30Days,
        userRankVoiceTime: userRankVoiceTime,
        userRankStars: userRankStars,
        roles: userRolesIds,
        achievements: userAchievements
    };

    cache.set(cacheKey, profileData, CACHE_PROFILE_TTL_S);
    logger.info(`Профиль ${uuid} (userId: ${userId}) успешно сформирован и закэширован.`); 
    res.json(profileData);
});

app.get('/achievements', async (req, res) => {
    const achievements = [
        { name: 'message_master', description: 'Написать 500 сообщений за 24 часа', target: 500 },
        { name: 'voice_champion', description: 'Попасть в топ 1 за 24 часа по голосовому времени' },
        { name: 'lovebird', description: 'Создать брак через бота' },
        { name: 'voice_time_10s', description: 'Просидеть 1 час в голосовом канале подряд', target: 3600 },
    ];
    res.json(achievements);
});

app.get('/shop', async (req, res) => {
    const items = await Item.find();
    res.json(items);
});

app.get('/profile/:userId/messagesByDate', async (req, res) => {
    const userId = req.params.userId;
    if (!mongoose.Types.ObjectId.isValid(userId) && !/^\d+$/.test(userId)) {
        throw new BadRequestError('Неверный формат ID пользователя.');
    }
    const userStats = await CommandStats.findOne({ userId });
    if (!userStats) throw new NotFoundError('Пользователь не найден');
    res.json(userStats.messagesByDate || {});
});

app.post('/buy', async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { uuid, userId, itemName, quantity } = req.body;
        if (!uuid || !userId || !itemName || !quantity || quantity <= 0) {
            throw new BadRequestError('Не предоставлены все необходимые данные или количество некорректно.');
        }

        const user = await CommandStats.findOne({ uuid, userId }).session(session);
        if (!user) throw new NotFoundError('Пользователь не найден.');

        const item = await Item.findOne({ name: itemName }).session(session);
        if (!item) throw new NotFoundError('Товар не найден');
        if (item.stock !== -1 && item.stock < quantity) {
            throw new BadRequestError('Недостаточно товара в наличии');
        }

        const today = new Date().getDay();
        const isDiscountDay = today === 0 || today === 6;
        let discountPercentage = isDiscountDay ? SHOP_WEEKEND_DISCOUNT_PERCENT : 0;

        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        const member = await guild.members.fetch({ user: userId, force: false });
        if (!member) throw new NotFoundError('Участник Discord не найден на сервере.');

        const hasPermanentDiscountRole = member.roles.cache.has(PERMANENT_DISCOUNT_ROLE_ID);
        if (hasPermanentDiscountRole) {
            discountPercentage += 20;
        }

        const discountedPrice = Math.round(item.price * (1 - discountPercentage / 100));
        if (user.stars < discountedPrice * quantity) {
            throw new BadRequestError('Недостаточно звезд');
        }

        user.stars -= discountedPrice * quantity;
        if (item.stock !== -1) {
            item.stock -= quantity;
            await item.save({ session });
        }

        let inventory = await Inventory.findOne({ userId }).session(session);
        if (!inventory) inventory = new Inventory({ userId, items: [] });
        const existingItemIndex = inventory.items.findIndex(i => i.itemId.toString() === item._id.toString());
        if (existingItemIndex !== -1) {
            inventory.items[existingItemIndex].quantity += quantity;
        } else {
            inventory.items.push({ itemId: item._id, itemName: item.name, quantity });
        }

        await Promise.all([
             user.save({ session }),
             inventory.save({ session })
        ]);

        await session.commitTransaction();
        logger.info(`Пользователь ${userId} купил ${quantity}x ${itemName}`); 
        res.json({ message: `Вы успешно купили ${quantity}x ${item.name} за ${discountedPrice * quantity} звезд!` });
    } catch (error) {
        await session.abortTransaction();
        logger.error(`Ошибка при покупке товара для ${req.body?.userId} (транзакция отменена)`, error); 
        next(error);
    } finally {
        session.endSession();
    }
});

app.get('/deposit/:uuid', async (req, res) => {
    const uuid = req.params.uuid;
    const userStats = await CommandStats.findOne({ uuid }).select('userId').lean();
    if (!userStats || !userStats.userId) throw new NotFoundError('Пользователь по UUID не найден');

    const userId = userStats.userId;
    const deposit = await Deposit.findOne({ userId: userId, isWithdrawn: false }).lean();

    if (!deposit) return res.json({ activeDeposit: null });

    const monthsPassed = Math.floor((new Date() - deposit.depositDate) / (1000 * 60 * 60 * 24 * 30));
    const currentAmount = deposit.amount * (1 + deposit.interestRate) ** monthsPassed;
    const canWithdraw = monthsPassed >= DEPOSIT_MIN_MONTHS_TO_WITHDRAW;

    res.json({
        activeDeposit: {
            initialAmount: deposit.amount,
            depositDate: deposit.depositDate,
            interestRate: deposit.interestRate,
            monthsPassed: monthsPassed,
            currentAmount: currentAmount,
            canWithdraw: canWithdraw
        }
    });
});

app.post('/deposit/make', async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { uuid, userId, amount } = req.body;
        if (!uuid || !userId || !amount) throw new BadRequestError('Не предоставлены все необходимые данные.');

        const depositAmount = parseInt(amount, 10);
        if (isNaN(depositAmount) || depositAmount <= 0) throw new BadRequestError('Сумма депозита должна быть положительным числом.');

        const commandStats = await CommandStats.findOne({ userId: userId, uuid: uuid }).session(session);
        if (!commandStats) throw new NotFoundError('Пользователь не найден.');

        if (depositAmount > DEPOSIT_MAX_AMOUNT) {
            throw new BadRequestError(`❌ Вы не можете внести более ${DEPOSIT_MAX_AMOUNT} ⭐`);
        }
        if (commandStats.stars < depositAmount) {
            throw new BadRequestError('❌ У вас недостаточно звезд для внесения депозита');
        }
        const existingDeposit = await Deposit.findOne({ userId: userId, isWithdrawn: false }).session(session);
        if (existingDeposit) {
            throw new BadRequestError(`❌ У вас уже есть активный депозит.`);
        }

        const commission = depositAmount * DEPOSIT_COMMISSION_RATE;
        const finalDepositAmount = depositAmount - commission;

        const newDeposit = new Deposit({
            userId: userId,
            amount: finalDepositAmount,
            depositDate: new Date(),
            interestRate: DEPOSIT_INTEREST_RATE,
            isWithdrawn: false,
        });
        await newDeposit.save({ session });

        commandStats.stars -= depositAmount;
        await commandStats.save({ session });

        await session.commitTransaction();

        logger.info(`Пользователь ${userId} внес депозит ${finalDepositAmount.toFixed(2)}`); 
        res.json({
            message: `✅ Вы внесли депозит в размере ${finalDepositAmount.toFixed(2)} ⭐ (с учетом комиссии ${commission.toFixed(2)} ⭐) под ${DEPOSIT_INTEREST_RATE * 100}% годовых. Вы сможете вывести депозит через ${DEPOSIT_MIN_MONTHS_TO_WITHDRAW * 30} дней`,
            newBalance: commandStats.stars
        });
    } catch (error) {
        await session.abortTransaction();
        logger.error(`Ошибка при создании депозита для ${req.body?.userId} (транзакция отменена)`, error); 
        next(error);
    } finally {
        session.endSession();
    }
});

app.post('/deposit/withdraw', async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { uuid, userId } = req.body;
        if (!uuid || !userId) throw new BadRequestError('Не предоставлены все необходимые данные.');

        const commandStats = await CommandStats.findOne({ userId: userId, uuid: uuid }).session(session);
        if (!commandStats) throw new NotFoundError('Пользователь не найден.');

        const deposit = await Deposit.findOne({ userId: userId, isWithdrawn: false }).session(session);
        if (!deposit) throw new BadRequestError('❌ У вас нет активного депозита');

        const monthsPassed = Math.floor((new Date() - deposit.depositDate) / (1000 * 60 * 60 * 24 * 30));
        if (monthsPassed < DEPOSIT_MIN_MONTHS_TO_WITHDRAW) {
            throw new BadRequestError(`❌ Вы не можете вывести депозит раньше, чем через ${DEPOSIT_MIN_MONTHS_TO_WITHDRAW * 30} дней`);
        }

        const totalAmount = deposit.amount * (1 + deposit.interestRate) ** monthsPassed;

        deposit.isWithdrawn = true;
        commandStats.stars += totalAmount;

        await Promise.all([
            deposit.save({ session }),
            commandStats.save({ session })
        ]);

        await session.commitTransaction();

        logger.info(`Пользователь ${userId} вывел депозит ${totalAmount.toFixed(2)}`); 
        res.json({
            message: `🥳 Ваш депозит на сумму ${totalAmount.toFixed(2)} ⭐ был успешно выведен. Поздравляем!`,
            newBalance: commandStats.stars
        });
    } catch (error) {
        await session.abortTransaction();
        logger.error(`Ошибка при выводе депозита для ${req.body?.userId} (транзакция отменена)`, error); 
        next(error);
    } finally {
        session.endSession();
    }
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    async (req, res) => {
        const user = await CommandStats.findOne({ userId: req.user.userId }).select('uuid');
        if (!user) throw new NotFoundError('Пользователь сессии не найден после аутентификации.');
        res.redirect(`${FRONTEND_REDIRECT_URL}?uuid=${user.uuid}`);
    }
);

app.get('/logout', (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        res.redirect('/');
    });
});

app.get('/discord-id', async (req, res) => {
    const uuid = req.query.uuid;
    if (!uuid) throw new BadRequestError('Необходимо предоставить uuid');
    const user = await CommandStats.findOne({ uuid }).select('userId').lean();
    if (user && user.userId) res.send(user.userId);
    else throw new NotFoundError('Пользователь не найден по uuid');
});

app.get('/nick', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) throw new BadRequestError('Необходимо предоставить userId');
    const memberData = await fetchUserGuildMember(userId);
    if (memberData && memberData.user) res.send(memberData.user.username);
    else throw new NotFoundError('Пользователь Discord не найден');
});

app.get('/avatar', async (req, res) => {
    const userId = req.query.userId;
    if (!userId) throw new BadRequestError('Необходимо предоставить userId');
    const memberData = await fetchUserGuildMember(userId);
    if (memberData && memberData.user && memberData.user.avatar) {
        const extension = memberData.user.avatar.startsWith('a_') ? 'gif' : 'png';
        const avatarUrl = `https://cdn.discordapp.com/avatars/${memberData.user.id}/${memberData.user.avatar}.${extension}?size=${DEFAULT_AVATAR_SIZE}`;
        res.send(avatarUrl);
    } else {
        throw new NotFoundError('Аватар пользователя не найден');
    }
});

app.use(express.static(path.join(__dirname, '../')));

app.all('*', (req, res, next) => {
    next(new NotFoundError(`Не могу найти ${req.originalUrl} на этом сервере!`));
});

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    logger.error(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
        error: err,
        stack: err.stack,
        isOperational: err.isOperational,
        userId: req.user?._id || req.user?.id || 'anonymous'
    });

    if (err instanceof NotFoundError && req.accepts('html')) {
        return res.status(err.statusCode).sendFile(path.resolve(__dirname, '../', '404.html'));
    }

    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(el => el.message);
        err = new BadRequestError(`Неверные входные данные: ${errors.join('. ')}`);
    } else if (err.code === 11000) {
        const value = err.errmsg.match(/(["'])(\\?.)*?\1/)[0];
        err = new BadRequestError(`Дублирующее значение поля: ${value}.`);
    } else if (err.name === 'CastError') {
        err = new BadRequestError(`Неверный формат для ${err.path}: ${err.value}.`);
    }

    if (err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    }

    return res.status(500).json({
        status: 'error',
        message: IS_PRODUCTION ? 'Что-то пошло не так на сервере!' : err.message 
    });
};

app.use(errorHandler);

client.once('ready', () => { 
    logger.info(`Бот Discord готов к работе: ${client.user.tag}`);

    app.listen(PORT, () => {
        logger.info(`🚀 API сервер запущен на порту ${PORT} в режиме ${process.env.NODE_ENV || 'development'}`);
    });
});

client.on('error', (error) => { 
    logger.error('Ошибка клиента Discord:', error);
});

client.on('disconnect', () => {
    logger.warn('Клиент Discord отключился! Попытка переподключения...');
});

client.on('reconnecting', () => {
    logger.info('Клиент Discord переподключается...');
});

client.login(BOT_TOKEN);