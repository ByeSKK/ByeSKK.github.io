/* ============================================================
   app.js — Главный модуль приложения RP Planet
   Инициализация, координация модулей, управление состоянием
   ============================================================ */

const App = (() => {
    'use strict';

    // ==========================================
    // ПРИВАТНЫЕ ПЕРЕМЕННЫЕ
    // ==========================================

    /** DOM-элементы (кэш) */
    let _elements = {};

    /** Текущее состояние приложения */
    let _state = {
        isLoaded: false,
        isLoading: true,
        selectedCountryId: null,
        currentZoom: 1,
        currentTheme: 'light',
        isFullscreen: false,
        isPanelOpen: false,
        errors: []
    };

    /** История действий (для undo/redo при необходимости) */
    let _actionHistory = [];

    /** Таймеры */
    let _timers = {};

    // ==========================================
    // КЭШИРОВАНИЕ DOM-ЭЛЕМЕНТОВ
    // ==========================================

    /**
     * Кэширует все необходимые DOM-элементы
     */
    function _cacheElements() {
        _elements = {
            // Основные контейнеры
            app: document.getElementById('app'),
            loadingScreen: document.getElementById('loading-screen'),
            main: document.getElementById('main'),

            // Верхняя панель
            topbar: document.getElementById('topbar'),
            searchInput: document.getElementById('searchInput'),
            resetZoomBtn: document.getElementById('resetZoom'),
            fullscreenBtn: document.getElementById('fullscreenButton'),

            // Карта
            mapContainer: document.getElementById('map-container'),
            zoomContainer: document.getElementById('zoom-container'),
            svgContainer: document.getElementById('svg-container'),

            // Панель информации
            countryPanel: document.getElementById('country-panel'),
            countryPlaceholder: document.getElementById('country-placeholder'),
            countryInfo: document.getElementById('country-info'),
            countryFlag: document.getElementById('countryFlag'),
            countryName: document.getElementById('countryName'),
            countryCapital: document.getElementById('countryCapital'),
            countryLeader: document.getElementById('countryLeader'),
            countryIdeology: document.getElementById('countryIdeology'),
            countryPopulation: document.getElementById('countryPopulation'),
            countryArmy: document.getElementById('countryArmy'),
            countryEconomy: document.getElementById('countryEconomy'),
            countryAlliance: document.getElementById('countryAlliance'),
            countryDescription: document.getElementById('countryDescription'),

            // Управление картой
            mapControls: document.getElementById('map-controls'),
            zoomInBtn: document.getElementById('zoomIn'),
            zoomOutBtn: document.getElementById('zoomOut'),

            // Статусбар
            statusbar: document.getElementById('statusbar'),
            selectedCountryText: document.getElementById('selectedCountry'),
            zoomValue: document.getElementById('zoomValue')
        };

        console.log('[App] DOM-элементы закэшированы');
    }

    /**
     * Проверяет наличие всех критических элементов
     * @returns {boolean} все ли элементы найдены
     */
    function _validateElements() {
        const criticalElements = [
            'app', 'loadingScreen', 'mapContainer', 
            'svgContainer', 'searchInput', 'countryPanel'
        ];

        const missing = [];

        criticalElements.forEach(key => {
            if (!_elements[key]) {
                missing.push(key);
            }
        });

        if (missing.length > 0) {
            console.error('[App] Отсутствуют критические DOM-элементы:', missing);
            _state.errors.push(`Отсутствуют элементы: ${missing.join(', ')}`);
            return false;
        }

        return true;
    }

    // ==========================================
    // УПРАВЛЕНИЕ СОСТОЯНИЕМ
    // ==========================================

    /**
     * Обновляет состояние приложения
     * @param {object} newState - частичное обновление состояния
     */
    function _updateState(newState) {
        const oldState = { ..._state };
        _state = { ..._state, ...newState };

        // Логируем изменения (только в dev-режиме)
        if (window.DEBUG_MODE) {
            console.log('[App] Состояние обновлено:', {
                old: oldState,
                new: _state,
                changed: Object.keys(newState)
            });
        }
    }

    /**
     * Получить текущее состояние
     * @returns {object} копия состояния
     */
    function getState() {
        return { ..._state };
    }

    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ МОДУЛЕЙ
    // ==========================================

    /**
     * Проверяет доступность всех необходимых модулей
     * @returns {boolean}
     */
    function _checkModules() {
        const requiredModules = [
            { name: 'DataManager', obj: window.DataManager },
            { name: 'MapManager', obj: window.MapManager },
            { name: 'PanelManager', obj: window.PanelManager },
            { name: 'SearchManager', obj: window.SearchManager },
            { name: 'ZoomManager', obj: window.ZoomManager },
            { name: 'Utils', obj: window.Utils }
        ];

        const missing = [];

        requiredModules.forEach(module => {
            if (!module.obj) {
                missing.push(module.name);
                console.warn(`[App] Модуль ${module.name} не найден`);
            }
        });

        if (missing.length > 0) {
            _state.errors.push(`Отсутствуют модули: ${missing.join(', ')}`);
            _showError(`Не удалось загрузить модули: ${missing.join(', ')}`);
            return false;
        }

        console.log('[App] Все модули доступны');
        return true;
    }

    /**
     * Инициализирует все модули приложения
     */
    async function _initModules() {
        console.log('[App] Инициализация модулей...');

        try {
            // 1. Инициализация панели
            if (window.PanelManager && window.PanelManager.init) {
                PanelManager.init({
                    panel: _elements.countryPanel,
                    placeholder: _elements.countryPlaceholder,
                    infoContainer: _elements.countryInfo,
                    onClose: () => _handlePanelClose()
                });
            }

            // 2. Инициализация поиска
            if (window.SearchManager && window.SearchManager.init) {
                SearchManager.init({
                    searchInput: _elements.searchInput,
                    onSelect: (countryId) => _handleCountrySelect(countryId),
                    onSearch: (query) => _handleSearch(query)
                });
            }

            // 3. Инициализация зума
            if (window.ZoomManager && window.ZoomManager.init) {
                ZoomManager.init({
                    container: _elements.mapContainer,
                    zoomContainer: _elements.zoomContainer,
                    zoomInBtn: _elements.zoomInBtn,
                    zoomOutBtn: _elements.zoomOutBtn,
                    resetBtn: _elements.resetZoomBtn,
                    onZoomChange: (zoom) => _handleZoomChange(zoom)
                });
            }

            // 4. Инициализация карты
            if (window.MapManager && window.MapManager.init) {
                MapManager.init({
                    svgContainer: _elements.svgContainer,
                    mapContainer: _elements.mapContainer,
                    onClick: (countryId) => _handleCountrySelect(countryId),
                    onHover: (countryId) => _handleCountryHover(countryId),
                    onLoad: () => _handleMapLoaded()
                });
            }

            console.log('[App] Модули инициализированы');

        } catch (error) {
            console.error('[App] Ошибка инициализации модулей:', error);
            _state.errors.push(`Ошибка инициализации: ${error.message}`);
            throw error;
        }
    }

    // ==========================================
    // ЗАГРУЗКА ДАННЫХ
    // ==========================================

    /**
     * Загружает все данные мира
     */
    async function _loadData() {
        console.log('[App] Загрузка данных мира...');
        _updateLoadingProgress('Загрузка данных стран...');

        try {
            // Регистрируем колбэк на загрузку данных
            DataManager.onDataLoaded((data) => {
                console.log('[App] Данные загружены:', {
                    countries: data.countries.length,
                    alliances: data.alliances.length,
                    history: data.history.length
                });

                // Обновляем статистику в статусбаре
                _updateWorldStats();
            });

            // Загружаем данные
            await DataManager.loadData();
            
            _updateState({ isLoaded: true });
            _updateLoadingProgress('Данные загружены успешно');

        } catch (error) {
            console.error('[App] Критическая ошибка загрузки данных:', error);
            _state.errors.push(`Ошибка загрузки данных: ${error.message}`);
            
            // Показываем ошибку пользователю
            _showError('Не удалось загрузить данные мира. Пожалуйста, обновите страницу.');
            throw error;
        }
    }

    // ==========================================
    // ЗАГРУЗКА SVG КАРТЫ
    // ==========================================

    /**
     * Загружает SVG карту мира
     */
    async function _loadMap() {
        console.log('[App] Загрузка SVG карты...');
        _updateLoadingProgress('Загрузка карты мира...');

        try {
            if (window.MapManager && window.MapManager.loadMap) {
                await MapManager.loadMap('svg/world.svg');
            }
        } catch (error) {
            console.error('[App] Ошибка загрузки карты:', error);
            _state.errors.push(`Ошибка загрузки карты: ${error.message}`);
            _showError('Не удалось загрузить карту мира.');
            throw error;
        }
    }

    // ==========================================
    // ОБРАБОТЧИКИ СОБЫТИЙ
    // ==========================================

    /**
     * Обработка выбора страны
     * @param {string} countryId - ID выбранной страны
     */
    function _handleCountrySelect(countryId) {
        if (!countryId) {
            _handlePanelClose();
            return;
        }

        console.log(`[App] Выбрана страна: ${countryId}`);

        // Получаем данные страны
        const country = DataManager.getCountryById(countryId);

        if (!country) {
            console.warn(`[App] Страна с ID "${countryId}" не найдена в данных`);
            
            if (window.Toast) {
                Toast.show('Страна не найдена в базе данных', 'warning');
            }
            return;
        }

        // Обновляем состояние
        _updateState({ 
            selectedCountryId: countryId,
            isPanelOpen: true 
        });

        // Обновляем панель информации
        if (window.PanelManager && window.PanelManager.showCountry) {
            PanelManager.showCountry(country);
        }

        // Обновляем статусбар
        _updateStatusBar(country.name);

        // Подсвечиваем страну на карте
        if (window.MapManager && window.MapManager.highlightCountry) {
            MapManager.highlightCountry(countryId);
        }

        // Сохраняем в историю действий
        _addToHistory({
            action: 'select_country',
            countryId: countryId,
            timestamp: Date.now()
        });
    }

    /**
     * Обработка наведения на страну
     * @param {string} countryId - ID страны
     */
    function _handleCountryHover(countryId) {
        if (!countryId) return;

        const country = DataManager.getCountryById(countryId);
        
        if (country) {
            // Можно показывать мини-подсказку
            if (window.Tooltip) {
                Tooltip.show(country.name);
            }
        }
    }

    /**
     * Обработка поиска
     * @param {string} query - поисковый запрос
     */
    function _handleSearch(query) {
        if (!query || query.length < 1) {
            // Очищаем подсветку на карте
            if (window.MapManager && window.MapManager.clearHighlight) {
                MapManager.clearHighlight();
            }
            return;
        }

        console.log(`[App] Поиск: "${query}"`);

        // Ищем страны
        const results = DataManager.searchCountries(query, { limit: 10 });

        if (results.length > 0) {
            // Подсвечиваем найденные страны на карте
            const resultIds = results.map(c => c.id);
            
            if (window.MapManager && window.MapManager.highlightCountries) {
                MapManager.highlightCountries(resultIds);
            }
        }
    }

    /**
     * Обработка изменения масштаба
     * @param {number} zoom - новый масштаб
     */
    function _handleZoomChange(zoom) {
        _updateState({ currentZoom: zoom });
        _updateZoomDisplay(zoom);
    }

    /**
     * Обработка закрытия панели
     */
    function _handlePanelClose() {
        _updateState({ 
            selectedCountryId: null,
            isPanelOpen: false 
        });

        // Очищаем панель
        if (window.PanelManager && window.PanelManager.hideCountry) {
            PanelManager.hideCountry();
        }

        // Очищаем подсветку на карте
        if (window.MapManager && window.MapManager.clearHighlight) {
            MapManager.clearHighlight();
        }

        // Обновляем статусбар
        _updateStatusBar(null);
    }

    /**
     * Обработка загрузки карты
     */
    function _handleMapLoaded() {
        console.log('[App] Карта загружена и готова');
        _updateLoadingProgress('Карта загружена');
    }

    // ==========================================
    // ОБНОВЛЕНИЕ UI
    // ==========================================

    /**
     * Обновляет статусбар
     * @param {string|null} countryName - название выбранной страны или null
     */
    function _updateStatusBar(countryName) {
        if (_elements.selectedCountryText) {
            _elements.selectedCountryText.textContent = countryName || 'Нет';
        }
    }

    /**
     * Обновляет отображение масштаба
     * @param {number} zoom - текущий масштаб
     */
    function _updateZoomDisplay(zoom) {
        if (_elements.zoomValue) {
            const percentage = Math.round(zoom * 100);
            _elements.zoomValue.textContent = `${percentage}%`;
        }
    }

    /**
     * Обновляет статистику мира в статусбаре (опционально)
     */
    function _updateWorldStats() {
        const stats = DataManager.getWorldStats();
        
        if (stats && window.DEBUG_MODE) {
            console.log('[App] Статистика мира:', stats);
        }
    }

    /**
     * Обновляет прогресс загрузки
     * @param {string} message - сообщение о прогрессе
     */
    function _updateLoadingProgress(message) {
        const loadingText = document.querySelector('#loading-screen p');
        if (loadingText) {
            loadingText.textContent = message;
        }
    }

    // ==========================================
    // УПРАВЛЕНИЕ ЭКРАНОМ ЗАГРУЗКИ
    // ==========================================

    /**
     * Показывает экран загрузки
     */
    function _showLoadingScreen() {
        if (_elements.loadingScreen) {
            _elements.loadingScreen.classList.remove('hidden');
        }
        _updateState({ isLoading: true });
    }

    /**
     * Скрывает экран загрузки
     */
    function _hideLoadingScreen() {
        if (_elements.loadingScreen) {
            // Добавляем класс для анимации исчезновения
            _elements.loadingScreen.classList.add('hidden');

            // Удаляем элемент после анимации
            _timers.loadingScreen = setTimeout(() => {
                if (_elements.loadingScreen) {
                    _elements.loadingScreen.style.display = 'none';
                }
            }, 500);
        }
        _updateState({ isLoading: false });
    }

    // ==========================================
    // УПРАВЛЕНИЕ ПОЛНЫМ ЭКРАНОМ
    // ==========================================

    /**
     * Переключает полноэкранный режим
     */
    function _toggleFullscreen() {
        if (!_state.isFullscreen) {
            // Входим в полноэкранный режим
            const element = document.documentElement;
            
            if (element.requestFullscreen) {
                element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                element.webkitRequestFullscreen();
            } else if (element.msRequestFullscreen) {
                element.msRequestFullscreen();
            }
            
            _updateState({ isFullscreen: true });
        } else {
            // Выходим из полноэкранного режима
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            
            _updateState({ isFullscreen: false });
        }
    }

    /**
     * Обработчик изменения полноэкранного режима
     */
    function _handleFullscreenChange() {
        const isFullscreen = !!(
            document.fullscreenElement ||
            document.webkitFullscreenElement ||
            document.msFullscreenElement
        );
        
        _updateState({ isFullscreen });
    }

    // ==========================================
    // УПРАВЛЕНИЕ ТЕМОЙ
    // ==========================================

    /**
     * Переключает тему (светлая/тёмная)
     */
    function toggleTheme() {
        const newTheme = _state.currentTheme === 'light' ? 'dark' : 'light';
        _setTheme(newTheme);
    }

    /**
     * Устанавливает тему
     * @param {string} theme - 'light' или 'dark'
     */
    function _setTheme(theme) {
        _updateState({ currentTheme: theme });

        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }

        // Сохраняем выбор в localStorage
        localStorage.setItem('rp-planet-theme', theme);
        
        console.log(`[App] Тема переключена: ${theme}`);
    }

    /**
     * Загружает сохранённую тему
     */
    function _loadSavedTheme() {
        const savedTheme = localStorage.getItem('rp-planet-theme');
        
        if (savedTheme) {
            _setTheme(savedTheme);
        } else {
            // Проверяем системные предпочтения
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            _setTheme(prefersDark ? 'dark' : 'light');
        }
    }

    // ==========================================
    // ОБРАБОТКА ОШИБОК
    // ==========================================

    /**
     * Показывает сообщение об ошибке
     * @param {string} message - текст ошибки
     */
    function _showError(message) {
        console.error('[App]', message);

        // Если есть Toast, показываем уведомление
        if (window.Toast && window.Toast.show) {
            Toast.show(message, 'error', 5000);
        } else {
            // Fallback: alert
            alert(message);
        }
    }

    /**
     * Показывает уведомление
     * @param {string} message - текст уведомления
     * @param {string} type - тип ('success', 'warning', 'error', 'info')
     */
    function showNotification(message, type = 'info') {
        if (window.Toast && window.Toast.show) {
            Toast.show(message, type);
        }
    }

    // ==========================================
    // ИСТОРИЯ ДЕЙСТВИЙ
    // ==========================================

    /**
     * Добавляет действие в историю
     * @param {object} action - объект действия
     */
    function _addToHistory(action) {
        _actionHistory.push(action);
        
        // Ограничиваем историю 100 последними действиями
        if (_actionHistory.length > 100) {
            _actionHistory.shift();
        }
    }

    /**
     * Получить историю действий
     * @returns {Array}
     */
    function getActionHistory() {
        return [..._actionHistory];
    }

    // ==========================================
    // ГОРЯЧИЕ КЛАВИШИ
    // ==========================================

    /**
     * Настраивает горячие клавиши
     */
    function _setupHotkeys() {
        document.addEventListener('keydown', (event) => {
            // Игнорируем, если фокус в поле ввода
            if (event.target.tagName === 'INPUT' || 
                event.target.tagName === 'TEXTAREA' ||
                event.target.isContentEditable) {
                return;
            }

            switch (event.key.toLowerCase()) {
                case 'f':
                    // Фокус на поиск
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        _elements.searchInput?.focus();
                    }
                    break;

                case 'escape':
                    // Закрыть панель
                    if (_state.isPanelOpen) {
                        event.preventDefault();
                        _handlePanelClose();
                    }
                    break;

                case '+':
                case '=':
                    // Приблизить
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        if (window.ZoomManager && window.ZoomManager.zoomIn) {
                            ZoomManager.zoomIn();
                        }
                    }
                    break;

                case '-':
                    // Отдалить
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        if (window.ZoomManager && window.ZoomManager.zoomOut) {
                            ZoomManager.zoomOut();
                        }
                    }
                    break;

                case '0':
                    // Сбросить зум
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        if (window.ZoomManager && window.ZoomManager.resetZoom) {
                            ZoomManager.resetZoom();
                        }
                    }
                    break;

                case 't':
                    // Переключить тему
                    if (event.ctrlKey && event.shiftKey) {
                        event.preventDefault();
                        toggleTheme();
                    }
                    break;
            }
        });

        console.log('[App] Горячие клавиши настроены');
    }

    // ==========================================
    // ОБРАБОТКА ИЗМЕНЕНИЯ РАЗМЕРА ОКНА
    // ==========================================

    /**
     * Обработчик изменения размера окна
     */
    function _handleResize() {
        // Debounce для производительности
        clearTimeout(_timers.resize);

        _timers.resize = setTimeout(() => {
            // Уведомляем модули об изменении размера
            if (window.MapManager && window.MapManager.handleResize) {
                MapManager.handleResize();
            }
            
            if (window.ZoomManager && window.ZoomManager.handleResize) {
                ZoomManager.handleResize();
            }

            console.log('[App] Размер окна изменён');
        }, 250);
    }

    // ==========================================
    // СЛУШАТЕЛИ СОБЫТИЙ
    // ==========================================

    /**
     * Настраивает все слушатели событий
     */
    function _setupEventListeners() {
        // Полноэкранный режим
        if (_elements.fullscreenBtn) {
            _elements.fullscreenBtn.addEventListener('click', _toggleFullscreen);
        }

        document.addEventListener('fullscreenchange', _handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', _handleFullscreenChange);
        document.addEventListener('msfullscreenchange', _handleFullscreenChange);

        // Изменение размера окна
        window.addEventListener('resize', _handleResize);

        // Обработка ошибок загрузки ресурсов
        window.addEventListener('error', (event) => {
            if (event.target.tagName === 'IMG' || 
                event.target.tagName === 'SCRIPT' ||
                event.target.tagName === 'LINK') {
                console.warn('[App] Ошибка загрузки ресурса:', event.target.src || event.target.href);
            }
        }, true);

        // Предотвращение случайного ухода со страницы
        window.addEventListener('beforeunload', (event) => {
            if (_state.isLoading) {
                event.preventDefault();
                event.returnValue = 'Загрузка ещё не завершена. Вы уверены?';
                return event.returnValue;
            }
        });

        console.log('[App] Слушатели событий настроены');
    }

    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
    // ==========================================

    /**
     * Главная функция инициализации
     */
    async function init() {
        console.log('🌍 RP Planet — Инициализация приложения...');
        console.log('============================================');

        const startTime = performance.now();

        try {
            // 1. Кэшируем DOM-элементы
            _cacheElements();

            // 2. Проверяем критические элементы
            if (!_validateElements()) {
                throw new Error('Отсутствуют критические DOM-элементы');
            }

            // 3. Проверяем наличие модулей
            if (!_checkModules()) {
                throw new Error('Не все модули доступны');
            }

            // 4. Загружаем сохранённую тему
            _loadSavedTheme();

            // 5. Настраиваем слушатели событий
            _setupEventListeners();

            // 6. Настраиваем горячие клавиши
            _setupHotkeys();

            // 7. Показываем экран загрузки
            _showLoadingScreen();

            // 8. Инициализируем модули
            await _initModules();

            // 9. Загружаем данные
            await _loadData();

            // 10. Загружаем карту
            await _loadMap();

            // 11. Скрываем экран загрузки
            _hideLoadingScreen();

            // 12. Обновляем UI
            _updateZoomDisplay(_state.currentZoom);
            _updateStatusBar(null);

            const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
            console.log(`✅ Приложение готово! (${loadTime}с)`);
            console.log('============================================');

            // Показываем приветственное уведомление
            showNotification('Добро пожаловать в RP Planet! Выберите страну на карте.', 'info');

        } catch (error) {
            console.error('❌ Критическая ошибка инициализации:', error);
            
            // Показываем ошибку на экране загрузки
            _updateLoadingProgress(`Ошибка: ${error.message}`);
            
            // Меняем текст загрузки на ошибку
            const loadingText = document.querySelector('#loading-screen p');
            if (loadingText) {
                loadingText.textContent = 'Произошла ошибка при загрузке. Пожалуйста, обновите страницу.';
                loadingText.style.color = 'var(--color-danger)';
            }

            // Останавливаем анимацию загрузки
            const loader = document.querySelector('#loading-screen .loader');
            if (loader) {
                loader.style.animationPlayState = 'paused';
                loader.style.borderTopColor = 'var(--color-danger)';
            }
        }
    }

    /**
     * Перезагрузка приложения
     */
    async function reload() {
        console.log('[App] Перезагрузка приложения...');
        
        // Сбрасываем состояние
        _handlePanelClose();
        
        // Сбрасываем данные
        DataManager.resetData();
        
        // Переинициализируем
        await init();
    }

    // ==========================================
    // ПУБЛИЧНЫЙ API
    // ==========================================

    return {
        init,
        reload,
        getState,
        showNotification,
        toggleTheme,
        getActionHistory,
        
        // Методы для внешнего управления
        selectCountry: _handleCountrySelect,
        clearSelection: _handlePanelClose,
        search: _handleSearch
    };

})();


/* ============================================================
   ЗАПУСК ПРИЛОЖЕНИЯ
   ============================================================ */

// Ждём полной загрузки DOM перед инициализацией
document.addEventListener('DOMContentLoaded', () => {
    console.log('[App] DOM готов, запуск приложения...');
    App.init();
});


/* ============================================================
   ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
   ============================================================ */

window.App = App;


/* ============================================================
   DEBUG MODE (включить для отладки)
   ============================================================ */

// Раскомментировать для включения режима отладки
// window.DEBUG_MODE = true;


/* ============================================================
   ОБРАБОТЧИК ДЛЯ SERVICE WORKER (если используется PWA)
   ============================================================ */

// Регистрация Service Worker для оффлайн-режима
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
            (registration) => {
                console.log('[App] Service Worker зарегистрирован:', registration.scope);
            },
            (error) => {
                console.warn('[App] Ошибка регистрации Service Worker:', error);
            }
        );
    });
}


/* ============================================================
   МЕТРИКИ ПРОИЗВОДИТЕЛЬНОСТИ
   ============================================================ */

// Отправка метрик в консоль (или аналитику)
window.addEventListener('load', () => {
    if (window.performance && window.performance.getEntriesByType) {
        setTimeout(() => {
            const paintMetrics = performance.getEntriesByType('paint');
            const navigationTiming = performance.getEntriesByType('navigation')[0];
            
            if (window.DEBUG_MODE) {
                console.log('[App] Метрики производительности:', {
                    'First Paint': paintMetrics.find(m => m.name === 'first-paint')?.startTime,
                    'First Contentful Paint': paintMetrics.find(m => m.name === 'first-contentful-paint')?.startTime,
                    'DOM Ready': navigationTiming?.domContentLoadedEventEnd,
                    'Page Load': navigationTiming?.loadEventEnd
                });
            }
        }, 0);
    }
});