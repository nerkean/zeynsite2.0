document.addEventListener('DOMContentLoaded', function() {


    const isDevelopment = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    const logger = {
        log: (...args) => { if (isDevelopment) console.log(...args); },
        info: (...args) => { if (isDevelopment) console.info(...args); },
        warn: (...args) => { console.warn(...args); },
        error: (...args) => { console.error(...args); },
        debug: (...args) => { if (isDevelopment) console.debug(...args); }
    };

    const profileStatsContainer = document.querySelector('.profile-stats');
    const achievementsContainer = document.querySelector('.profile-achievements');
    const profileUsername = document.querySelector('.profile-username');
    const profileUserId = document.querySelector('.profile-user-id');
    const profileAvatar = document.querySelector('.profile-avatar');
    const profileHeader = document.querySelector('.profile-header');
    const shopItemsContainer = document.querySelector('.shop-items');
    const errorContainer = document.getElementById('error-container');
    const depositContentArea = document.querySelector('.deposit-content-area');

    let shopDataCache = null;
    let cachedProfileData = {};
    let loggedInUserProfile = null;

const allowedRoleIds = ['1043565185509630022', '1243243180800082001', '1075072592005824563', '1043614651444899991', '1043615386660257872'];
    const roleToPosition = {
        '1043615386660257872': '🐞 Хелпер',
        '1043614651444899991': '👾 Модератор',
        '1075072592005824563': '💎 Старший модератор',
        '1043565185509630022': '🛠️ Админ',
        '1243243180800082001': '🔧 Тех Админ',
    };

    const PERMANENT_DISCOUNT_ROLE_ID_FRONTEND = '1260383669839724634';
    const BACKEND_BASE_URL = 'https://api.bandazeyna.com';

    function displayErrorMessage(message, errorObject = null) {
        logger.error("Сообщение об ошибке для пользователя:", message, errorObject || '');
        let contentArea = document.querySelector('.profile-tab-content:not(.hidden)');
        let errorDivToShow = null;

        if (contentArea) {
            errorDivToShow = contentArea.querySelector('#error-container') || errorContainer; 
        } else {
             errorDivToShow = errorContainer;
        }

         if(errorDivToShow) {
             errorDivToShow.textContent = message;
             errorDivToShow.style.display = 'block';
         } else {
             logger.warn("Не найден контейнер для ошибок (#error-container или .profile-tab-content:not(.hidden) #error-container), используем alert.");
         }
    }

    async function fetchProfileData(uuid) {
         logger.info(`Запрос fetchProfileData для uuid: ${uuid}`);
        if (cachedProfileData[uuid]) {
             logger.debug(`Данные профиля для ${uuid} найдены в кэше`);
            return cachedProfileData[uuid];
        }
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/profile/${uuid}`);
            if (!response.ok) {
                let errorText = `Статус ${response.status}`;
                let errorMessage = `Ошибка при получении данных профиля.`;
                try {
                    const errorJson = await response.json(); 
                     if (errorJson.message) errorMessage = errorJson.message; 
                     errorText = JSON.stringify(errorJson);
                 } catch {
                     try { errorText = await response.text(); } catch { errorText = response.statusText; } 
                 }

                if (response.status === 404) {
                    errorMessage = 'Профиль не найден. Убедитесь, что вы использовали команду /mrank на сервере.';
                } else if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    errorMessage = retryAfter
                        ? `Превышен лимит запросов. Попробуйте снова через ${retryAfter} секунд.`
                        : `Превышен лимит запросов. Попробуйте позже.`;
                }
                 logger.error("Ошибка при получении данных профиля:", { status: response.status, statusText: response.statusText, detail: errorText }); 
                displayErrorMessage(errorMessage); 
                throw new Error(errorMessage);
            }
            const data = await response.json();
             logger.info("Полученные данные профиля:", data);
            cachedProfileData[uuid] = data;
            loggedInUserProfile = data;
            if (errorContainer) errorContainer.textContent = ''; 
            return data;
        } catch (error) {
             logger.error(`Ошибка в fetchProfileData для uuid ${uuid}:`, error); 
            return null; 
        }
    }


    async function fetchProfileData(uuid) {
        logger.info(`Запрос fetchProfileData для uuid: ${uuid}`);
       if (cachedProfileData[uuid]) {
            logger.debug(`Данные профиля для ${uuid} найдены в кэше`);
           return cachedProfileData[uuid];
       }
       try {
           const response = await fetch(`${BACKEND_BASE_URL}/profile/${uuid}`); 
           if (!response.ok) {
               let errorText = `Статус ${response.status}`;
               let errorMessage = `Ошибка при получении данных профиля.`;
               try {
                   const errorJson = await response.json();
                    if (errorJson.message) errorMessage = errorJson.message; 
                    errorText = JSON.stringify(errorJson);
                } catch {
                    try { errorText = await response.text(); } catch { errorText = response.statusText; }
                }

               if (response.status === 404) {
                   errorMessage = 'Профиль не найден. Убедитесь, что вы использовали команду /mrank на сервере.';
               } else if (response.status === 429) {
                   const retryAfter = response.headers.get('Retry-After');
                   errorMessage = retryAfter
                       ? `Превышен лимит запросов. Попробуйте снова через ${retryAfter} секунд.`
                       : `Превышен лимит запросов. Попробуйте позже.`;
               }
                logger.error("Ошибка при получении данных профиля:", { status: response.status, statusText: response.statusText, detail: errorText }); 
               displayErrorMessage(errorMessage);
               throw new Error(errorMessage); 
           }
           const data = await response.json();
            logger.info("Полученные данные профиля:", data);
           cachedProfileData[uuid] = data; 
           loggedInUserProfile = data;
           if (errorContainer) errorContainer.textContent = '';
           return data;
       } catch (error) {
            logger.error(`Ошибка в fetchProfileData для uuid ${uuid}:`, error); 
           return null; 
       }
   }

function createReputationBar(value) {
    const clampedValue = Math.max(-100, Math.min(100, value ?? 0));
    const container = document.createElement('div');
    container.classList.add('reputation-bar-container');
    container.title = `Репутация: ${clampedValue}`;
    const fill = document.createElement('div');
    fill.classList.add('reputation-bar-fill');
    const percentage = ((clampedValue + 100) / 200) * 100;
    fill.style.width = `${percentage}%`;
    if (clampedValue > 0) {
        fill.classList.add('positive');
    } else if (clampedValue < 0) {
        fill.classList.add('negative');
    } else {
        fill.classList.add('neutral');
    }
    const text = document.createElement('span');
    text.classList.add('reputation-bar-text');
    text.textContent = `${clampedValue}`;
    container.appendChild(fill);
    container.appendChild(text);
    return container;
}

/**
 * @param {'dailyBets' | 'weeklyDonations' | 'dailyPlays'} limitType 
 * @param {string[]} roles 
 * @returns {number | null} 
 */
function getLimit(limitType, roles = []) {
    const boosterLvl3RoleId = '1254888504152952943';
    const boosterLvl2RoleId = '1254887651907993742';
    const boosterLvl1RoleId = '1254887961691164784';
    const boosterRoleId = '1254887217776820365';

    if (limitType === 'dailyBets') {
        if (roles.includes(boosterLvl3RoleId)) return 20;
        if (roles.includes(boosterLvl2RoleId)) return 15;
        if (roles.includes(boosterLvl1RoleId)) return 10;
        if (roles.includes(boosterRoleId)) return 5;
        return 3;
    }
    if (limitType === 'weeklyDonations') {
        return 10; 
    }
    if (limitType === 'dailyPlays') {
        return 5; 
    }
     logger.warn(`Неизвестный тип лимита запрошен: ${limitType}`); 
    return null;
}

function displayProfileData(data) {
    logger.info("Отображение данных профиля для:", data?.username || data?.userId);

    if (!data || Object.keys(data).length === 0 || !data.userId) {

        logger.warn("Нет данных для отображения профиля или отсутствует userId");
        if (errorContainer && !errorContainer.textContent) {
            errorContainer.textContent = 'Не удалось загрузить данные профиля.';
        }
        if (profileHeader) profileHeader.style.display = 'none';
        const content = document.querySelector('.profile-content');
        if (content) content.style.display = 'none';
        return;
    } else {
        if (profileHeader) profileHeader.style.display = 'flex';
        const content = document.querySelector('.profile-content');
        if (content) content.style.display = 'block';
        if (errorContainer) errorContainer.textContent = '';
    }

    const username = data.username || 'Неизвестный';

    if (data.userAvatar && profileAvatar) {
        profileAvatar.src = data.userAvatar;
        profileAvatar.alt = `Аватар ${username}`;
        profileAvatar.style.display = 'block';
        profileAvatar.onerror = () => {
            logger.warn(`Не удалось загрузить аватар: ${data.userAvatar}`);
            profileAvatar.style.display = 'none';
            profileAvatar.alt = "";
        };
    } else if (profileAvatar) {
        profileAvatar.alt = "";
        profileAvatar.style.display = 'none';
    }

    if (profileUsername) profileUsername.textContent = `Добро пожаловать, ${username}!`;
    if (profileUserId) profileUserId.textContent = `ID: ${data.userId}`;

    let highestUserPosition = '';
    let highestRoleId = '';
    if (data.roles && Array.isArray(data.roles) && data.roles.length > 0) {
        for (const roleId of allowedRoleIds) { 
            if (data.roles.includes(roleId)) {
                highestUserPosition = roleToPosition[roleId]; 
                highestRoleId = roleId;
                break;
            }
        }
    }

    let positionElement = profileHeader ? profileHeader.querySelector('.profile-user-position') : null;
    if (profileHeader && !positionElement) {
        positionElement = document.createElement('p');
        positionElement.classList.add('profile-user-position');
        profileHeader.appendChild(positionElement);
    }

    if (positionElement) {
        if (highestUserPosition) {
            positionElement.textContent = highestUserPosition;
            positionElement.style.display = 'block';
            if (highestRoleId === '1243243180800082001') { 
                positionElement.classList.add('tech-admin');
            } else {
                positionElement.classList.remove('tech-admin');
            }
        } else {
            positionElement.style.display = 'none';
        }
    }

    const staffTabContent = document.querySelector('.profile-tab-content[data-tab="staff"]');
    if (!staffTabContent) {
        logger.error('Контейнер для стафф-вкладки не найден!');
    }

    const userRoles = data.roles || [];
    const dailyBetsLimit = getLimit('dailyBets', userRoles); 
    const weeklyDonationsLimit = getLimit('weeklyDonations', userRoles);
    const dailyPlaysLimit = getLimit('dailyPlays', userRoles);

    const statsBlocks = [
        { name: 'Баланс', value: `${(data.stars ?? 0).toFixed(2)} ⭐` },
        { name: 'Буст', value: data.activeStarBoost && data.activeStarBoost.expiresAt > Date.now() ? `+${data.activeStarBoost.percentage}% (до ${new Date(data.activeStarBoost.expiresAt).toLocaleTimeString('ru-RU')})` : 'Нет' },
        {
            name: 'Сообщения и Рейтинг', value: [
                { period: 'За все время', count: data.totalMessages ?? 0, rank: data.userRankAllTime ?? 'N/A' },
                { period: 'За 24 часа', count: data.messagesToday ?? 0, rank: data.userRankToday ?? 'N/A' },
                { period: 'За 7 дней', count: data.messagesLast7Days ?? 0, average: ((data.messagesLast7Days ?? 0) / 7).toFixed(0), rank: data.userRankLast7Days ?? 'N/A' },
                { period: 'За 30 дней', count: data.messagesLast30Days ?? 0, average: ((data.messagesLast30Days ?? 0) / 30).toFixed(0), rank: data.userRankLast30Days ?? 'N/A' }
            ],
        },
        {
            name: 'Лутбоксы', value: [
                { type: 'Всего открыто', count: data.totalLootboxCount ?? 0 },
                { type: 'Обычные', count: data.regularLootboxCount ?? 0 },
                { type: 'Эпические', count: data.epicLootboxCount ?? 0 },
                { type: 'Легендарные', count: data.legendaryLootboxCount ?? 0 }
            ]
        },
        {
            name: 'Прочее',
            value: [
                { label: 'За все время вы получили', value: `${data.totalMuteCount ?? 0} мьютов` },
                { label: 'За день было сделано', value: `${data.dailyBets ?? 0} / ${dailyBetsLimit} ставок в казино` },
                { label: 'За все время вы сделали', value: `${data.totalCasinoSpins ?? 0} ставок в казино` },
                { label: 'За неделю вы передали', value: `${data.weeklyDonations ?? 0} / ${weeklyDonationsLimit} предметов` },
                { label: 'За все время вы передали', value: `${data.totalDonations ?? 0} предметов` },
                { label: 'За день вы сыграли', value: `${data.dailyPlays ?? 0} / ${dailyPlaysLimit} раз в Камень-Ножницы-Бумага` },
                { label: 'За все время вы выиграли', value: `${data.totalWins ?? 0} раз в Камень-Ножницы-Бумага` }
            ]
        }
    ];

    if (profileStatsContainer) {
        profileStatsContainer.innerHTML = '';
    } else {
        logger.error("Контейнер profileStatsContainer не найден!");
        return;
    }


    requestAnimationFrame(() => {
        statsBlocks.forEach(block => {
            const blockElement = document.createElement('div');
            blockElement.classList.add('profile-stat-block');

            const nameElement = document.createElement('div');
            nameElement.classList.add('profile-stat-name');
            nameElement.textContent = block.name;
            blockElement.appendChild(nameElement);

            const valueContainer = document.createElement('div');
            valueContainer.classList.add('profile-stat-value-container');

            if (Array.isArray(block.value)) {
                block.value.forEach(item => {
                    const valueElement = document.createElement('div');
                    valueElement.classList.add('profile-stat-value');

                    let text = '';
                    if (item.period && block.name === 'Сообщения и Рейтинг') {
                         text = `${item.period}: ${item.count ?? 0}`;
                         if (item.average && item.count > 0) text += ` (в ср. ${item.average})`;
                         if (item.rank && item.rank !== 'N/A') text += ` (место: #${item.rank})`;
                         else if (item.rank === 'N/A') text += ` (место: -)`;
                         else text += ` (место: ?)`;
                     } else if (item.type && block.name === 'Лутбоксы') {
                         text = `${item.type}: ${item.count ?? 0}`;
                     } else if (item.label && block.name === 'Прочее') {
                         text = `${item.label}: ${item.value}`;
                     } else {
                         text = JSON.stringify(item);
                     }

                     valueElement.innerHTML = text; 

                     if (block.name === 'Сообщения и Рейтинг' && ['За все время', 'За 7 дней', 'За 30 дней'].includes(item.period) && typeof displayMessagesChart === 'function' && data.userId) {
                          valueElement.style.cursor = 'pointer';
                          valueElement.style.color = 'var(--primary-color)';
                           valueElement.dataset.chartUserid = data.userId;
                           valueElement.dataset.chartPeriod = item.period === 'За все время' ? 'all' : item.period === 'За 7 дней' ? '7days' : '30days';
                     }
                     valueContainer.appendChild(valueElement);
                 });
                } else {
                    const valueElement = document.createElement('div');
                    valueElement.classList.add('profile-stat-value');
                    valueElement.textContent = block.value ?? '';
                    valueContainer.appendChild(valueElement);
                }

                blockElement.appendChild(valueContainer);
                profileStatsContainer.appendChild(blockElement);
            });


            const userIsStaff = Array.isArray(data.roles) && allowedRoleIds.some(roleId => data.roles.includes(roleId));
            const staffTab = document.querySelector('.profile-tab[data-tab="staff"]');


            if (staffTab && staffTabContent) {
                if (userIsStaff) {
                    staffTab.style.display = 'list-item';
                    staffTabContent.innerHTML = '';
                const staffStatsBlocks = [
                    { name: 'Репутация', value: data.reputation ?? 0 },
                    {
                        name: 'Использование команд', value: [
                            { period: 'За все время', stats: `Мьютов: ${data.muteCount ?? 0}, Размьютов: ${data.unmuteCount ?? 0}, Киков: ${data.kickCount ?? 0}, Банов: ${data.banCount ?? 0}, Разбанов: ${data.unbanCount ?? 0}` },
                            { period: 'За 24 часа', stats: `Мьютов: ${data.muteCountToday ?? 0}, Размьютов: ${data.unmuteCountToday ?? 0}` },
                            { period: 'За 7 дней', stats: `Мьютов: ${data.muteCountLast7Days ?? 0}, Размьютов: ${data.unmuteCountLast7Days ?? 0}, Киков: ${data.kickCountLast7Days ?? 0}, Банов: ${data.banCountLast7Days ?? 0}, Разбанов: ${data.unbanCountLast7Days ?? 0}` },
                            { period: 'За 30 дней', stats: `Мьютов: ${data.muteCountLast30Days ?? 0}, Размьютов: ${data.unmuteCountLast30Days ?? 0}, Киков: ${data.kickCountLast30Days ?? 0}, Банов: ${data.banCountLast30Days ?? 0}, Разбанов: ${data.unbanCountLast30Days ?? 0}` }
                        ]
                    },
                    {
                        name: 'Полученные номинации', value: [
                            { period: 'За все время', count: data.nominationCount ?? 0 },
                            { period: 'Ежедневных по сообщениям', count: data.nominationCountTodayByMessages ?? 0 },
                            { period: 'Еженедельных по сообщениям', count: data.nominationCountWeekByMessages ?? 0 },
                            { period: 'Ежемесячных по сообщениям', count: data.nominationCountMonthByMessages ?? 0 },
                            { period: 'Ежедневных по мьютам', count: data.nominationCountTodayByMutes ?? 0 },
                            { period: 'Еженедельных по мьютам', count: data.nominationCountWeekByMutes ?? 0 },
                            { period: 'Ежемесячных по мьютам', count: data.nominationCountMonthByMutes ?? 0 }
                        ]
                    }
                ];

                staffStatsBlocks.forEach(block => {
                    const blockElement = document.createElement('div');
                    blockElement.classList.add('profile-stat-block');
                    const nameElement = document.createElement('div');
                    nameElement.classList.add('profile-stat-name');
                    nameElement.textContent = block.name;
                    blockElement.appendChild(nameElement);

                    if (block.name === 'Репутация') {
                        const reputationBar = createReputationBar(block.value);
                        blockElement.appendChild(reputationBar);
                    } else if (Array.isArray(block.value)) {
                        block.value.forEach(item => {
                            const valueElement = document.createElement('div');
                            valueElement.classList.add('profile-stat-value');
                            const text = item.stats
                                ? `${item.period}: ${item.stats}`
                                : `${item.period}: ${item.count ?? 0}`;
                            valueElement.textContent = text;
                            blockElement.appendChild(valueElement);
                        });
                    }
                    staffTabContent.appendChild(blockElement);
                });
            } else {
                staffTab.style.display = 'none';
                staffTabContent.innerHTML = '';
            }
       } else {
            logger.warn("Элемент вкладки стаффа или её контейнер не найдены.");
       }
    });
} 

function handleChartLinkClick(event) {
    const target = event.target.closest('.profile-stat-value[data-chart-userid]');
    if (target) {
        const userId = target.dataset.chartUserid;
        const period = target.dataset.chartPeriod;
        logger.debug(`Клик по ссылке графика: userId=${userId}, period=${period}`); 
        displayMessagesChart(userId, period);
    }
}

function displayAchievementsData(achievements) {
    if (!achievementsContainer) {
         logger.error("Контейнер achievementsContainer не найден!"); 
        return;
    }
    achievementsContainer.innerHTML = '';

    if (!Array.isArray(achievements) || achievements.length === 0) {
         logger.info("Нет данных для отображения достижений.");
        achievementsContainer.innerHTML = '<div style="text-align: center; color: var(--text-color);">Достижений пока нет.</div>';
        return;
    }



    achievements.forEach(achievement => {
        const achievementElement = document.createElement('div');
        achievementElement.classList.add('profile-achievement');
         achievementElement.title = achievement.description;

        const nameElement = document.createElement('div');
        nameElement.classList.add('profile-achievement-name');
        nameElement.textContent = achievement.description; 
        achievementElement.appendChild(nameElement);

        if (achievement.target && typeof achievement.progress === 'number') { 
             const progressContainer = document.createElement('div');
             progressContainer.classList.add('progress-bar-container');
             achievementElement.appendChild(progressContainer);

             const progressBar = document.createElement('div');
             progressBar.classList.add('progress-bar');
             const percentage = achievement.target > 0 ? (achievement.progress / achievement.target) * 100 : 0;
             progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`; 
             progressContainer.appendChild(progressBar);

             const messageCount = document.createElement('div');
             messageCount.classList.add('message-count');
             messageCount.textContent = `${achievement.progress}/${achievement.target}`;
             achievementElement.appendChild(messageCount);
        }

        if (achievement.completed) {
            nameElement.classList.add('completed'); 
            const checkmark = document.createElement('span');
            checkmark.classList.add('checkmark'); 
            checkmark.textContent = '✔';
            achievementElement.appendChild(checkmark);
            achievementElement.style.borderColor = 'var(--success-color, green)'; 
        }

        achievementsContainer.appendChild(achievementElement);
    });
    logger.debug(`Отображено ${achievements.length} достижений.`); 
}

function createMessagesChart(data, label, days) {
    logger.debug(`Создание графика: ${label}, дней: ${days}`);
    let chartCanvas = document.getElementById('messagesChart');
    let existingChart = null;
    if (chartCanvas) {
        existingChart = Chart.getChart(chartCanvas);
    }
    if (existingChart) {
        logger.debug("Уничтожаем существующий график перед созданием нового.");
        existingChart.destroy();
    }
    let chartWrapper = document.querySelector('.chart-wrapper');
    if (!chartWrapper) {
        chartWrapper = document.createElement('div');
        chartWrapper.className = 'chart-wrapper';
        chartWrapper.style.position = 'relative';
        chartWrapper.style.paddingBottom = '20px';
        const profileTabContent = document.querySelector('.profile-tab-content[data-tab="stats"]');
        if (profileTabContent) {
            profileTabContent.insertBefore(chartWrapper, profileTabContent.firstChild);
        } else {
            logger.error("Не найден контейнер .profile-tab-content[data-tab=\"stats\"] для графика");
            return;
        }
    }
    chartWrapper.innerHTML = '';
    chartCanvas = document.createElement('canvas');
    chartCanvas.id = 'messagesChart';
    chartWrapper.appendChild(chartCanvas);
    const ctx = chartCanvas.getContext('2d');
    let filteredData = data;
    if (days === 7 || days === 30) {
        filteredData = filterMessagesByDays(data, days);
    }
    const labels = Object.keys(filteredData);
    const values = Object.values(filteredData);
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: label,
                data: values,
                backgroundColor: 'rgba(0, 255, 255, 0.2)',
                borderColor: 'rgba(0, 255, 255, 1)',
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: 'rgba(0, 255, 255, 1)'
            }]
        },
        options: {
            color: '#fff',
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: '#fff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                },
                x: {
                    ticks: {
                        color: '#fff'
                    },
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#fff'
                    }
                }
            }
        }
    });
    logger.info(`График "${label}" успешно создан.`);
    addChartBackButton(chartWrapper);
}

function addChartBackButton(chartContainer) {
    let backButton = chartContainer.querySelector('.chart-back-button');
    if (!backButton) {
        backButton = document.createElement('button');
        backButton.textContent = 'Назад к Статистике';
        backButton.classList.add('button', 'secondary', 'chart-back-button');
        backButton.addEventListener('click', () => showStatsContent(true));
        chartContainer.appendChild(backButton);
    }
}

async function displayMessagesChart(userId, period) {
    logger.info(`Запрос на отображение графика: userId=${userId}, period=${period}`);
    showStatsContent(false);
    try {
        const messagesByDate = await fetchMessagesByDate(userId);
        if (!messagesByDate || typeof messagesByDate !== 'object' || Object.keys(messagesByDate).length === 0) {
            logger.error("Некорректные или пустые данные для графика:", messagesByDate);
            displayChartError('Не удалось загрузить данные для графика.');
            return;
        }
        let label = '';
        let days = 0;
        if (period === 'all') label = 'Сообщения за все время';
        else if (period === '7days') { label = 'Сообщения за последние 7 дней'; days = 7; }
        else if (period === '30days') { label = 'Сообщения за последние 30 дней'; days = 30; }
        createMessagesChart(messagesByDate, label, days);
    } catch (error) {
        logger.error("Ошибка при отображении графика:", error);
        displayChartError('Ошибка загрузки данных графика.');
    }
}

function displayChartError(message) {
    const chartWrapper = document.querySelector('.chart-wrapper');
    if (chartWrapper) {
        chartWrapper.innerHTML = '';
        const errorText = document.createElement('p');
        errorText.textContent = message;
        errorText.style.color = 'var(--error-color, red)';
        errorText.style.textAlign = 'center';
        errorText.style.padding = '20px';
        chartWrapper.appendChild(errorText);
        addChartBackButton(chartWrapper);
        showStatsContent(false);
    }
}

function showStatsContent(show) {
    const statsContent = document.querySelector('.profile-stats');
    const chartWrapper = document.querySelector('.chart-wrapper');
    if (show) {
        logger.debug("Отображение основной статистики, скрытие графика.");
        if (statsContent) statsContent.style.display = 'grid';
        if (chartWrapper) chartWrapper.style.display = 'none';
    } else {
        logger.debug("Скрытие основной статистики, отображение области графика.");
        if (statsContent) statsContent.style.display = 'none';
        let currentChartWrapper = document.querySelector('.chart-wrapper');
        if (!currentChartWrapper) {
            currentChartWrapper = document.createElement('div');
            currentChartWrapper.className = 'chart-wrapper';
            const profileTabContent = document.querySelector('.profile-tab-content[data-tab="stats"]');
            if (profileTabContent) profileTabContent.insertBefore(currentChartWrapper, profileTabContent.firstChild);
        }
        if (currentChartWrapper) currentChartWrapper.style.display = 'block';
    }
}

function filterMessagesByDays(messagesByDate, days) {
    logger.debug(`Фильтрация сообщений за ${days} дней`);
   if (!messagesByDate || typeof messagesByDate !== 'object') return {};
   if (days <= 0) return messagesByDate;

   const today = new Date();
   today.setHours(0, 0, 0, 0);
   const filteredData = {};
   const sortedKeys = [];

   for (let i = days - 1; i >= 0; i--) {
       const date = new Date(today);
       date.setDate(today.getDate() - i);
       const dateString = date.toISOString().slice(0, 10);
       sortedKeys.push(dateString);
   }

   for (const key of sortedKeys) {
       filteredData[key] = messagesByDate[key] || 0;
   }
    logger.debug("Отфильтрованные данные:", filteredData); 
   return filteredData;
}

async function fetchShopData() {
    logger.info("Запрос fetchShopData()"); 
   if (shopDataCache) {
        logger.debug("Данные магазина найдены в кэше");
       return shopDataCache;
   }
   try {
       const response = await fetch(`${BACKEND_BASE_URL}/shop`);
       if (!response.ok) {
           const errorText = await response.text();
            logger.error(`Ошибка при получении данных магазина: ${response.status}`, { detail: errorText }); 
           displayErrorMessage(`Ошибка загрузки магазина: ${response.status}`);
           throw new Error(`Ошибка при получении данных магазина: ${response.status}`);
       }
       const data = await response.json();
        logger.info("Полученные данные магазина:", data);
       shopDataCache = data;
       return data;
   } catch (error) {
        logger.error("Сетевая ошибка в fetchShopData:", error); 
        displayErrorMessage('Не удалось загрузить магазин из-за сетевой ошибки.');
       return null;
   }
}

async function displayShopData(uuid) {
    logger.info(`Запрос displayShopData для uuid: ${uuid}`);
   if (!uuid) {
        logger.error("Ошибка: uuid не определён для отображения магазина"); 
       return;
   }
   if (!shopItemsContainer) {
        logger.error("Контейнер shopItemsContainer не найден!"); 
       return;
   }

   shopItemsContainer.innerHTML = '<div style="text-align: center; padding: 20px;">Загрузка товаров...</div>';
   const discountInfoContainer = document.querySelector('.shop-discount-info');
   if (discountInfoContainer) discountInfoContainer.innerHTML = '';

   try {
        logger.debug("Параллельный запрос данных магазина и профиля..."); 
       const [shopData, profileData] = await Promise.all([
           fetchShopData(),
           fetchProfileData(uuid) 
       ]);
        logger.debug("Данные магазина и профиля получены."); 

       if (!shopData) {
           shopItemsContainer.innerHTML = '<div style="text-align: center; color: var(--error-color, red);">Не удалось загрузить товары магазина.</div>';
           return; 
       }
       if (!profileData || !profileData.userId) {
           shopItemsContainer.innerHTML = '<div style="text-align: center; color: var(--error-color, red);">Не удалось загрузить данные пользователя для магазина.</div>';
           return;
       }

       shopItemsContainer.innerHTML = '';
       const userStars = profileData.stars ?? 0;
       const userRoles = profileData.roles || [];

       const hasDiscountRole = userRoles.includes(PERMANENT_DISCOUNT_ROLE_ID_FRONTEND);

        if (discountInfoContainer) {
            discountInfoContainer.innerHTML = '';
            let discountReasonText = '';
            if (hasDiscountRole) {
                discountReasonText += 'У вас есть роль, дающая скидку 20%!';
            }
            if (discountReasonText) {
                 logger.info("Отображается информация о скидке."); 
                const discountInfoElement = document.createElement('div');
                discountInfoElement.style.color = 'var(--success-color, green)';
                discountInfoElement.style.textAlign = 'center';
                discountInfoElement.innerHTML = discountReasonText;
                discountInfoContainer.appendChild(discountInfoElement);
            }
        }

        if (shopData.length === 0) {
            logger.info("Магазин пуст."); 
           shopItemsContainer.innerHTML = '<div style="text-align: center;">Товаров в магазине пока нет.</div>';
           return;
       }

        logger.debug(`Начинаем рендеринг ${shopData.length} товаров магазина.`); 

        shopData.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.classList.add('shop-item');

            const nameElement = document.createElement('div');
            nameElement.classList.add('shop-item-name');
            nameElement.textContent = item.name;
            itemElement.appendChild(nameElement);

            const priceElement = document.createElement('div');
            priceElement.classList.add('shop-item-price');
            let originalPrice = item.price ?? 0;
            let finalPrice = originalPrice;
            let appliedDiscount = 0;
            if (hasDiscountRole) appliedDiscount += 20;

            if (appliedDiscount > 0) {
                finalPrice = Math.round(originalPrice * (1 - appliedDiscount / 100));
                priceElement.innerHTML = `<span class="strike" style="text-decoration: line-through; opacity: 0.7; margin-right: 5px;">${originalPrice} ⭐</span>`;
                const newPriceSpan = document.createElement('span');
                newPriceSpan.classList.add('new-price');
                newPriceSpan.style.color = 'var(--success-color, green)';
                newPriceSpan.style.fontWeight = 'bold';
                newPriceSpan.textContent = ` ${finalPrice} ⭐`;
                priceElement.appendChild(newPriceSpan);
            } else {
                priceElement.textContent = `${finalPrice} ⭐`;
            }
            itemElement.appendChild(priceElement);

            const stockElement = document.createElement('div');
            stockElement.classList.add('shop-item-stock');
            stockElement.textContent = `В наличии: ${item.stock === -1 ? '∞' : (item.stock ?? 0)} шт.`;
            itemElement.appendChild(stockElement);

            const buySection = document.createElement('div');
            buySection.classList.add('buy-controls');

            const buyButton = document.createElement('button');
            buyButton.classList.add('button', 'primary', 'shop-item-buy-button');
            buyButton.textContent = 'Купить';
            buyButton.disabled = userStars < finalPrice || (item.stock !== -1 && (item.stock ?? 0) <= 0);

            const quantityControls = document.createElement('div');
            quantityControls.classList.add('quantity-controls');
            quantityControls.style.marginLeft = '10px';

            const minusButton = document.createElement('button');
            minusButton.classList.add('quantity-button');
            minusButton.textContent = '-';

            const quantityValue = document.createElement('span');
            quantityValue.classList.add('quantity-value');
            quantityValue.textContent = '1';

            const plusButton = document.createElement('button');
            plusButton.classList.add('quantity-button');
            plusButton.textContent = '+';

            quantityControls.appendChild(minusButton);
            quantityControls.appendChild(quantityValue);
            quantityControls.appendChild(plusButton);

            buySection.appendChild(buyButton);
            buySection.appendChild(quantityControls);
            itemElement.appendChild(buySection);

            let quantity = 1;
            const maxQuantity = (item.stock === -1) ? Infinity : (item.stock ?? 0);

            function updateTotal() {
                quantityValue.textContent = quantity;
                const totalCost = finalPrice * quantity;
                buyButton.disabled = userStars < totalCost || quantity <= 0 || quantity > maxQuantity;
                minusButton.disabled = quantity <= 1;
                plusButton.disabled = quantity >= maxQuantity;
            }

            minusButton.addEventListener('click', () => {
                if (quantity > 1) {
                    quantity--;
                    updateTotal();
                }
            });

            plusButton.addEventListener('click', () => {
                if (quantity < maxQuantity) {
                    quantity++;
                    updateTotal();
                }
            });

            buyButton.addEventListener('click', () => buyItem(uuid, item.name, quantity));

            updateTotal();

            shopItemsContainer.appendChild(itemElement);
        });

    } catch (error) {
        logger.error("Ошибка при отображении магазина:", error); 
       if (shopItemsContainer) shopItemsContainer.innerHTML = '<div style="text-align: center; color: var(--error-color, red);">Произошла ошибка при загрузке магазина.</div>';
   }
}

async function fetchMessagesByDate(userId) {
    logger.info(`Запрос данных графика сообщений для userId: ${userId}`);
    if (!userId) {
        logger.error("fetchMessagesByDate: userId не предоставлен.");
        displayErrorMessage("Не удалось загрузить данные графика: ID пользователя не найден.");
        return null;
    }
    try {
        const response = await fetch(`${BACKEND_BASE_URL}/profile/${userId}/messagesByDate`);
        if (!response.ok) {
            let errorText = `Статус ${response.status}`;
            let errorMessage = `Ошибка ${response.status} при получении данных графика.`;
            try {
                const errorJson = await response.json(); 
                if (errorJson.error) {
                    errorMessage += ` ${errorJson.error}`; 
                    errorText = JSON.stringify(errorJson);
                }
            } catch {
                try {
                    errorText = await response.text(); 
                    errorMessage += ` ${errorText}`; 
                } catch {
                    errorText = response.statusText;
                }
            }
            logger.error(errorMessage, { detail: errorText });
            displayChartError(errorMessage);
            throw new Error(errorMessage);
        }
        const data = await response.json();
        logger.debug("Данные для графика получены:", data);
        return data;
    } catch (error) {
        logger.error("Критическая ошибка в fetchMessagesByDate:", error);
        displayChartError('Критическая ошибка загрузки данных графика.');
        return null;
    }
}

async function buyItem(uuid, itemName, quantity) {
    logger.info(`Попытка покупки: buyItem(uuid=${uuid}, item=${itemName}, qty=${quantity})`);
    try {
        let userId = localStorage.getItem('userId');
        if (!userId && cachedProfileData[uuid]) {
            userId = cachedProfileData[uuid].userId;
            logger.warn("UserId взят из кэша профиля для покупки.");
        }
        if (!userId) {
            logger.error('Ошибка покупки: Не удалось определить ID пользователя.');
            displayErrorMessage('Ошибка: Не удалось определить ID пользователя. Попробуйте обновить страницу.');
            throw new Error('User ID not found for purchase.');
        }
        logger.debug("userId для покупки:", userId);
        const response = await fetch(`${BACKEND_BASE_URL}/buy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uuid, userId, itemName, quantity }),
        });
        const result = await response.json();
        if (!response.ok) {
            logger.error("Ошибка при покупке товара (сервер):", { status: response.status, result });
            throw new Error(result.error || `Ошибка ${response.status} при покупке товара`);
        }
        logger.info("Результат покупки:", result);
        displayDepositMessage(result.message || 'Покупка прошла успешно!', 'success');
        delete cachedProfileData[uuid];
        shopDataCache = null;
        logger.info("Кэши профиля и магазина сброшены после покупки.");
        const updatedProfileData = await fetchProfileData(uuid);
        if (updatedProfileData && updatedProfileData.userId) {
            displayProfileData(updatedProfileData);
            logger.info("Данные профиля обновлены после покупки.");
        } else {
            logger.warn("Не удалось обновить данные профиля после покупки.");
        }
        await displayShopData(uuid);
        logger.info("Отображение магазина обновлено после покупки.");
    } catch (error) {
        logger.error("Ошибка в функции buyItem:", error);
        displayErrorMessage(`Ошибка покупки: ${error.message}`);
    }
}

function checkDataLoading(data, loadingTimeout) {
    if (data && data.userId) {
        logger.debug("Данные профиля загружены, очищаем таймаут загрузки.");
        clearTimeout(loadingTimeout);
        if (errorContainer) {
            errorContainer.textContent = '';
            errorContainer.style.display = 'none';
        }
    } else if (!data || !data.userId) {
        logger.warn("Таймаут загрузки профиля истек, данные не получены.");
        if (errorContainer && errorContainer.style.display !== 'block') {
            errorContainer.textContent = 'Данные не загрузились. Убедитесь, что у вас есть профиль (команда /mrank) и проверьте интернет.';
            errorContainer.style.textAlign = 'center';
            errorContainer.style.marginTop = '10px';
            errorContainer.style.display = 'block';
        }
    }
}

async function main() {
    logger.info("Запуск main() на странице профиля");
    logger.log(`%cЗдравствуйте!`, `color: #2f68dc; font-size: 1.5em; font-weight: bold;`);
    logger.warn(`%cНе изменяйте хранилище и не вводите команды в консоли.`, `font-size: 1.1em;`);
    logger.warn(`%cНЕ ДЕЛИТЕСЬ UUID И ДРУГИМИ ДАННЫМИ!`, `color:red; font-size: 1.2em; font-weight: bold;`);

    const loadingTimeout = setTimeout(() => {
        logger.warn("Сработал таймаут ожидания загрузки профиля (20 сек).");
        if (!loggedInUserProfile && errorContainer && errorContainer.style.display !== 'block') {
            errorContainer.textContent = 'Не удалось загрузить профиль за 20 секунд. Проверьте соединение или попробуйте позже.';
            errorContainer.style.display = 'block';
            if (profileHeader) profileHeader.style.display = 'none';
            const content = document.querySelector('.profile-content');
            if (content) content.style.display = 'none';
        }
    }, 20000);

    try {
        let uuid = localStorage.getItem('uuid');
        const searchParams = new URLSearchParams(window.location.search);
        const uuidFromUrl = searchParams.get('uuid');
        if (uuidFromUrl) {
            logger.info(`Найден UUID в URL: ${uuidFromUrl}`);
            if (uuid !== uuidFromUrl) {
                logger.info("UUID из URL отличается от localStorage, обновляем localStorage.");
                localStorage.setItem('uuid', uuidFromUrl);
                uuid = uuidFromUrl;
            }
        }
        if (uuid) {
            logger.info(`Используется UUID: ${uuid}`);
            const profileData = await fetchProfileData(uuid);
            clearTimeout(loadingTimeout);
            if (profileData && profileData.userId) {
                if (!localStorage.getItem('userId')) {
                    localStorage.setItem('userId', profileData.userId);
                    logger.info(`UserId ${profileData.userId} сохранен в localStorage.`);
                }
                displayProfileData(profileData);
                displayAchievementsData(profileData.achievements || []);
                if (profileStatsContainer) {
                    profileStatsContainer.addEventListener('click', handleChartLinkClick);
                    logger.debug("Добавлен обработчик кликов для статистики (графики).");
                } else {
                    logger.error("Не удалось добавить обработчик кликов для графиков: profileStatsContainer не найден.");
                }
                const allTabs = document.querySelectorAll('.profile-tab');
                const allTabContents = document.querySelectorAll('.profile-tab-content');
                let shopTabLastClicked = 0;
                let depositTabLastClicked = 0;
                if (allTabs.length > 0 && allTabContents.length > 0) {
                    logger.debug("Начинаем инициализацию вкладок");
                    const tabList = document.querySelector('.profile-tabs');
                    if (tabList) {
                        tabList.addEventListener('click', async (event) => {
                            const clickedTab = event.target.closest('.profile-tab');
                            if (!clickedTab || clickedTab.classList.contains('active') || clickedTab.style.display === 'none') {
                                return;
                            }
                            const tabId = clickedTab.dataset.tab;
                            logger.debug(`Клик по вкладке: ${tabId}`);
                            const currentUuid = localStorage.getItem('uuid');
                            if (!currentUuid) {
                                logger.error("UUID отсутствует при клике на вкладку!");
                                displayErrorMessage("Ошибка авторизации. Пожалуйста, войдите снова.");
                                return;
                            }
                            if (tabId === 'shop') {
                                const now = Date.now();
                                if (now - shopTabLastClicked < 5000) {
                                    logger.warn('Кулдаун магазина еще не прошел.');
                                    return;
                                }
                                shopTabLastClicked = now;
                            }
                            if (tabId === 'deposit') {
                                const now = Date.now();
                                if (now - depositTabLastClicked < 3000) {
                                    logger.warn('Кулдаун депозита еще не прошел.');
                                    return;
                                }
                                depositTabLastClicked = now;
                            }
                            allTabs.forEach(t => t.classList.remove('active'));
                            clickedTab.classList.add('active');
                            allTabContents.forEach(content => content.classList.add('hidden'));
                            const contentToShow = document.querySelector(`.profile-tab-content[data-tab="${tabId}"]`);
                            if (contentToShow) {
                                contentToShow.classList.remove('hidden');
                            } else {
                                logger.error(`Контент для вкладки ${tabId} не найден!`);
                            }
                            if (tabId === 'shop' && typeof displayShopData === 'function') {
                                logger.info("Загрузка данных для вкладки Магазин...");
                                await displayShopData(currentUuid);
                            } else if (tabId === 'deposit' && typeof displayDepositData === 'function') {
                                logger.info("Загрузка данных для вкладки Депозит...");
                                await displayDepositData(currentUuid);
                            }
                        });
                    } else {
                        logger.error("Не найден контейнер вкладок .profile-tabs");
                    }
                    const staffTab = document.querySelector('.profile-tab[data-tab="staff"]');
                    const firstVisibleTab = staffTab && staffTab.style.display !== 'none'
                        ? staffTab
                        : document.querySelector('.profile-tab[data-tab="stats"]');
                    if (firstVisibleTab) {
                        logger.debug(`Активируем начальную вкладку: ${firstVisibleTab.dataset.tab}`);
                        firstVisibleTab.click();
                    } else {
                        logger.error("Не удалось найти начальную вкладку для активации.");
                    }
                } else {
                    logger.error("Не найдены элементы вкладок или их содержимого для инициализации.");
                }
            } else {
                logger.warn(`Профиль для UUID ${uuid} не загружен или не содержит userId. Показываем кнопку входа.`);
                clearTimeout(loadingTimeout);
                showLoginButton();
            }
        } else {
            logger.info("UUID не найден. Показываем кнопку входа.");
            clearTimeout(loadingTimeout);
            showLoginButton();
        }
    } catch (error) {
        logger.error("Критическая ошибка в main:", error);
        clearTimeout(loadingTimeout);
        displayErrorMessage('Произошла серьезная ошибка при загрузке страницы. Попробуйте обновить.');
        if (profileHeader) profileHeader.style.display = 'none';
        const content = document.querySelector('.profile-content');
        if (content) content.style.display = 'none';
    }
}

function showLoginButton() {
    if (profileStatsContainer) profileStatsContainer.innerHTML = '';
    const staffTabContent = document.querySelector('.profile-tab-content[data-tab="staff"]');
    if (staffTabContent) staffTabContent.innerHTML = '';
    if (achievementsContainer) achievementsContainer.innerHTML = '';
    if (shopItemsContainer) shopItemsContainer.innerHTML = '';

    const loginButton = document.querySelector('.discord-login');
    if (loginButton) {
        loginButton.style.display = 'flex';
        loginButton.onclick = () => {
            window.location.href = `${BACKEND_BASE_URL}/auth/discord`;
        };
    }
}

/**
 * @param {string} message 
 * @param {'success' | 'error' | 'info'} type 
 */
function displayDepositMessage(message, type = 'info') {
    if (!depositContentArea) return;
    let messageContainer = depositContentArea.querySelector('.deposit-message');
    if (!messageContainer) {
        messageContainer = document.createElement('div');
        messageContainer.classList.add('deposit-message');
        depositContentArea.insertBefore(messageContainer, depositContentArea.firstChild);
    }
    messageContainer.textContent = message;
    messageContainer.className = `deposit-message ${type}`;
    messageContainer.style.display = 'block';
    messageContainer.style.marginTop = '15px'; 
    messageContainer.style.padding = '10px';
    messageContainer.style.borderRadius = '5px';
    messageContainer.style.textAlign = 'center';

    switch (type) {
        case 'success':
            messageContainer.style.backgroundColor = 'var(--success-bg-color, #d4edda)';
            messageContainer.style.color = 'var(--success-text-color, #155724)';
            messageContainer.style.border = '1px solid var(--success-border-color, #c3e6cb)';
            break;
        case 'error':
            messageContainer.style.backgroundColor = 'var(--error-bg-color, #f8d7da)';
            messageContainer.style.color = 'var(--error-text-color, #721c24)';
            messageContainer.style.border = '1px solid var(--error-border-color, #f5c6cb)';
            break;
        default: 
            messageContainer.style.backgroundColor = 'var(--info-bg-color, #e7f3fe)';
            messageContainer.style.color = 'var(--info-text-color, #0c5460)';
            messageContainer.style.border = '1px solid var(--info-border-color, #b8daff)';
            break;
    }
}

function clearDepositMessage() {
     if (!depositContentArea) return;
     const messageContainer = depositContentArea.querySelector('.deposit-message');
     if (messageContainer) {
         messageContainer.remove();
     }
}

/**
 * @param {string} uuid 
 * @param {string} userId 
 */
function renderMakeDepositForm(uuid, userId) {
    if (!depositContentArea) return;
    depositContentArea.innerHTML = '';
    clearDepositMessage();

    const formContainer = document.createElement('div');

    formContainer.classList.add('deposit-info-block');
    formContainer.innerHTML = `
        <h3>Открыть депозит</h3> 
        <div class="deposit-form">
            <p>Вы можете внести депозит под <strong>5% годовых</strong>. Срок хранения - <strong>30 дней</strong>. Максимальная сумма - <strong>1000 ⭐</strong>. Комиссия за внесение - <strong>2%</strong>.</p>
            <div> 
                <label for="deposit-amount">Сумма для внесения (⭐):</label>
                <input type="number" id="deposit-amount" name="amount" min="1" max="1000" placeholder="Введите сумму от 1 до 1000" required>
            </div>
            <button id="make-deposit-button" class="deposit-action-button make">Внести депозит</button>
        </div>
    `;
    depositContentArea.appendChild(formContainer);

    const makeButton = depositContentArea.querySelector('#make-deposit-button');
    const amountInput = depositContentArea.querySelector('#deposit-amount');

    if (makeButton && amountInput) {
        makeButton.addEventListener('click', async () => {
            const amount = parseInt(amountInput.value, 10);
            clearDepositMessage();

            if (isNaN(amount) || amount <= 0) {
                displayDepositMessage('Введите корректную положительную сумму.', 'error');
                return;
            }
            if (amount > 1000) {
                displayDepositMessage('Максимальная сумма депозита 1000 ⭐.', 'error');
                return;
            }

            makeButton.disabled = true;
            makeButton.textContent = 'Обработка...';

            try {
                await handleMakeDeposit(uuid, userId, amount);
            } catch (error) {
                console.error("Ошибка при клике 'Внести депозит':", error);
                 if(makeButton) { 
                    makeButton.disabled = false;
                    makeButton.textContent = 'Внести депозит';
                 }
            }
        });
    } else {
        console.error("Не удалось найти элементы формы депозита для добавления обработчика");
    }
}

/**
 * @param {string} uuid
 * @param {string} userId 
 * @param {object} depositInfo 
 */
function renderActiveDepositInfo(uuid, userId, depositInfo) {
    if (!depositContentArea) return;
    depositContentArea.innerHTML = '';
    clearDepositMessage();

    const depositDate = new Date(depositInfo.depositDate);
    const formattedDate = depositDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const formattedTime = depositDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const interestRatePercent = (depositInfo.interestRate * 100).toFixed(0);

    const withdrawalAvailableDate = new Date(depositDate);
    withdrawalAvailableDate.setDate(withdrawalAvailableDate.getDate() + 30);
    const formattedWithdrawalDate = withdrawalAvailableDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const infoContainer = document.createElement('div');
    infoContainer.classList.add('deposit-info-block');
    infoContainer.innerHTML = `
        <h3>Активный депозит</h3> 
        <div class="deposit-details">
            <p><strong>Начальная сумма:</strong> <span>${depositInfo.initialAmount.toFixed(2)} ⭐</span></p>
            <p><strong>Дата внесения:</strong> <span>${formattedDate} ${formattedTime}</span></p>
            <p><strong>Ставка:</strong> <span>${interestRatePercent}% годовых</span></p>
            <p><strong>Прошло месяцев:</strong> <span>${depositInfo.monthsPassed}</span></p>
            <p><strong>Текущая сумма:</strong> <span>${depositInfo.currentAmount.toFixed(2)} ⭐</span></p>
            <p><strong>Статус вывода:</strong> ${depositInfo.canWithdraw
                ? '<span style="color: var(--success-color, green);">✅ Доступно</span>'
                : `<span style="color: var(--error-color, red);">❌ Доступно с ${formattedWithdrawalDate}</span>`}</p>
        </div>
        ${depositInfo.canWithdraw
           ? '<button id="withdraw-deposit-button" class="deposit-action-button withdraw">Вывести депозит</button>'
           : '<p style="text-align: center; color: var(--text-color-secondary); font-size: 0.9rem; margin-top: 20px;">Вывод средств будет доступен через 30 дней после внесения.</p>' 
         }
    `;
    depositContentArea.appendChild(infoContainer);

    const withdrawButton = depositContentArea.querySelector('#withdraw-deposit-button');
    if (withdrawButton) {
        withdrawButton.addEventListener('click', async () => {
             clearDepositMessage();
             withdrawButton.disabled = true;
             withdrawButton.textContent = 'Обработка...';

             try {
                 await handleWithdrawDeposit(uuid, userId);
             } catch (error) {
                 console.error("Ошибка при клике 'Вывести депозит':", error);
                 if(withdrawButton) { 
                    withdrawButton.disabled = false;
                    withdrawButton.textContent = 'Вывести депозит';
                 }
             }
        });
    }
}

/**
 * @param {string} uuid 
 */
async function displayDepositData(uuid) {
    console.log(`Загрузка данных депозита для ${uuid}`);
    if (!depositContentArea) {
        console.error('Контейнер deposit-content-area не найден!');
        return;
    }
    if (!uuid) {
         depositContentArea.innerHTML = ''; 
         displayDepositMessage('Ошибка: Необходима авторизация для просмотра депозита.', 'error');
         return;
    }

     let userId = localStorage.getItem('userId');
     if (!userId && cachedProfileData[uuid]) {
          userId = cachedProfileData[uuid].userId;
          console.log("userId взят из кэша профиля:", userId);
     }

     if (!userId) {
        console.log("userId не найден, пытаемся загрузить профиль...");
        try {
            const profile = await fetchProfileData(uuid);
            if (profile && profile.userId) {
                userId = profile.userId;
                localStorage.setItem('userId', userId); 
                console.log("userId получен из fetchProfileData и сохранен:", userId);
            } else {
                 depositContentArea.innerHTML = '';
                 displayDepositMessage('Не удалось получить ID пользователя. Авторизуйтесь снова.', 'error');
                 console.error("Не удалось извлечь userId из fetchProfileData");
                 return; 
            }
        } catch (error) {
             depositContentArea.innerHTML = '';
             displayDepositMessage('Ошибка при получении данных пользователя для депозита.', 'error');
             console.error("Ошибка fetchProfileData при получении userId:", error);
             return; 
        }
     }

     depositContentArea.innerHTML = '<div class="loading" style="text-align: center; padding: 20px;">Загрузка информации о депозите...</div>';
     clearDepositMessage(); 

    try {
        const response = await fetch(`${BACKEND_BASE_URL}/deposit/${uuid}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `Ошибка ${response.status}`);
        }

        depositContentArea.innerHTML = '';

        if (data.activeDeposit) {
            renderActiveDepositInfo(uuid, userId, data.activeDeposit);
        } else {
            renderMakeDepositForm(uuid, userId);
        }

    } catch (error) {
        console.error('Ошибка при получении или отображении данных депозита:', error);
        depositContentArea.innerHTML = ''; 
        displayDepositMessage(`Ошибка загрузки депозита: ${error.message}`, 'error');
    }
}

/**
 * @param {string} uuid 
 * @param {string} userId 
 * @param {number} amount 
 */
async function handleMakeDeposit(uuid, userId, amount) {
     console.log(`Отправка запроса на создание депозита: uuid=${uuid}, userId=${userId}, amount=${amount}`);
     if (!userId) {
         displayDepositMessage('Критическая ошибка: ID пользователя не найден для запроса.', 'error');
         throw new Error('userId is missing for make deposit request');
     }
     try {
         const response = await fetch(`${BACKEND_BASE_URL}/deposit/make`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ uuid, userId, amount }),
         });

         const result = await response.json();

         if (!response.ok) {
             throw new Error(result.error || `Ошибка сервера ${response.status}`);
         }

         displayDepositMessage(result.message, 'success');

         delete cachedProfileData[uuid];
         console.log("Кэш профиля сброшен после внесения депозита.");

         const balanceElement = document.querySelector('.profile-stat-value-container .profile-stat-value');
         if (balanceElement && result.newBalance !== undefined) {
              balanceElement.textContent = `${result.newBalance.toFixed(2)} ⭐`;
              console.log("Визуальный баланс звезд обновлен.");
         }

         await new Promise(resolve => setTimeout(resolve, 1500));

         await displayDepositData(uuid);

     } catch (error) {
          console.error('Ошибка API при внесении депозита:', error);
          displayDepositMessage(`Ошибка: ${error.message}`, 'error');
          throw error;
     }
}

/**
 * @param {string} uuid 
 * @param {string} userId
 */
async function handleWithdrawDeposit(uuid, userId) {
     console.log(`Отправка запроса на вывод депозита: uuid=${uuid}, userId=${userId}`);
      if (!userId) {
         displayDepositMessage('Критическая ошибка: ID пользователя не найден для запроса.', 'error');
         throw new Error('userId is missing for withdraw deposit request');
     }
     try {
         const response = await fetch(`${BACKEND_BASE_URL}/deposit/withdraw`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ uuid, userId }),
         });

         const result = await response.json();

         if (!response.ok) {
             throw new Error(result.error || `Ошибка сервера ${response.status}`);
         }

         displayDepositMessage(result.message, 'success');

         delete cachedProfileData[uuid];
         console.log("Кэш профиля сброшен после вывода депозита.");

         const balanceElement = document.querySelector('.profile-stat-value-container .profile-stat-value'); 
          if (balanceElement && result.newBalance !== undefined) {
              balanceElement.textContent = `${result.newBalance.toFixed(2)} ⭐`;
              console.log("Визуальный баланс звезд обновлен.");
         }

         await new Promise(resolve => setTimeout(resolve, 1500));

         await displayDepositData(uuid);

     } catch (error) {
          console.error('Ошибка API при выводе депозита:', error);
          displayDepositMessage(`Ошибка: ${error.message}`, 'error');
          throw error;
     }
}

main();
}); 