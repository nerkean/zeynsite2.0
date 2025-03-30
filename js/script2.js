document.addEventListener('DOMContentLoaded', function() {
    const isDevelopment = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

    const logger = {
        log: (...args) => { if (isDevelopment) console.log(...args); },
        info: (...args) => { if (isDevelopment) console.info(...args); },
        warn: (...args) => { console.warn(...args); },
        error: (...args) => { console.error(...args); },
        debug: (...args) => { if (isDevelopment) console.debug(...args); }
    };

    const FRONTEND_INDEX_URL = 'https://bandazeyna.com';
    const BACKEND_BASE_URL = 'https://api.bandazeyna.com';

    const learnMoreButtons = document.querySelectorAll('.learn-more-btn');
    const loginPromptOverlay = document.getElementById('loginPromptOverlay');
    let modalTimeoutId = null;

    const bodyClasses = document.body.classList;
    const isProfilePage = bodyClasses.contains('profile-page');
    const isTosPage = bodyClasses.contains('tos-page');
    const isPrivacyPage = bodyClasses.contains('privacy-page');

    if (isProfilePage || isTosPage || isPrivacyPage) {
        let pageType = 'unknown';
        if (isProfilePage) pageType = 'profile';
        else if (isTosPage) pageType = 'ToS';
        else if (isPrivacyPage) pageType = 'Privacy Policy';
        logger.info(`AOS check and initialization skipped on ${pageType} page.`);
    } else {
        if (typeof AOS !== 'undefined') {
            logger.info('Initializing AOS...');
            let aosSettings = {};
            if (bodyClasses.contains('bot-page')) {
                logger.info('Applying custom AOS settings for bot page.');
                aosSettings = {
                    once: true,
                    duration: 600,
                    offset: 50
                };
            } else {
                logger.info('Applying default AOS settings.');
            }
            AOS.init(aosSettings);
            logger.info('AOS initialized with settings:', { settings: aosSettings });
        } else {
            logger.error('AOS library not loaded before initialization attempt! (on a page where it was expected)');
        }
    }

    function showLoginPrompt() {
        if (loginPromptOverlay && !loginPromptOverlay.classList.contains('active')) {
            logger.debug('Showing login prompt modal.');
            loginPromptOverlay.classList.add('active');
            if (modalTimeoutId) {
                clearTimeout(modalTimeoutId);
            }
            modalTimeoutId = setTimeout(hideLoginPrompt, 5000);
        } else if (!loginPromptOverlay) {
            logger.error("Modal overlay element (#loginPromptOverlay) not found!");
        }
    }

    function hideLoginPrompt() {
        if (loginPromptOverlay && loginPromptOverlay.classList.contains('active')) {
            logger.debug('Hiding login prompt modal.');
            loginPromptOverlay.classList.remove('active');
            if (modalTimeoutId) {
                clearTimeout(modalTimeoutId);
                modalTimeoutId = null;
            }
        }
    }

    if (learnMoreButtons.length > 0) {
        logger.info(`Found ${learnMoreButtons.length} Learn More buttons.`);
        const urlParams = new URLSearchParams(window.location.search);
        const uuidFromUrl = urlParams.get('uuid');
        const uuidFromLocalStorage = localStorage.getItem('uuid');
        const isLoggedIn = uuidFromUrl || uuidFromLocalStorage;
        logger.info('Login Status Check:', { uuidFromUrl, uuidFromLocalStorage, isLoggedIn });

        learnMoreButtons.forEach(button => {
            if (!isLoggedIn) {
                logger.info("User not logged in. Setting up modal prompt for a button.");
                button.classList.add('disabled');
                button.addEventListener('click', function(event) {
                    logger.debug("Learn More button clicked while not logged in.");
                    event.preventDefault();
                    logger.debug("Default action prevented.");
                    showLoginPrompt();
                });
            } else {
                logger.info("User is logged in. Learn More button is active.");
                button.classList.remove('disabled');
            }
        });
    }

    if (loginPromptOverlay) {
        loginPromptOverlay.addEventListener('click', function(event) {
            if (event.target === loginPromptOverlay) {
                hideLoginPrompt();
            }
        });
    }

    const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
    const primaryNavigation = document.querySelector('#primary-navigation');
    const discordLoginButton = document.querySelector('.discord-login');
    const navList = document.querySelector('#primary-navigation ul');
    let logoutButton = null;
    let profileItemElement = null;

    if (mobileNavToggle) {
        mobileNavToggle.addEventListener('click', () => {
            const isExpanded = mobileNavToggle.getAttribute('aria-expanded') === 'true' || false;
            mobileNavToggle.classList.toggle('open');
            mobileNavToggle.setAttribute('aria-expanded', !isExpanded);
            primaryNavigation.classList.toggle('open');
        });
    }

    let backToTopBtn = document.getElementById("backToTopBtn");
    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', scrollToTop);
    }

    if (discordLoginButton) {
        discordLoginButton.addEventListener('click', () => {
            window.location.href = `${BACKEND_BASE_URL}/auth/discord`;
        });
    }

    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    window.onscroll = function() { scrollFunction() };
    function scrollFunction() {
        if (backToTopBtn) {
            if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
                backToTopBtn.style.display = "block";
            } else {
                backToTopBtn.style.display = "none";
            }
        }
    }

    function updateNavigation(avatarUrl, username) {
        if (discordLoginButton && discordLoginButton.parentNode) {
            discordLoginButton.parentNode.removeChild(discordLoginButton);
        }
        const profileItem = document.createElement('li');
        profileItem.classList.add('discord-profile-nav');
        profileItem.style.cursor = 'pointer';
        profileItem.style.paddingLeft = '10px';
        profileItem.style.marginLeft = '1px';
        const avatarImg = document.createElement('img');
        avatarImg.src = avatarUrl;
        avatarImg.alt = `Аватар пользователя ${username}`;
        const usernameSpan = document.createElement('span');
        usernameSpan.textContent = username;
        profileItem.appendChild(avatarImg);
        profileItem.appendChild(usernameSpan);
        if (navList) {
            navList.appendChild(profileItem);
        } else {
            logger.error("Элемент #primary-navigation ul не найден для добавления профиля.");
        }
        profileItemElement = profileItem;
        addProfileClickListener();
    }

    function addProfileClickListener() {
        if (profileItemElement) {
            profileItemElement.addEventListener('click', toggleLogoutButton);
        }
    }

    function toggleLogoutButton() {
        if (!logoutButton) {
            logoutButton = document.createElement('button');
            logoutButton.textContent = 'Выход';
            logoutButton.classList.add('logout-button-nav');
            logoutButton.addEventListener('click', logout2);
            if (profileItemElement && profileItemElement.parentNode) {
                profileItemElement.parentNode.insertBefore(logoutButton, profileItemElement.nextSibling);
                setTimeout(() => {
                    logoutButton.classList.add('show');
                }, 10);
            }
        } else {
            if (logoutButton.parentNode) {
                logoutButton.remove();
            }
            logoutButton = null;
        }
    }

    function logout2() {
        localStorage.removeItem('uuid');
        localStorage.removeItem('userId');
        logger.info("Выход из аккаунта");
        window.location.href = FRONTEND_INDEX_URL;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const uuidFromUrl = urlParams.get('uuid');
    const uuidFromLocalStorage = localStorage.getItem('uuid');
    const isLoggedIn = uuidFromUrl || uuidFromLocalStorage;
    const effectiveUuid = uuidFromUrl !== null ? uuidFromUrl : (uuidFromLocalStorage !== null ? uuidFromLocalStorage : null);

    const initialStyle = document.createElement('style');
    if (!isLoggedIn) {
        initialStyle.textContent = `header nav ul li button.discord-login { display: inline-block !important; } header nav ul li.discord-profile-nav { display: none !important; }`;
    } else {
        initialStyle.textContent = `header nav ul li button.discord-login { display: none !important; } header nav ul li.discord-profile-nav { display: flex !important; }`;
    }
    document.head.appendChild(initialStyle);

    logger.info("Проверка состояния входа", { uuidFromUrl, uuidFromLocalStorage, isLoggedIn, effectiveUuid });

    if (isLoggedIn) {
        if (uuidFromUrl !== null && uuidFromUrl !== uuidFromLocalStorage) {
            logger.info(`Сохранение нового uuid ${uuidFromUrl} из URL в localStorage.`);
            localStorage.setItem('uuid', uuidFromUrl);
        }
        fetchDiscordId(effectiveUuid);
    } else if (discordLoginButton) {
        logger.info("Пользователь не вошел, показываем кнопку входа.");
        discordLoginButton.style.display = 'inline-flex';
    }

    async function fetchDiscordId(uuid) {
        logger.info(`Получение Discord ID для uuid: ${uuid}`);
        try {
            const response = await fetch(`${BACKEND_BASE_URL}/discord-id?uuid=${uuid}`);
            if (response.ok) {
                const userId = await response.text();
                logger.info(`Получен Discord ID: ${userId} для uuid: ${uuid}`);
                localStorage.setItem('userId', userId);
                fetchUserData(userId);
            } else {
                logger.error(`Не удалось получить Discord ID по UUID ${uuid}. Статус: ${response.status}`);
                if (discordLoginButton) {
                    discordLoginButton.style.display = 'inline-flex';
                }
            }
        } catch (error) {
            logger.error(`Сетевая ошибка при получении Discord ID для uuid ${uuid}:`, error);
            if (discordLoginButton) {
                discordLoginButton.style.display = 'inline-flex';
            }
        }
    }

    async function fetchUserData(userId) {
        logger.info(`Получение данных пользователя для userId: ${userId}`);
        try {
            const nickResponse = await fetch(`${BACKEND_BASE_URL}/nick?userId=${userId}`);
            const avatarResponse = await fetch(`${BACKEND_BASE_URL}/avatar?userId=${userId}`);
            if (nickResponse.ok && avatarResponse.ok) {
                const username = await nickResponse.text();
                const avatarUrl = await avatarResponse.text();
                logger.info(`Получены данные пользователя: ${username}`);
                updateNavigation(avatarUrl, username);
            } else {
                logger.error(`Не удалось получить никнейм (${nickResponse.status}) или аватар (${avatarResponse.status}) для userId: ${userId}`);
                if (discordLoginButton) {
                    discordLoginButton.style.display = 'inline-flex';
                }
            }
        } catch (error) {
            logger.error(`Сетевая ошибка при получении данных пользователя userId ${userId}:`, error);
            if (discordLoginButton) {
                discordLoginButton.style.display = 'inline-flex';
            }
        }
    }
});
