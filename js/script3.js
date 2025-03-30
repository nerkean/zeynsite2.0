document.addEventListener('DOMContentLoaded', function() {
    const isDevelopment = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    const logger = {
        log: (...args) => { if (isDevelopment) console.log(...args); },
        info: (...args) => { if (isDevelopment) console.info(...args); },
        warn: (...args) => { console.warn(...args); },
        error: (...args) => { console.error(...args); },
        debug: (...args) => { if (isDevelopment) console.debug(...args); }
    };

    const loginButton = document.querySelector('.discord-login');
    const rankMessagesEl = document.getElementById('user-rank-messages');
    const rankVoiceEl = document.getElementById('user-rank-voice');
    const rankStarsEl = document.getElementById('user-rank-stars');
    const errorDivGlobal = document.getElementById('general-error'); 

    let loggedInUserProfile = null;
    let countdownInterval = null; 

    function displayErrorMessage(message, errorObject = null) {
        logger.error("Сообщение об ошибке для пользователя:", message, errorObject || ''); 
        if (errorDivGlobal) {
            errorDivGlobal.textContent = message;
            errorDivGlobal.style.display = 'block';
        } else {
             logger.warn("Не найден #general-error, используем alert для сообщения:", message);
        }
    }

    function formatVoiceTime(seconds) {
        if (seconds === undefined || seconds === null || isNaN(seconds)) { return '0 сек'; }
        const totalSeconds = Math.floor(seconds);
        if (totalSeconds <= 0) return '0 сек';
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const remainingSeconds = totalSeconds % 60;
        let result = '';
        if (days > 0) result += `${days} д `;
        if (hours > 0) result += `${hours} ч `;
        if (minutes > 0) result += `${minutes} мин `;
        if (days === 0 && hours === 0 && minutes === 0 && remainingSeconds >= 0) {
             result += `${remainingSeconds} сек`;
         }
         else if (result === '' && totalSeconds > 0) {
             result = `${totalSeconds} сек`;
         }
        return result.trim() || '0 сек';
    }

    function startCountdown(milliseconds) {
        const countdownElement = document.getElementById('countdown');
        if (!countdownElement) {
             logger.warn("Элемент #countdown для таймера не найден.");
            return;
        }

        clearInterval(countdownInterval); 
        let timeLeft = Math.max(0, Math.floor(milliseconds / 1000)); 
        logger.info(`Запуск таймера обратного отсчета: ${timeLeft} секунд.`); 

        function updateTimer() {
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                countdownElement.textContent = 'Обновление...';
                 logger.info("Таймер завершен, инициализация обновления лидербордов.");
                setTimeout(initializeLeaderboards, 1000);
                return;
            }
            const minutes = Math.floor(timeLeft / 60);
            const seconds = Math.floor(timeLeft % 60);
            countdownElement.textContent = `Обновление данных через: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            timeLeft -= 1;
        }
        updateTimer(); 
        countdownInterval = setInterval(updateTimer, 1000);
    }


    async function fetchLeaderboardData(sortBy) {
         logger.debug(`Запрос данных лидерборда: sortBy=${sortBy}`);
        try {
            const backendUrl = 'https://api.bandazeyna.com'; 
            const response = await fetch(`${backendUrl}/leaderboard?sortBy=${sortBy}`);

            if (!response.ok) {
                 let errorText = `Статус ${response.status}`;
                 try { errorText = await response.text(); } catch { }
                throw new Error(`Ошибка загрузки лидерборда (${sortBy}): ${errorText}`);
            }
            const { data, nextUpdateIn } = await response.json();

            if (sortBy === 'messages' && typeof startCountdown === 'function') {
                startCountdown(nextUpdateIn);
            }

            logger.debug(`Лидерборд ${sortBy} успешно загружен, записей: ${data?.length ?? 0}`); 
            return data || []; 

        } catch (error) {
            logger.error(`Ошибка при получении лидерборда ${sortBy}:`, error);
            const leaderboardDiv = document.querySelector(`.leaderboard-${sortBy === 'voiceTime' ? 'voice' : sortBy}`);
            if (leaderboardDiv) {
                let errorP = leaderboardDiv.querySelector('.leaderboard-error');
                if (!errorP) {
                    errorP = document.createElement('p');
                    errorP.className = 'leaderboard-error';
                    errorP.style.color = 'var(--error-color, red)';
                    errorP.style.textAlign = 'center';
                    const h2 = leaderboardDiv.querySelector('h2');
                    if (h2) h2.after(errorP);
                    else leaderboardDiv.prepend(errorP);
                }
                errorP.textContent = 'Ошибка загрузки данных';
            }
            return [];
        }
    }

    function displayLeaderboardData(data, tableId) {
        const leaderboardTableBody = document.querySelector(`#${tableId} tbody`);
        if (!leaderboardTableBody) {
            logger.error(`Не найдено тело таблицы с ID: ${tableId}`); 
            return;
        }
        leaderboardTableBody.innerHTML = '';

        if (!Array.isArray(data) || data.length === 0) {
            logger.warn(`Нет данных для отображения в таблице ${tableId}`);
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3; 
            cell.textContent = 'Данные отсутствуют';
            cell.style.textAlign = 'center';
            row.appendChild(cell);
            leaderboardTableBody.appendChild(row);
            return;
        }

        data.forEach((user, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="#">${index + 1}</td>
                <td data-label="Пользователь">${user.username || 'N/A'}</td>
                <td data-label="${tableId === 'voice-leaderboard' ? 'Время' : (tableId === 'stars-leaderboard' ? 'Звёзды' : 'Сообщения')}">
                    ${ tableId === 'voice-leaderboard'
                        ? formatVoiceTime(user.voiceTime)
                        : ( tableId === 'stars-leaderboard'
                            ? `${Math.round(user.stars ?? 0)} ⭐`
                            : (user.totalMessages ?? user.messages ?? 0)
                          )
                    }
                </td>
            `;
            if (user.username === 'zaqush') {
                row.classList.add('zaqush-row');
            }
            leaderboardTableBody.appendChild(row);
        });
         logger.debug(`Таблица ${tableId} заполнена ${data.length} записями.`); 
    }

    async function initializeLeaderboards() {
         logger.info("Инициализация загрузки лидербордов..."); 
        if (errorDivGlobal) errorDivGlobal.style.display = 'none';
        try {
            const [messagesData, voiceData, starsData] = await Promise.all([
                fetchLeaderboardData('messages'),
                fetchLeaderboardData('voiceTime'),
                fetchLeaderboardData('stars')
            ]);
            displayLeaderboardData(messagesData, 'messages-leaderboard');
            displayLeaderboardData(voiceData, 'voice-leaderboard');
            displayLeaderboardData(starsData, 'stars-leaderboard');
             logger.info("Все лидерборды успешно загружены и отображены."); 
        } catch (error) {
             logger.error("Критическая ошибка при инициализации лидербордов:", error); 
            displayErrorMessage('Не удалось загрузить таблицы лидеров.');
        }
    }

    async function fetchProfileData(uuid) {
         logger.info(`Запрос профиля fetchProfileData для uuid: ${uuid}`); 
        if (loggedInUserProfile && loggedInUserProfile.uuid === uuid) {
             logger.debug("Возвращаем закэшированный профиль."); 
            return loggedInUserProfile;
        }
         logger.debug("Кэш профиля пуст или uuid изменился, запрашиваем с бэкенда."); 

        try {
             const backendUrl = 'https://api.bandazeyna.com';
            const response = await fetch(`${backendUrl}/profile/${uuid}`);

            if (!response.ok) {
                let errorMessage = `Ошибка ${response.status} при загрузке профиля (${uuid}).`;
                let errorDetail = null;
                 try { errorDetail = await response.json(); } 
                 catch { try { errorDetail = await response.text(); } catch {}} 

                if (response.status === 404) errorMessage = 'Профиль не найден.';

                 logger.error(errorMessage, { status: response.status, detail: errorDetail }); 
                throw new Error(errorMessage); 
            }
            const data = await response.json();
            loggedInUserProfile = data; 
             logger.info(`Профиль для uuid ${uuid} успешно загружен и закэширован.`); 
            return data;
        } catch (error) {
            logger.error(`Ошибка в fetchProfileData для uuid ${uuid}:`, error); 
            return null; 
        }
    }

    function showLoginButton() {
         logger.info("Пользователь не авторизован, показываем кнопку входа."); 
        if (loginButton) {
            loginButton.style.display = 'inline-flex'; 
            loginButton.onclick = () => {
                 const backendUrl = 'https://api.bandazeyna.com'; 
                window.location.href = `${backendUrl}/auth/discord`;
            };
        } else {
             logger.warn("Кнопка входа .discord-login не найдена на странице."); 
        }

        if (rankMessagesEl) rankMessagesEl.style.display = 'none';
        if (rankVoiceEl) rankVoiceEl.style.display = 'none';
        if (rankStarsEl) rankStarsEl.style.display = 'none';
    }

    async function main() {
         logger.info("Запуск main() на странице лидербордов"); 
         logger.info(`%cДобро пожаловать!`, `color: #2f68dc; font-size: 1.5em; font-weight: bold;`); 

        await initializeLeaderboards(); 

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
             logger.info(`Найден UUID (${uuid}), загрузка профиля для отображения рангов...`); 
            const profileData = await fetchProfileData(uuid);

            if (profileData && profileData.userId) {
                 logger.info(`Профиль ${profileData.username} (uuid: ${uuid}) успешно загружен.`); 

                if (loginButton && loginButton.style.display !== 'none') {
                     loginButton.style.display = 'none';
                 }

                 logger.debug("Отображение рангов из профиля:", {
                     messages: profileData.userRankAllTime,
                     voice: profileData.userRankVoiceTime,
                     stars: profileData.userRankStars
                 }); 

                if (rankMessagesEl) {
                    rankMessagesEl.textContent = profileData.userRankAllTime ? `Ваше место в топе: ${profileData.userRankAllTime}` : 'Ваше место в топе: нет данных';
                    rankMessagesEl.style.display = 'block';
                }
                if (rankVoiceEl) {
                    rankVoiceEl.textContent = profileData.userRankVoiceTime ? `Ваше место в топе: ${profileData.userRankVoiceTime}` : 'Ваше место в топе: нет данных';
                    rankVoiceEl.style.display = 'block';
                }
                if (rankStarsEl) {
                    rankStarsEl.textContent = profileData.userRankStars ? `Ваше место в топе: ${profileData.userRankStars}` : 'Ваше место в топе: нет данных';
                    rankStarsEl.style.display = 'block';
                }

            } else {
                 logger.warn(`Профиль для UUID ${uuid} не загружен или не содержит userId. Показываем кнопку входа.`); 
                showLoginButton();
            }
        } else {
             logger.info("UUID не найден ни в localStorage, ни в URL. Показываем кнопку входа."); 
            showLoginButton();
        }
    }

    main();

}); 