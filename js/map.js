/* ============================================================
   map.js — MapManager: Управление SVG-картой мира
   Загрузка, рендеринг, обработка событий
   Версия 3.1 — Упрощенная (без дипломатии и серого предпросмотра)
   ============================================================ */

const MapManager = (() => {
    'use strict';

    // ==========================================
    // ПРИВАТНЫЕ ПЕРЕМЕННЫЕ
    // ==========================================

    /** SVG элемент карты */
    let _svgElement = null;

    /** DOM-контейнеры */
    let _svgContainer = null;
    let _mapContainer = null;

    /** Коллекция стран (path элементы) */
    let _countries = {};

    /** Колбэки */
    let _callbacks = {
        onClick: null,
        onHover: null,
        onHoverOut: null,
        onLoad: null
    };

    /** Состояние карты */
    let _state = {
        isLoaded: false,
        isLoading: false,
        selectedCountryId: null,
        hoveredCountryId: null,
        highlightedCountries: [],
        viewBox: null,
        originalViewBox: null,
        error: null
    };

    /** Настройки */
    let _settings = {
        selectableClass: 'country-path',
        selectedClass: 'country-selected',
        hoveredClass: 'country-hovered',
        highlightedClass: 'country-highlighted',
        disabledClass: 'country-disabled',
        
        hoverColor: '#3a7bd5',
        selectedColor: '#2d62b0',
        highlightColor: '#f1c40f',
        defaultBorderColor: 'rgba(255, 255, 255, 0.25)',
        defaultBorderWidth: '0.5',
        selectedBorderWidth: '0.8',
        animationDuration: 250,
        
        tooltipEnabled: true,
        showTooltipOnHover: true,
        tooltipOffset: 12,
        tooltipDelay: 300
    };

    /** Кэш оригинальных стилей стран */
    let _originalStyles = {};

    /** Кэш для хранения SVG-строк стилей */
    let _svgStylesCache = null;

    /** Таймеры */
    let _timers = {
        tooltipShow: null,
        tooltipHide: null,
        animation: null
    };

    /** Флаг инициализации событий */
    let _eventsBound = false;

    /** Тултип элемент */
    let _tooltipElement = null;

    /** Счетчик для генерации уникальных ID */
    let _idCounter = 0;

    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ
    // ==========================================

    /**
     * Инициализация менеджера карты
     * @param {object} options - параметры инициализации
     * @returns {boolean} успешность инициализации
     */
    function init(options = {}) {
        console.log('[MapManager] ========================================');
        console.log('[MapManager] Инициализация v3.1 — Упрощенная карта');
        console.log('[MapManager] ========================================');

        // Сохраняем контейнеры с проверкой
        _svgContainer = options.svgContainer || document.getElementById('svg-container');
        _mapContainer = options.mapContainer || document.getElementById('map-container');

        // Сохраняем колбэки с валидацией
        if (options.onClick && typeof options.onClick === 'function') {
            _callbacks.onClick = options.onClick;
        }
        if (options.onHover && typeof options.onHover === 'function') {
            _callbacks.onHover = options.onHover;
        }
        if (options.onHoverOut && typeof options.onHoverOut === 'function') {
            _callbacks.onHoverOut = options.onHoverOut;
        }
        if (options.onLoad && typeof options.onLoad === 'function') {
            _callbacks.onLoad = options.onLoad;
        }

        // Обновляем настройки с глубоким слиянием
        if (options.settings) {
            _deepMergeSettings(options.settings);
        }

        // Проверяем контейнеры
        if (!_svgContainer) {
            console.error('[MapManager] SVG-контейнер не найден');
            _state.error = 'SVG-контейнер не найден';
            return false;
        }

        if (!_mapContainer) {
            console.error('[MapManager] Контейнер карты не найден');
            _state.error = 'Контейнер карты не найден';
            return false;
        }

        // Настраиваем контейнер карты
        _setupMapContainer();

        // Создаем тултип
        _createTooltip();

        console.log('[MapManager] Инициализация завершена успешно');
        console.log('[MapManager] Конфигурация:', {
            animationDuration: _settings.animationDuration,
            tooltipEnabled: _settings.tooltipEnabled
        });

        return true;
    }

    /**
     * Настройка контейнера карты
     * @private
     */
    function _setupMapContainer() {
        if (!_mapContainer) return;

        _mapContainer.style.position = 'relative';
        _mapContainer.style.overflow = 'hidden';
        _mapContainer.style.backgroundColor = 'var(--color-bg-tertiary, #f1f5f9)';
        
        _mapContainer.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        _mapContainer.addEventListener('dragstart', (e) => {
            e.preventDefault();
        });

        _mapContainer.setAttribute('data-map-ready', 'true');
        _mapContainer.setAttribute('data-version', '3.1');

        console.log('[MapManager] Контейнер карты настроен');
    }

    /**
     * Создает элемент тултипа
     * @private
     */
    function _createTooltip() {
        if (_tooltipElement) return;

        _tooltipElement = document.createElement('div');
        _tooltipElement.className = 'map-tooltip';
        _tooltipElement.setAttribute('role', 'tooltip');
        _tooltipElement.setAttribute('aria-hidden', 'true');
        _tooltipElement.style.cssText = `
            position: fixed;
            pointer-events: none;
            background: var(--color-bg-secondary, #1e293b);
            color: var(--color-text-primary, #e2e8f0);
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(0,0,0,0.25);
            z-index: 10000;
            white-space: nowrap;
            opacity: 0;
            transform: translateY(4px);
            transition: opacity 0.2s ease, transform 0.2s ease;
            border: 1px solid var(--color-border, #334155);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            letter-spacing: 0.2px;
        `;
        
        document.body.appendChild(_tooltipElement);
        console.log('[MapManager] Тултип создан');
    }

    /**
     * Глубокое слияние настроек
     * @param {object} newSettings - новые настройки
     * @private
     */
    function _deepMergeSettings(newSettings) {
        for (const key in newSettings) {
            if (
                typeof newSettings[key] === 'object' && 
                newSettings[key] !== null && 
                !Array.isArray(newSettings[key]) &&
                typeof _settings[key] === 'object' &&
                _settings[key] !== null
            ) {
                _settings[key] = { ..._settings[key], ...newSettings[key] };
            } else {
                _settings[key] = newSettings[key];
            }
        }
    }

    // ==========================================
    // ЗАГРУЗКА SVG
    // ==========================================

    /**
     * Загружает SVG карту из файла
     * @param {string} url - путь к SVG файлу
     * @returns {Promise<SVGElement>} SVG элемент
     */
    async function loadMap(url = 'svg/world.svg') {
        if (_state.isLoading) {
            console.warn('[MapManager] Карта уже загружается, ожидайте...');
            return new Promise((resolve) => {
                const checkInterval = setInterval(() => {
                    if (!_state.isLoading) {
                        clearInterval(checkInterval);
                        resolve(_svgElement);
                    }
                }, 100);
            });
        }

        console.log(`[MapManager] Загрузка карты: ${url}`);
        _state.isLoading = true;
        _state.isLoaded = false;
        _state.error = null;

        const startTime = performance.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'image/svg+xml'
                }
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const svgText = await response.text();
            
            if (!svgText.includes('<svg')) {
                throw new Error('Полученный файл не является SVG');
            }

            _svgContainer.innerHTML = '';
            _svgContainer.innerHTML = svgText;
            
            _svgElement = _svgContainer.querySelector('svg');
            
            if (!_svgElement) {
                throw new Error('SVG элемент не найден в загруженном файле');
            }

            const loadTime = (performance.now() - startTime).toFixed(0);
            console.log(`[MapManager] SVG загружен за ${loadTime}мс`);

            _initializeSVG();
            _saveViewBox();
            await _waitForRender();
            _scanCountries();
            _buildCountryIndex();
            _bindEvents();
            _applyBaseCountryStyles();

            _state.isLoaded = true;
            _state.isLoading = false;

            const countryCount = Object.keys(_countries).length;
            console.log(`[MapManager] ✅ Карта загружена успешно`);
            console.log(`[MapManager] Найдено стран: ${countryCount}`);
            console.log(`[MapManager] ViewBox: ${_state.viewBox}`);
            
            if (countryCount === 0) {
                console.warn('[MapManager] ⚠️ Не найдено ни одной страны!');
                _debugSVGStructure();
            } else {
                const sampleIds = Object.keys(_countries).slice(0, 10);
                console.log('[MapManager] Примеры ID стран:', sampleIds);
            }
            
            if (_callbacks.onLoad) {
                try {
                    _callbacks.onLoad(_svgElement, {
                        countryCount,
                        loadTime: parseInt(loadTime)
                    });
                } catch (cbError) {
                    console.error('[MapManager] Ошибка в колбэке onLoad:', cbError);
                }
            }

            return _svgElement;

        } catch (error) {
            const loadTime = (performance.now() - startTime).toFixed(0);
            
            if (error.name === 'AbortError') {
                console.error(`[MapManager] ❌ Таймаут загрузки карты (${loadTime}мс)`);
                _state.error = 'Превышено время загрузки карты';
            } else {
                console.error(`[MapManager] ❌ Ошибка загрузки карты (${loadTime}мс):`, error);
                _state.error = error.message;
            }
            
            _state.isLoading = false;
            _state.isLoaded = false;
            
            _showErrorPlaceholder(_state.error);
            throw error;
        }
    }

    /**
     * Ожидание рендеринга SVG
     * @param {number} frames - количество кадров для ожидания
     * @returns {Promise<void>}
     * @private
     */
    function _waitForRender(frames = 3) {
        return new Promise(resolve => {
            let count = 0;
            
            function waitFrame() {
                count++;
                if (count >= frames) {
                    resolve();
                } else {
                    requestAnimationFrame(waitFrame);
                }
            }
            
            requestAnimationFrame(waitFrame);
        });
    }

    /**
     * Инициализация SVG элемента
     * @private
     */
    function _initializeSVG() {
        if (!_svgElement) return;

        _svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        _svgElement.style.width = '100%';
        _svgElement.style.height = '100%';
        _svgElement.style.display = 'block';
        _svgElement.style.pointerEvents = 'auto';
        _svgElement.style.position = 'relative';
        _svgElement.style.margin = '0';
        _svgElement.style.padding = '0';
        
        const svgId = `rp-map-${Date.now()}`;
        _svgElement.setAttribute('id', svgId);
        _svgElement.setAttribute('data-map-version', '3.1');
        _svgElement.setAttribute('data-loaded', new Date().toISOString());
        
        let styleEl = _svgElement.querySelector('style');
        if (!styleEl) {
            styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
            styleEl.setAttribute('type', 'text/css');
            _svgElement.insertBefore(styleEl, _svgElement.firstChild);
        }
        
        _svgElement._styleElement = styleEl;
        
        console.log('[MapManager] SVG инициализирован, ID:', svgId);
    }

    /**
     * Сохраняет оригинальный viewBox
     * @private
     */
    function _saveViewBox() {
        if (!_svgElement) return;

        const viewBox = _svgElement.getAttribute('viewBox');
        
        if (viewBox) {
            const parts = viewBox.trim().split(/\s+/);
            if (parts.length === 4) {
                _state.viewBox = viewBox;
                _state.originalViewBox = viewBox;
            }
        } else {
            const width = parseFloat(_svgElement.getAttribute('width')) || 1000;
            const height = parseFloat(_svgElement.getAttribute('height')) || 600;
            _state.viewBox = `0 0 ${width} ${height}`;
            _state.originalViewBox = _state.viewBox;
            _svgElement.setAttribute('viewBox', _state.viewBox);
        }
        
        console.log('[MapManager] ViewBox сохранен:', _state.viewBox);
    }

    /**
     * Применяет базовые стили к странам
     * @private
     */
    function _applyBaseCountryStyles() {
    if (!_svgElement || !_svgElement._styleElement) return;

    const styleEl = _svgElement._styleElement;
    
    const styles = `
        .${_settings.selectableClass} {
            cursor: pointer;
            transition: fill 0.25s ease,
                        stroke 0.25s ease,
                        stroke-width 0.25s ease,
                        filter 0.3s ease,
                        opacity 0.25s ease;
            vector-effect: non-scaling-stroke;
            stroke-linejoin: round;
            stroke-linecap: round;
            stroke: rgba(255, 255, 255, 0.25);
            stroke-width: 0.5;
        }
        
        .${_settings.selectableClass}:hover {
            filter: brightness(1.12) saturate(1.05);
            stroke: rgba(255, 255, 255, 0.5);
            stroke-width: 0.8;
            cursor: pointer;
        }
        
        .${_settings.selectedClass} {
            filter: brightness(1.18) saturate(1.08) !important;
            stroke: rgba(255, 255, 255, 0.65) !important;
            stroke-width: 0.8 !important;
        }
        
        .${_settings.hoveredClass} {
            filter: brightness(1.12) saturate(1.05);
            stroke: rgba(255, 255, 255, 0.5);
            stroke-width: 0.8;
        }
        
        .${_settings.highlightedClass} {
            animation: rp-pulse 2.5s ease-in-out infinite;
        }
        
        .${_settings.disabledClass} {
            opacity: 0.25 !important;
            pointer-events: none !important;
            cursor: not-allowed !important;
            filter: grayscale(0.5) !important;
        }
        
        @keyframes rp-pulse {
            0%, 100% { 
                filter: brightness(1) saturate(1);
            }
            50% { 
                filter: brightness(1.1) saturate(1.06);
            }
        }
    `;

     styleEl.textContent += styles;
     _svgStylesCache = styles;
    
        console.log('[MapManager] Базовые стили стран применены (тонкая обводка + осветление)');
    }

    // ==========================================
    // СКАНИРОВАНИЕ СТРАН
    // ==========================================

    /**
     * Сканирует SVG на наличие стран (path элементов)
     * @private
     */
    function _scanCountries() {
        if (!_svgElement) {
            console.error('[MapManager] SVG элемент не найден при сканировании');
            return;
        }

        _countries = {};
        _originalStyles = {};

        const allPaths = _svgElement.querySelectorAll('path');
        const totalPaths = allPaths.length;
        
        console.log(`[MapManager] Сканирование SVG...`);
        console.log(`[MapManager] Всего path элементов: ${totalPaths}`);

        let pathsWithId = 0;
        let pathsWithoutId = 0;
        let skippedDecorative = 0;
        let countriesAdded = 0;

        allPaths.forEach((path, index) => {
            let countryId = path.getAttribute('id');
            
            if (!countryId) {
                pathsWithoutId++;
                return;
            }

            if (_isDecorativeElement(path)) {
                skippedDecorative++;
                return;
            }

            pathsWithId++;
            
            const normalizedId = _normalizeCountryId(countryId);
            const originalId = countryId;
            
            path.setAttribute('data-country-id', normalizedId);
            path.setAttribute('data-original-id', originalId);
            path.classList.add(_settings.selectableClass);
            
            const countryName = path.getAttribute('data-name') || 
                               path.getAttribute('title') || 
                               path.getAttribute('name') || 
                               path.getAttribute('aria-label') ||
                               normalizedId;
            
            const computedStyle = window.getComputedStyle(path);
            _originalStyles[normalizedId] = {
                fill: path.getAttribute('fill') || computedStyle.fill || '#cccccc',
                stroke: path.getAttribute('stroke') || computedStyle.stroke || _settings.defaultBorderColor,
                strokeWidth: path.getAttribute('stroke-width') || computedStyle.strokeWidth || _settings.defaultBorderWidth,
                opacity: path.getAttribute('opacity') || '1',
                d: path.getAttribute('d') || ''
            };

            _countries[normalizedId] = {
                element: path,
                id: normalizedId,
                originalId: originalId,
                name: countryName,
                originalFill: _originalStyles[normalizedId].fill,
                originalStroke: _originalStyles[normalizedId].stroke,
                bounds: null,
                addedAt: Date.now()
            };

            countriesAdded++;
        });

        console.log(`[MapManager] Результаты сканирования:`);
        console.log(`  - Всего path: ${totalPaths}`);
        console.log(`  - С ID: ${pathsWithId}`);
        console.log(`  - Без ID: ${pathsWithoutId}`);
        console.log(`  - Декоративных пропущено: ${skippedDecorative}`);
        console.log(`  - Стран добавлено: ${countriesAdded}`);

        if (countriesAdded === 0) {
            console.warn('[MapManager] ⚠️ Не найдено ни одной страны!');
            _debugSVGStructure();
        }
    }

    /**
     * Проверяет, является ли элемент декоративным
     * @param {Element} path - path элемент
     * @returns {boolean}
     * @private
     */
    function _isDecorativeElement(path) {
        const decorativeClasses = [
            'ocean', 'sea', 'lake', 'river', 'water',
            'border', 'coastline', 'grid', 'graticule',
            'decor', 'decoration', 'frame', 'background'
        ];
        
        const decorativeIds = [
            'ocean', 'sea', 'water', 'background', 'frame',
            'border', 'coast', 'coastline'
        ];
        
        for (const cls of decorativeClasses) {
            if (path.classList.contains(cls)) {
                return true;
            }
        }
        
        const id = (path.getAttribute('id') || '').toLowerCase();
        for (const decId of decorativeIds) {
            if (id.includes(decId)) {
                return true;
            }
        }
        
        if (path.getAttribute('data-country') === 'false') {
            return true;
        }
        
        try {
            const bbox = path.getBBox();
            const svgRect = _svgElement.getBoundingClientRect();
            const svgWidth = svgRect.width || 1000;
            const svgHeight = svgRect.height || 600;
            
            if (bbox.width > svgWidth * 0.9 && bbox.height > svgHeight * 0.9) {
                return true;
            }
        } catch (e) {
            // Игнорируем ошибки getBBox
        }
        
        return false;
    }

    /**
     * Строит индексы для быстрого поиска стран
     * @private
     */
    function _buildCountryIndex() {
        _state._countryMap = new Map();
        _state._countryByName = new Map();
        
        Object.entries(_countries).forEach(([id, country]) => {
            _state._countryMap.set(id, country);
            _state._countryByName.set(country.name.toLowerCase(), country);
        });
        
        _state._allCountryIds = Object.keys(_countries);
        
        console.log(`[MapManager] Индексы построены: ${_state._allCountryIds.length} стран`);
    }

    /**
     * Выводит структуру SVG для отладки
     * @private
     */
    function _debugSVGStructure() {
        if (!_svgElement) return;
        
        console.group('[MapManager] Структура SVG:');
        
        const paths = _svgElement.querySelectorAll('path');
        console.log(`Path элементов: ${paths.length}`);
        
        paths.forEach((path, i) => {
            const id = path.getAttribute('id');
            const d = path.getAttribute('d') || '';
            const fill = path.getAttribute('fill');
            const classes = Array.from(path.classList);
            
            console.log(`Path #${i}:`, {
                id: id || '(нет)',
                fill: fill || '(нет)',
                classes: classes.join(' ') || '(нет)',
                pathLength: d.length
            });
        });
        
        const groups = _svgElement.querySelectorAll('g');
        console.log(`Групп (g): ${groups.length}`);
        groups.forEach((g, i) => {
            const id = g.getAttribute('id');
            const pathsInGroup = g.querySelectorAll('path').length;
            console.log(`Группа #${i}: id="${id || '(нет)'}", path в группе: ${pathsInGroup}`);
        });
        
        console.groupEnd();
    }

    /**
     * Нормализация ID страны
     * @param {string} id - идентификатор
     * @returns {string} нормализованный ID
     * @private
     */
    function _normalizeCountryId(id) {
        if (!id) return `country_${_idCounter++}`;
        
        return id
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_-]/g, '')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    // ==========================================
    // ПРИВЯЗКА СОБЫТИЙ
    // ==========================================

    /**
     * Привязывает все события к карте и странам
     * @private
     */
    function _bindEvents() {
        if (_eventsBound) {
            console.log('[MapManager] События уже привязаны, очищаем старые');
            _unbindEvents();
        }

        console.log('[MapManager] Привязка событий...');
        let boundCount = 0;
        const startTime = performance.now();

        Object.values(_countries).forEach(country => {
            const element = country.element;
            const countryId = country.id;

            element.dataset.countryId = countryId;
            element.setAttribute('data-name', country.name);
            element.setAttribute('data-interactive', 'true');

            const clickHandler = function(event) {
                _handleCountryClick(countryId, event);
            };

            const mouseEnterHandler = function(event) {
                _handleCountryMouseEnter(countryId, event);
            };

            const mouseLeaveHandler = function(event) {
                _handleCountryMouseLeave(countryId, event);
            };

            const touchEndHandler = function(event) {
                if (event.cancelable) {
                    event.preventDefault();
                }
                _handleCountryClick(countryId, event);
            };

            element._handlers = {
                click: clickHandler,
                mouseenter: mouseEnterHandler,
                mouseleave: mouseLeaveHandler,
                touchend: touchEndHandler
            };

            element.addEventListener('click', clickHandler);
            element.addEventListener('mouseenter', mouseEnterHandler);
            element.addEventListener('mouseleave', mouseLeaveHandler);
            element.addEventListener('touchend', touchEndHandler, { passive: false });

            boundCount++;
        });

        _bindGlobalEvents();

        _eventsBound = true;
        const bindTime = (performance.now() - startTime).toFixed(0);
        
        console.log(`[MapManager] События привязаны к ${boundCount} странам за ${bindTime}мс`);
    }

    /**
     * Удаляет привязку событий со всех стран
     * @private
     */
    function _unbindEvents() {
        let unboundCount = 0;
        
        Object.values(_countries).forEach(country => {
            const element = country.element;
            
            if (element._handlers) {
                element.removeEventListener('click', element._handlers.click);
                element.removeEventListener('mouseenter', element._handlers.mouseenter);
                element.removeEventListener('mouseleave', element._handlers.mouseleave);
                element.removeEventListener('touchend', element._handlers.touchend);
                
                delete element._handlers;
                unboundCount++;
            }
        });

        _eventsBound = false;
        console.log(`[MapManager] События отвязаны от ${unboundCount} стран`);
    }

    /**
     * Привязывает глобальные события карты
     * @private
     */
    function _bindGlobalEvents() {
        if (!_mapContainer) return;

        _mapContainer.addEventListener('click', function(event) {
            const countryElement = event.target.closest(`.${_settings.selectableClass}`);
            
            if (!countryElement) {
                console.log('[MapManager] Клик по пустому месту карты — снимаем выделение');
                _handleBackgroundClick();
            }
        });

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                if (_state.selectedCountryId) {
                    console.log('[MapManager] Escape — очистка выделения');
                    _handleBackgroundClick();
                }
            }
        });

        window.addEventListener('blur', () => {
            _hideTooltip();
        });

        window.addEventListener('resize', Utils.debounce(() => {
            _handleResize();
        }, 250));
    }

    /**
     * Обработка клика по фону карты
     * @private
     */
    function _handleBackgroundClick() {
        clearSelection();
        
        if (_callbacks.onClick) {
            _callbacks.onClick(null);
        }
    }

    /**
     * Обработка изменения размера окна
     * @private
     */
    function _handleResize() {
        if (!_svgElement) return;
        
        const containerRect = _svgContainer.getBoundingClientRect();
        const svgRect = _svgElement.getBoundingClientRect();
        
        if (containerRect.width > 0 && svgRect.width > 0) {
            const ratioDiff = Math.abs(
                (containerRect.width / containerRect.height) - 
                (svgRect.width / svgRect.height)
            );
            
            if (ratioDiff > 0.2) {
                _svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            }
        }
    }

    // ==========================================
    // ОБРАБОТЧИКИ СОБЫТИЙ СТРАН
    // ==========================================

    /**
     * Обработка клика по стране
     * @param {string} countryId - ID страны
     * @param {Event} event - событие клика
     * @private
     */
    function _handleCountryClick(countryId, event) {
        console.log(`[MapManager] Клик по стране: ${countryId}`);
        
        if (!_countries[countryId]) {
            console.error(`[MapManager] Страна с ID "${countryId}" не найдена!`);
            return;
        }

        const country = _countries[countryId];
        
        event.stopPropagation();
        
        if (event.cancelable) {
            event.preventDefault();
        }

        // Если клик по уже выбранной стране — снимаем выделение
        if (_state.selectedCountryId === countryId) {
            console.log('[MapManager] Клик по уже выбранной стране — снимаем выделение');
            _handleBackgroundClick();
            return;
        }

        // Очищаем предыдущее выделение
        clearSelection();
        
        // Выделяем новую страну
        selectCountry(countryId);
        
        if (_callbacks.onClick) {
            _callbacks.onClick(countryId, {
                name: country.name
            });
        }
    }

    /**
     * Обработка наведения мыши на страну
     * @param {string} countryId - ID страны
     * @param {Event} event - событие мыши
     * @private
     */
    function _handleCountryMouseEnter(countryId, event) {
    _state.hoveredCountryId = countryId;
    
    const country = _countries[countryId];
    if (!country) return;

    if (countryId !== _state.selectedCountryId) {
        country.element.classList.add(_settings.hoveredClass);
    }

    // Ищем название страны в данных DataManager
    let displayName = country.name;
    
    // Если имя всё ещё равно ID (не найдено в SVG), пробуем DataManager
    if (displayName === countryId && window.DataManager) {
        const countryData = DataManager.getCountryById(countryId);
        if (countryData && countryData.name) {
            displayName = countryData.name;
            // Обновляем имя в кэше
            country.name = countryData.name;
        }
    }

    if (_settings.tooltipEnabled && _settings.showTooltipOnHover) {
        _showTooltipWithDelay(event, displayName, countryId);
    }

    if (_callbacks.onHover) {
        _callbacks.onHover(countryId, {
            name: displayName,
            event: event
        });
    }
}

    /**
     * Обработка ухода мыши со страны
     * @param {string} countryId - ID страны
     * @param {Event} event - событие мыши
     * @private
     */
    function _handleCountryMouseLeave(countryId, event) {
        _state.hoveredCountryId = null;
        
        const country = _countries[countryId];
        if (!country) return;

        country.element.classList.remove(_settings.hoveredClass);

        _hideTooltipWithDelay();

        if (_callbacks.onHoverOut) {
            _callbacks.onHoverOut(countryId, {
                name: country.name,
                event: event
            });
        }
    }

    // ==========================================
    // ТУЛТИП
    // ==========================================

    /**
     * Показывает тултип с задержкой
     * @param {Event} event - событие мыши
     * @param {string} text - текст тултипа
     * @param {string} countryId - ID страны
     * @private
     */
    function _showTooltipWithDelay(event, text, countryId) {
        if (_timers.tooltipShow) clearTimeout(_timers.tooltipShow);
        if (_timers.tooltipHide) clearTimeout(_timers.tooltipHide);
        
        _timers.tooltipShow = setTimeout(() => {
            _showTooltip(event, text, countryId);
        }, _settings.tooltipDelay);
    }

    /**
     * Показывает тултип
     * @param {Event} event - событие мыши
     * @param {string} text - текст
     * @param {string} countryId - ID страны
     * @private
     */
    function _showTooltip(event, text, countryId) {
        if (!_tooltipElement) return;

        _tooltipElement.textContent = text;
        
        const offset = _settings.tooltipOffset;
        let left = event.clientX + offset;
        let top = event.clientY - 40;
        
        const tooltipRect = _tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        if (left + tooltipRect.width > viewportWidth - 10) {
            left = event.clientX - tooltipRect.width - offset;
        }
        
        if (top < 10) {
            top = event.clientY + offset;
        }
        
        if (top + tooltipRect.height > viewportHeight - 10) {
            top = event.clientY - tooltipRect.height - offset;
        }
        
        _tooltipElement.style.left = `${left}px`;
        _tooltipElement.style.top = `${top}px`;
        _tooltipElement.style.opacity = '1';
        _tooltipElement.style.transform = 'translateY(0)';
        _tooltipElement.setAttribute('aria-hidden', 'false');
    }

    /**
     * Скрывает тултип с задержкой
     * @private
     */
    function _hideTooltipWithDelay() {
        if (_timers.tooltipShow) clearTimeout(_timers.tooltipShow);
        
        _timers.tooltipHide = setTimeout(() => {
            _hideTooltip();
        }, 100);
    }

    /**
     * Скрывает тултип
     * @private
     */
    function _hideTooltip() {
        if (!_tooltipElement) return;
        
        _tooltipElement.style.opacity = '0';
        _tooltipElement.style.transform = 'translateY(4px)';
        _tooltipElement.setAttribute('aria-hidden', 'true');
    }

    // ==========================================
    // УПРАВЛЕНИЕ ВЫДЕЛЕНИЕМ
    // ==========================================

    /**
     * Выбирает страну
     * @param {string} countryId - ID страны
     * @returns {boolean} успешность операции
     */
    function selectCountry(countryId) {
        console.log(`[MapManager] Выбор страны: ${countryId}`);
    
        const normalizedId = _normalizeCountryId(countryId);
        const country = _countries[normalizedId];
    
        if (!country) {
        console.error(`[MapManager] ❌ Страна "${normalizedId}" не найдена!`);
        
        const partialMatch = _findCountryByPartialId(normalizedId);
        if (partialMatch) {
            console.log(`[MapManager] Найдено частичное совпадение: ${partialMatch.id} -> ${partialMatch.name}`);
            return selectCountry(partialMatch.id);
        }
        
        const nameMatch = _findCountryByName(normalizedId);
        if (nameMatch) {
            console.log(`[MapManager] Найдено совпадение по имени: ${nameMatch.id} -> ${nameMatch.name}`);
            return selectCountry(nameMatch.id);
        }
        
        console.log('[MapManager] Доступные ID (первые 20):', Object.keys(_countries).slice(0, 20));
        return false;
    }

    // Снимаем предыдущее выделение со всех связанных частей
    if (_state.selectedConnectedIds && _state.selectedConnectedIds.length > 0) {
        _state.selectedConnectedIds.forEach(id => {
            _clearSingleCountryHighlight(id);
        });
    }

    // Получаем все связанные ID (территории)
    const connectedIds = _getConnectedCountryIds(normalizedId);
    
    // Выделяем все связанные части
    connectedIds.forEach(id => {
        const connectedCountry = _countries[id];
        if (connectedCountry) {
            connectedCountry.element.classList.add(_settings.selectedClass);
            connectedCountry.element.classList.remove(_settings.hoveredClass, _settings.highlightedClass);
        }
    });

    _state.selectedCountryId = normalizedId;
    _state.selectedConnectedIds = connectedIds;

    console.log(`[MapManager] ✅ Выбрана группа: ${country.name} (${connectedIds.length} частей)`);
    console.log(`[MapManager] Части: ${connectedIds.join(', ')}`);
    
    return true;
}

    /**
     * Снимает выделение со всех стран
     */
    function clearSelection() {
    if (!_state.selectedCountryId) return;
    
    console.log('[MapManager] Очистка выделения');
    
    // Очищаем все связанные части
    const connectedIds = _state.selectedConnectedIds || [_state.selectedCountryId];
    
    connectedIds.forEach(id => {
        const country = _countries[id];
        if (country) {
            country.element.classList.remove(_settings.selectedClass);
        }
    });
    
        _state.selectedCountryId = null;
        _state.selectedConnectedIds = [];
    }   

    /**
 * Получает все связанные ID страны (группировка территорий)
 * @param {string} countryId - ID страны
 * @returns {string[]} массив связанных ID
 * @private
 */
    function _getConnectedCountryIds(countryId) {
    // Проверяем DataManager
        if (window.DataManager) {
        // Используем getConnectedCountryIds из DataManager
            if (typeof DataManager.getConnectedCountryIds === 'function') {
            const connectedIds = DataManager.getConnectedCountryIds(countryId);
            if (connectedIds && connectedIds.length > 0) {
                return connectedIds.filter(id => _countries[id]);
            }
        }
        
        // Используем getTerritoryByCountryId
        if (typeof DataManager.getTerritoryByCountryId === 'function') {
            const territoryData = DataManager.getTerritoryByCountryId(countryId);
            if (territoryData && territoryData.territories) {
                return territoryData.territories.filter(id => _countries[id]);
            }
        }
    }

    return [countryId];
}

    /**
     * Очищает выделение с конкретной страны
     * @param {string} countryId - ID страны
     * @private
     */
    function _clearSingleCountryHighlight(countryId) {
        if (!countryId) return;

        const country = _countries[countryId];
        if (country) {
            country.element.classList.remove(
                _settings.selectedClass,
                _settings.hoveredClass,
                _settings.highlightedClass
            );
        }
    }

    /**
     * Ищет страну по частичному совпадению ID
     * @param {string} partialId - часть ID
     * @returns {object|null}
     * @private
     */
    function _findCountryByPartialId(partialId) {
        if (!partialId) return null;
        
        const ids = Object.keys(_countries);
        
        if (_countries[partialId]) return _countries[partialId];
        
        for (const id of ids) {
            if (id.includes(partialId) || partialId.includes(id)) {
                return _countries[id];
            }
        }
        
        for (const id of ids) {
            if (_levenshteinDistance(id, partialId) <= 2) {
                return _countries[id];
            }
        }
        
        return null;
    }

    /**
     * Ищет страну по имени
     * @param {string} name - имя страны
     * @returns {object|null}
     * @private
     */
    function _findCountryByName(name) {
        if (!name) return null;
        
        const searchName = name.toLowerCase();
        
        if (_state._countryByName && _state._countryByName.has(searchName)) {
            return _state._countryByName.get(searchName);
        }
        
        for (const [id, country] of Object.entries(_countries)) {
            if (country.name.toLowerCase().includes(searchName)) {
                return country;
            }
        }
        
        return null;
    }

    /**
     * Вычисляет расстояние Левенштейна между строками
     * @param {string} a - первая строка
     * @param {string} b - вторая строка
     * @returns {number} расстояние
     * @private
     */
    function _levenshteinDistance(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        const matrix = [];
        
        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[b.length][a.length];
    }

    // ==========================================
    // ПОДСВЕТКА СТРАН (ДЛЯ ПОИСКА)
    // ==========================================

    /**
     * Подсвечивает указанные страны
     * @param {string|string[]} countryIds - ID страны или массив ID
     */
    function highlightCountries(countryIds) {
        clearAllHighlights();

        const ids = Array.isArray(countryIds) ? countryIds : [countryIds];
        let highlightedCount = 0;
        
        ids.forEach(id => {
            const normalizedId = _normalizeCountryId(id);
            const country = _countries[normalizedId];
            
            if (country && normalizedId !== _state.selectedCountryId) {
                country.element.classList.add(_settings.highlightedClass);
                _state.highlightedCountries.push(normalizedId);
                highlightedCount++;
            }
        });

        console.log(`[MapManager] Подсвечено стран: ${highlightedCount}/${ids.length}`);
    }

    /**
     * Подсвечивает одну страну
     * @param {string} countryId - ID страны
     */
    function highlightCountry(countryId) {
        highlightCountries([countryId]);
    }

    /**
     * Очищает всю подсветку поиска
     */
    function clearAllHighlights() {
        if (_state.highlightedCountries.length === 0) return;
        
        _state.highlightedCountries.forEach(id => {
            const country = _countries[id];
            if (country) {
                country.element.classList.remove(_settings.highlightedClass);
            }
        });
        
        const count = _state.highlightedCountries.length;
        _state.highlightedCountries = [];
        
        console.log(`[MapManager] Очищена подсветка: ${count} стран`);
    }

    // ==========================================
    // ЦЕНТРИРОВАНИЕ
    // ==========================================

    /**
     * Центрирует карту на стране по ID
     * @param {string} countryId - ID страны
     * @param {boolean} animate - с анимацией
     * @param {boolean} adjustZoom - изменять ли зум
     * @returns {boolean} успешность
     */
    function centerOnCountry(countryId, animate = true, adjustZoom = false) {
        const normalizedId = _normalizeCountryId(countryId);
        const country = _countries[normalizedId];
        
        if (!country) {
            console.warn(`[MapManager] Не удалось центрироваться: страна "${normalizedId}" не найдена`);
            return false;
        }

        if (!window.ZoomManager) {
            console.warn('[MapManager] ZoomManager не доступен');
            return false;
        }

        try {
            const bbox = country.element.getBBox();
            
            if (bbox && bbox.width > 0 && bbox.height > 0) {
                const centerX = bbox.x + bbox.width / 2;
                const centerY = bbox.y + bbox.height / 2;
                
                ZoomManager.centerOn(centerX, centerY, animate);
                return true;
            }
        } catch (error) {
            console.warn('[MapManager] Ошибка центрирования:', error.message);
        }
        
        return false;
    }

    /**
     * Центрирует и приближает к стране
     * @param {string} countryId - ID страны
     */
    function zoomToCountry(countryId) {
        centerOnCountry(countryId, true, true);
    }

    // ==========================================
    // ИНФОРМАЦИЯ О КАРТЕ И СТРАНАХ
    // ==========================================

    /**
     * Получает список всех ID стран
     * @returns {string[]}
     */
    function getAllCountryIds() {
        return _state._allCountryIds ? [..._state._allCountryIds] : Object.keys(_countries);
    }

    /**
     * Получает информацию о стране
     * @param {string} countryId - ID страны
     * @returns {object|null}
     */
    function getCountryInfo(countryId) {
        const normalizedId = _normalizeCountryId(countryId);
        const country = _countries[normalizedId];
        
        if (!country) return null;

        let bbox = null;
        let centerX = 0;
        let centerY = 0;

        try {
            bbox = country.element.getBBox();
            centerX = bbox.x + bbox.width / 2;
            centerY = bbox.y + bbox.height / 2;
        } catch (e) {
            // Игнорируем ошибки getBBox
        }

        return {
            id: country.id,
            originalId: country.originalId,
            name: country.name,
            element: country.element,
            originalFill: country.originalFill,
            originalStroke: country.originalStroke,
            bbox: bbox ? {
                x: bbox.x,
                y: bbox.y,
                width: bbox.width,
                height: bbox.height,
                centerX: centerX,
                centerY: centerY
            } : null,
            isSelected: _state.selectedCountryId === normalizedId
        };
    }

    /**
     * Проверяет существование страны
     * @param {string} countryId - ID страны
     * @returns {boolean}
     */
    function countryExists(countryId) {
        const normalizedId = _normalizeCountryId(countryId);
        return !!_countries[normalizedId];
    }

    /**
     * Получает количество стран
     * @returns {number}
     */
    function getCountryCount() {
        return Object.keys(_countries).length;
    }

    /**
     * Получает имя страны по ID
     * @param {string} countryId - ID страны
     * @returns {string}
     */
    function getCountryName(countryId) {
        const normalizedId = _normalizeCountryId(countryId);
        const country = _countries[normalizedId];
        return country ? country.name : null;
    }

    /**
     * Получает состояние менеджера
     * @returns {object}
     */
    function getState() {
        return {
            isLoaded: _state.isLoaded,
            isLoading: _state.isLoading,
            selectedCountryId: _state.selectedCountryId,
            hoveredCountryId: _state.hoveredCountryId,
            countryCount: Object.keys(_countries).length,
            viewBox: _state.viewBox,
            error: _state.error
        };
    }

    /**
     * Проверяет, загружена ли карта
     * @returns {boolean}
     */
    function isMapLoaded() {
        return _state.isLoaded;
    }

    /**
     * Получает SVG элемент
     * @returns {SVGElement|null}
     */
    function getSVGElement() {
        return _svgElement;
    }

    // ==========================================
    // ВИЗУАЛЬНЫЕ ЭФФЕКТЫ
    // ==========================================

    /**
     * Устанавливает цвет страны
     * @param {string} countryId - ID страны
     * @param {string} color - цвет в CSS формате
     */
    function setCountryColor(countryId, color) {
        const normalizedId = _normalizeCountryId(countryId);
        const country = _countries[normalizedId];
        
        if (country) {
            country.element.style.fill = color;
        }
    }

    /**
     * Сбрасывает цвет страны на оригинальный
     * @param {string} countryId - ID страны
     */
    function resetCountryColor(countryId) {
        const normalizedId = _normalizeCountryId(countryId);
        const country = _countries[normalizedId];
        
        if (country && _originalStyles[normalizedId]) {
            country.element.style.fill = _originalStyles[normalizedId].fill;
        }
    }

    /**
     * Сбрасывает цвета всех стран
     */
    function resetAllColors() {
        Object.keys(_countries).forEach(id => {
            resetCountryColor(id);
        });
    }

    /**
     * Включает/выключает видимость страны
     * @param {string} countryId - ID страны
     * @param {boolean} visible - видимость
     */
    function setCountryVisibility(countryId, visible) {
        const normalizedId = _normalizeCountryId(countryId);
        const country = _countries[normalizedId];
        
        if (country) {
            if (visible) {
                country.element.classList.remove(_settings.disabledClass);
                country.element.style.pointerEvents = '';
            } else {
                country.element.classList.add(_settings.disabledClass);
                country.element.style.pointerEvents = 'none';
            }
        }
    }

    /**
     * Применяет пульсацию к стране
     * @param {string} countryId - ID страны
     * @param {number} duration - длительность в мс
     */
    function pulseCountry(countryId, duration = 2000) {
        const normalizedId = _normalizeCountryId(countryId);
        const country = _countries[normalizedId];
        
        if (!country) return;

        country.element.classList.add(_settings.highlightedClass);
        
        setTimeout(() => {
            country.element.classList.remove(_settings.highlightedClass);
        }, duration);
    }

    // ==========================================
    // ОБНОВЛЕНИЕ И СБРОС
    // ==========================================

    /**
     * Обновляет список стран (если SVG изменился)
     */
    function refreshCountries() {
        console.log('[MapManager] Обновление списка стран...');
        
        _unbindEvents();
        _countries = {};
        _originalStyles = {};
        
        _scanCountries();
        _buildCountryIndex();
        _bindEvents();
        
        console.log(`[MapManager] Обновлено: ${Object.keys(_countries).length} стран`);
    }

    /**
     * Сбрасывает всё состояние карты
     */
    function resetAll() {
        console.log('[MapManager] Полный сброс карты');
        
        clearSelection();
        clearAllHighlights();
        resetAllColors();
        
        _state.selectedCountryId = null;
        _state.hoveredCountryId = null;
        _state.highlightedCountries = [];
    }

    // ==========================================
    // ДИАГНОСТИКА И ОТЛАДКА
    // ==========================================

    /**
     * Выводит диагностическую информацию
     */
    function diagnose() {
        console.group('=== ДИАГНОСТИКА MAPMANAGER v3.1 ===');
        
        console.log('Состояние:', {
            isLoaded: _state.isLoaded,
            isLoading: _state.isLoading,
            selectedCountryId: _state.selectedCountryId,
            countryCount: Object.keys(_countries).length,
            eventsBound: _eventsBound,
            viewBox: _state.viewBox,
            error: _state.error
        });
        
        console.log('Контейнеры:', {
            svgContainer: !!_svgContainer,
            mapContainer: !!_mapContainer,
            svgElement: !!_svgElement
        });
        
        if (_svgElement) {
            const paths = _svgElement.querySelectorAll('path');
            console.log(`Path элементов в SVG: ${paths.length}`);
            
            const pathsWithId = _svgElement.querySelectorAll('path[id]');
            console.log(`Path с ID: ${pathsWithId.length}`);
            
            const countryPaths = _svgElement.querySelectorAll(`.${_settings.selectableClass}`);
            console.log(`Path с классом ${_settings.selectableClass}: ${countryPaths.length}`);
        }
        
        console.log('Первые 10 стран:', Object.entries(_countries).slice(0, 10).map(([id, c]) => ({
            id,
            name: c.name,
            originalId: c.originalId
        })));
        
        console.groupEnd();
    }

    /**
     * Экспортирует диагностику в строку
     * @returns {string}
     */
    function getDiagnosticReport() {
        const report = {
            version: '3.1',
            timestamp: new Date().toISOString(),
            state: getState(),
            countryCount: Object.keys(_countries).length,
            countryIds: Object.keys(_countries).slice(0, 50),
            svgElementExists: !!_svgElement,
            eventsBound: _eventsBound,
            settings: {
                animationDuration: _settings.animationDuration
            }
        };
        
        return JSON.stringify(report, null, 2);
    }

    // ==========================================
    // ЭКСПОРТ КАРТЫ
    // ==========================================

    /**
     * Экспортирует текущий вид карты как PNG изображение
     * @param {number} scale - масштаб экспорта (по умолчанию 2x)
     * @returns {Promise<string>} data URL изображения
     */
    async function exportAsImage(scale = 2) {
        if (!_svgElement) {
            console.error('[MapManager] Невозможно экспортировать: SVG не загружен');
            return null;
        }

        console.log(`[MapManager] Экспорт карты (${scale}x)...`);

        try {
            const svgClone = _svgElement.cloneNode(true);
            
            const viewBox = _state.viewBox || '0 0 1000 600';
            const [x, y, width, height] = viewBox.split(' ').map(Number);
            
            svgClone.setAttribute('width', width * scale);
            svgClone.setAttribute('height', height * scale);
            
            const svgData = new XMLSerializer().serializeToString(svgClone);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            const canvas = document.createElement('canvas');
            canvas.width = width * scale;
            canvas.height = height * scale;
            
            const ctx = canvas.getContext('2d');
            
            const img = new Image();
            
            return new Promise((resolve, reject) => {
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    URL.revokeObjectURL(url);
                    
                    const dataUrl = canvas.toDataURL('image/png');
                    console.log(`[MapManager] Экспорт завершен: ${canvas.width}x${canvas.height}`);
                    resolve(dataUrl);
                };
                
                img.onerror = (err) => {
                    URL.revokeObjectURL(url);
                    console.error('[MapManager] Ошибка экспорта:', err);
                    reject(err);
                };
                
                img.src = url;
            });

        } catch (error) {
            console.error('[MapManager] Ошибка экспорта:', error);
            return null;
        }
    }

    /**
     * Скачивает карту как PNG файл
     * @param {string} filename - имя файла
     * @param {number} scale - масштаб
     */
    async function downloadAsImage(filename = 'rp-map.png', scale = 2) {
        const dataUrl = await exportAsImage(scale);
        
        if (!dataUrl) return;
        
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;
        link.click();
        
        console.log(`[MapManager] Карта сохранена: ${filename}`);
    }

    // ==========================================
    // ОШИБКИ И ЗАГЛУШКИ
    // ==========================================

    /**
     * Показывает заглушку при ошибке загрузки
     * @param {string} message - сообщение об ошибке
     * @private
     */
    function _showErrorPlaceholder(message) {
        if (!_svgContainer) return;

        _svgContainer.innerHTML = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                color: #94a3b8;
                text-align: center;
                padding: 40px;
                font-family: system-ui, -apple-system, sans-serif;
            ">
                <div style="
                    font-size: 64px;
                    margin-bottom: 20px;
                    opacity: 0.6;
                ">🗺️</div>
                <h3 style="
                    font-size: 20px;
                    font-weight: 700;
                    color: #e2e8f0;
                    margin-bottom: 12px;
                ">Ошибка загрузки карты</h3>
                <p style="
                    font-size: 14px;
                    line-height: 1.6;
                    margin-bottom: 24px;
                    max-width: 400px;
                ">${message || 'Неизвестная ошибка'}</p>
                <button onclick="location.reload()" style="
                    padding: 10px 24px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: 600;
                    transition: background 0.2s;
                " onmouseover="this.style.background='#2563eb'"
                   onmouseout="this.style.background='#3b82f6'">
                    🔄 Попробовать снова
                </button>
            </div>
        `;
    }

    // ==========================================
    // УНИЧТОЖЕНИЕ
    // ==========================================

    /**
     * Уничтожает менеджер карты и очищает ресурсы
     */
    function destroy() {
        console.log('[MapManager] Уничтожение...');
        
        Object.values(_timers).forEach(timer => {
            if (timer) clearTimeout(timer);
        });
        _timers = {};

        _unbindEvents();

        clearSelection();
        clearAllHighlights();

        if (_tooltipElement && _tooltipElement.parentNode) {
            _tooltipElement.parentNode.removeChild(_tooltipElement);
            _tooltipElement = null;
        }

        if (_svgContainer) {
            _svgContainer.innerHTML = '';
        }

        _countries = {};
        _originalStyles = {};
        _svgElement = null;
        _state.isLoaded = false;
        _state.isLoading = false;
        _eventsBound = false;

        console.log('[MapManager] Уничтожен');
    }

    // ==========================================
    // ПУБЛИЧНЫЙ API
    // ==========================================

    return {
        // Инициализация и загрузка
        init,
        loadMap,
        refreshCountries,
        isMapLoaded,
        getSVGElement,

        // Выделение
        selectCountry,
        clearSelection,
        
        // Подсветка (поиск)
        highlightCountry,
        highlightCountries,
        clearAllHighlights,

        // Навигация
        centerOnCountry,
        zoomToCountry,

        // Информация
        getAllCountryIds,
        getCountryInfo,
        countryExists,
        getCountryCount,
        getCountryName,
        getState,

        // Визуальные эффекты
        setCountryColor,
        resetCountryColor,
        resetAllColors,
        setCountryVisibility,
        pulseCountry,

        // Экспорт
        exportAsImage,
        downloadAsImage,

        // Диагностика
        diagnose,
        getDiagnosticReport,

        // Сброс
        resetAll,
        destroy
    };

})();

/* ============================================================
   ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
   ============================================================ */

window.MapManager = MapManager;

/* ============================================================
   АВТОМАТИЧЕСКАЯ ДИАГНОСТИКА ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
   ============================================================ */

window.addEventListener('load', () => {
    setTimeout(() => {
        if (window.MapManager && typeof window.MapManager.isMapLoaded === 'function') {
            if (window.MapManager.isMapLoaded()) {
                console.log('[MapManager] Автодиагностика при загрузке:');
                window.MapManager.diagnose();
            }
        }
    }, 1500);
});