/* ============================================================
   utils.js — Вспомогательные утилиты и хелперы
   ============================================================ */

const Utils = (() => {
    'use strict';

    // ==========================================
    // РАБОТА С DOM
    // ==========================================

    /**
     * Безопасный поиск элемента по селектору
     * @param {string} selector - CSS селектор
     * @param {Element} parent - родительский элемент (по умолчанию document)
     * @returns {Element|null}
     */
    function $(selector, parent = document) {
        try {
            return parent.querySelector(selector);
        } catch (error) {
            console.error(`[Utils] Ошибка поиска элемента "${selector}":`, error);
            return null;
        }
    }

    /**
     * Безопасный поиск всех элементов по селектору
     * @param {string} selector - CSS селектор
     * @param {Element} parent - родительский элемент
     * @returns {NodeList|Array}
     */
    function $$(selector, parent = document) {
        try {
            return Array.from(parent.querySelectorAll(selector));
        } catch (error) {
            console.error(`[Utils] Ошибка поиска элементов "${selector}":`, error);
            return [];
        }
    }

    /**
     * Создание DOM-элемента с атрибутами
     * @param {string} tag - HTML тег
     * @param {object} attributes - атрибуты элемента
     * @param {string|Element|Array} children - дочерние элементы или текст
     * @returns {Element}
     */
    function createElement(tag, attributes = {}, children = null) {
        const element = document.createElement(tag);

        // Устанавливаем атрибуты
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                const eventName = key.slice(2).toLowerCase();
                element.addEventListener(eventName, value);
            } else if (key === 'html') {
                element.innerHTML = value;
            } else {
                element.setAttribute(key, value);
            }
        });

        // Добавляем дочерние элементы
        if (children !== null && children !== undefined) {
            if (typeof children === 'string' || typeof children === 'number') {
                element.textContent = children;
            } else if (children instanceof Element) {
                element.appendChild(children);
            } else if (Array.isArray(children)) {
                children.forEach(child => {
                    if (child instanceof Element) {
                        element.appendChild(child);
                    } else if (typeof child === 'string' || typeof child === 'number') {
                        element.appendChild(document.createTextNode(child));
                    }
                });
            }
        }

        return element;
    }

    /**
     * Безопасное удаление элемента из DOM
     * @param {Element|string} element - элемент или селектор
     */
    function removeElement(element) {
        try {
            const el = typeof element === 'string' ? $(element) : element;
            if (el && el.parentNode) {
                el.parentNode.removeChild(el);
                return true;
            }
        } catch (error) {
            console.error('[Utils] Ошибка удаления элемента:', error);
        }
        return false;
    }

    /**
     * Очистка содержимого элемента
     * @param {Element|string} element - элемент или селектор
     */
    function clearElement(element) {
        try {
            const el = typeof element === 'string' ? $(element) : element;
            if (el) {
                el.innerHTML = '';
                return true;
            }
        } catch (error) {
            console.error('[Utils] Ошибка очистки элемента:', error);
        }
        return false;
    }

    // ==========================================
    // РАБОТА С КЛАССАМИ
    // ==========================================

    /**
     * Добавление класса элементу
     * @param {Element|string} element - элемент или селектор
     * @param {string|string[]} classes - класс или массив классов
     */
    function addClass(element, classes) {
        try {
            const el = typeof element === 'string' ? $(element) : element;
            if (!el) return false;

            const classList = Array.isArray(classes) ? classes : [classes];
            el.classList.add(...classList);
            return true;
        } catch (error) {
            console.error('[Utils] Ошибка добавления класса:', error);
            return false;
        }
    }

    /**
     * Удаление класса у элемента
     * @param {Element|string} element - элемент или селектор
     * @param {string|string[]} classes - класс или массив классов
     */
    function removeClass(element, classes) {
        try {
            const el = typeof element === 'string' ? $(element) : element;
            if (!el) return false;

            const classList = Array.isArray(classes) ? classes : [classes];
            el.classList.remove(...classList);
            return true;
        } catch (error) {
            console.error('[Utils] Ошибка удаления класса:', error);
            return false;
        }
    }

    /**
     * Переключение класса
     * @param {Element|string} element - элемент или селектор
     * @param {string} className - имя класса
     * @param {boolean} force - принудительное состояние
     */
    function toggleClass(element, className, force) {
        try {
            const el = typeof element === 'string' ? $(element) : element;
            if (!el) return false;

            if (force !== undefined) {
                el.classList.toggle(className, force);
            } else {
                el.classList.toggle(className);
            }
            return el.classList.contains(className);
        } catch (error) {
            console.error('[Utils] Ошибка переключения класса:', error);
            return false;
        }
    }

    /**
     * Проверка наличия класса
     * @param {Element|string} element - элемент или селектор
     * @param {string} className - имя класса
     * @returns {boolean}
     */
    function hasClass(element, className) {
        try {
            const el = typeof element === 'string' ? $(element) : element;
            return el ? el.classList.contains(className) : false;
        } catch (error) {
            return false;
        }
    }

    // ==========================================
    // РАБОТА С СОБЫТИЯМИ
    // ==========================================

    /**
     * Делегирование событий
     * @param {Element} parent - родительский элемент
     * @param {string} eventType - тип события
     * @param {string} selector - селектор целевого элемента
     * @param {Function} handler - обработчик
     */
    function delegate(parent, eventType, selector, handler) {
        parent.addEventListener(eventType, function(event) {
            const target = event.target.closest(selector);
            if (target && parent.contains(target)) {
                handler.call(target, event, target);
            }
        });
    }

    /**
     * Debounce функция
     * @param {Function} func - функция для debounce
     * @param {number} wait - задержка в миллисекундах
     * @param {boolean} immediate - выполнить немедленно
     * @returns {Function}
     */
    function debounce(func, wait = 250, immediate = false) {
        let timeout;

        return function executedFunction(...args) {
            const context = this;
            
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };

            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            
            if (callNow) func.apply(context, args);
        };
    }

    /**
     * Throttle функция
     * @param {Function} func - функция для throttle
     * @param {number} limit - минимальный интервал в мс
     * @returns {Function}
     */
    function throttle(func, limit = 250) {
        let inThrottle;
        let lastFunc;
        let lastRan;

        return function executedFunction(...args) {
            const context = this;

            if (!inThrottle) {
                func.apply(context, args);
                lastRan = Date.now();
                inThrottle = true;

                setTimeout(() => {
                    inThrottle = false;
                }, limit);
            } else {
                clearTimeout(lastFunc);
                lastFunc = setTimeout(() => {
                    if (Date.now() - lastRan >= limit) {
                        func.apply(context, args);
                        lastRan = Date.now();
                    }
                }, limit - (Date.now() - lastRan));
            }
        };
    }

    /**
     * Однократное выполнение функции
     * @param {Function} func - функция
     * @returns {Function}
     */
    function once(func) {
        let executed = false;
        let result;

        return function(...args) {
            if (!executed) {
                executed = true;
                result = func.apply(this, args);
            }
            return result;
        };
    }

    /**
     * RequestAnimationFrame с полифилом
     * @param {Function} callback
     * @returns {number} ID анимации
     */
    function raf(callback) {
        return (window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                function(cb) { return setTimeout(cb, 16); }
        )(callback);
    }

    /**
     * CancelAnimationFrame с полифилом
     * @param {number} id - ID анимации
     */
    function caf(id) {
        (window.cancelAnimationFrame ||
         window.webkitCancelAnimationFrame ||
         window.mozCancelAnimationFrame ||
         function(id) { clearTimeout(id); }
        )(id);
    }

    // ==========================================
    // РАБОТА С ДАТАМИ И ВРЕМЕНЕМ
    // ==========================================

    /**
     * Форматирование даты
     * @param {Date|string|number} date - дата
     * @param {string} format - формат (короткий, длинный и т.д.)
     * @returns {string}
     */
    function formatDate(date, format = 'short') {
        try {
            const d = new Date(date);

            if (isNaN(d.getTime())) {
                return 'Некорректная дата';
            }

            const formats = {
                short: {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                },
                medium: {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric'
                },
                long: {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                },
                time: {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }
            };

            const options = formats[format] || formats.short;
            return d.toLocaleDateString('ru-RU', options);

        } catch (error) {
            console.error('[Utils] Ошибка форматирования даты:', error);
            return 'Ошибка даты';
        }
    }

    /**
     * Относительное время (3 минуты назад, 2 дня назад)
     * @param {Date|string|number} date - дата
     * @returns {string}
     */
    function timeAgo(date) {
        try {
            const now = new Date();
            const past = new Date(date);
            const diffMs = now - past;
            const diffSec = Math.floor(diffMs / 1000);
            const diffMin = Math.floor(diffSec / 60);
            const diffHour = Math.floor(diffMin / 60);
            const diffDay = Math.floor(diffHour / 24);
            const diffMonth = Math.floor(diffDay / 30);
            const diffYear = Math.floor(diffDay / 365);

            if (diffSec < 5) return 'только что';
            if (diffSec < 60) return `${diffSec} сек. назад`;
            if (diffMin < 60) return `${diffMin} мин. назад`;
            if (diffHour < 24) return `${diffHour} ч. назад`;
            if (diffDay < 30) return `${diffDay} дн. назад`;
            if (diffMonth < 12) return `${diffMonth} мес. назад`;
            return `${diffYear} г. назад`;

        } catch (error) {
            return 'неизвестно';
        }
    }

    /**
     * Уникальный ID
     * @param {string} prefix - префикс
     * @returns {string}
     */
    function generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // ==========================================
    // РАБОТА С ЧИСЛАМИ
    // ==========================================

    /**
     * Форматирование числа (разделители тысяч)
     * @param {number} number - число
     * @param {string} locale - локаль
     * @returns {string}
     */
    function formatNumber(number, locale = 'ru-RU') {
        try {
            return new Intl.NumberFormat(locale).format(number);
        } catch (error) {
            return number.toString();
        }
    }

    /**
     * Сокращение больших чисел (1.5K, 2.3M)
     * @param {number} number - число
     * @returns {string}
     */
    function compactNumber(number) {
        if (number === null || number === undefined || isNaN(number)) return '0';

        const abs = Math.abs(number);
        const sign = number < 0 ? '-' : '';

        if (abs >= 1e9) return sign + (abs / 1e9).toFixed(1) + 'B';
        if (abs >= 1e6) return sign + (abs / 1e6).toFixed(1) + 'M';
        if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + 'K';
        
        return sign + abs.toString();
    }

    /**
     * Случайное число в диапазоне
     * @param {number} min - минимум
     * @param {number} max - максимум
     * @param {boolean} integer - целое число
     * @returns {number}
     */
    function random(min, max, integer = true) {
        const value = Math.random() * (max - min) + min;
        return integer ? Math.floor(value) : value;
    }

    /**
     * Ограничение числа диапазоном
     * @param {number} value - значение
     * @param {number} min - минимум
     * @param {number} max - максимум
     * @returns {number}
     */
    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    /**
     * Линейная интерполяция
     * @param {number} start - начальное значение
     * @param {number} end - конечное значение
     * @param {number} t - коэффициент (0-1)
     * @returns {number}
     */
    function lerp(start, end, t) {
        return start + (end - start) * clamp(t, 0, 1);
    }

    // ==========================================
    // РАБОТА СО СТРОКАМИ
    // ==========================================

    /**
     * Обрезка строки с многоточием
     * @param {string} str - строка
     * @param {number} maxLength - максимальная длина
     * @returns {string}
     */
    function truncate(str, maxLength = 100) {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - 3) + '...';
    }

    /**
     * Преобразование в slug (url-совместимую строку)
     * @param {string} str - строка
     * @returns {string}
     */
    function slugify(str) {
        if (!str) return '';

        const ruToEn = {
            'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
            'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i',
            'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
            'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
            'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
            'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
            'э': 'e', 'ю': 'yu', 'я': 'ya'
        };

        return str
            .toLowerCase()
            .split('')
            .map(char => ruToEn[char] || char)
            .join('')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .substring(0, 100);
    }

    /**
     * Капитализация первой буквы
     * @param {string} str - строка
     * @returns {string}
     */
    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Экранирование HTML
     * @param {string} str - строка
     * @returns {string}
     */
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /**
     * Декодирование HTML
     * @param {string} str - строка
     * @returns {string}
     */
    function unescapeHTML(str) {
        const div = document.createElement('div');
        div.innerHTML = str;
        return div.textContent || div.innerText || '';
    }

    // ==========================================
    // РАБОТА С МАССИВАМИ И ОБЪЕКТАМИ
    // ==========================================

    /**
     * Глубокое клонирование объекта
     * @param {*} obj - объект для клонирования
     * @returns {*}
     */
    function deepClone(obj) {
        try {
            return JSON.parse(JSON.stringify(obj));
        } catch (error) {
            console.error('[Utils] Ошибка глубокого клонирования:', error);
            return obj;
        }
    }

    /**
     * Сортировка массива объектов по ключу
     * @param {Array} arr - массив
     * @param {string} key - ключ для сортировки
     * @param {boolean} ascending - по возрастанию
     * @returns {Array}
     */
    function sortByKey(arr, key, ascending = true) {
        if (!Array.isArray(arr)) return [];

        return [...arr].sort((a, b) => {
            const valA = a[key];
            const valB = b[key];

            if (typeof valA === 'string' && typeof valB === 'string') {
                return ascending 
                    ? valA.localeCompare(valB, 'ru') 
                    : valB.localeCompare(valA, 'ru');
            }

            return ascending ? valA - valB : valB - valA;
        });
    }

    /**
     * Группировка массива по ключу
     * @param {Array} arr - массив
     * @param {string} key - ключ для группировки
     * @returns {object}
     */
    function groupBy(arr, key) {
        if (!Array.isArray(arr)) return {};

        return arr.reduce((groups, item) => {
            const groupKey = item[key] || 'undefined';
            if (!groups[groupKey]) {
                groups[groupKey] = [];
            }
            groups[groupKey].push(item);
            return groups;
        }, {});
    }

    /**
     * Удаление дубликатов из массива
     * @param {Array} arr - массив
     * @param {string} key - ключ для сравнения объектов (опционально)
     * @returns {Array}
     */
    function unique(arr, key = null) {
        if (!Array.isArray(arr)) return [];

        if (key) {
            const seen = new Set();
            return arr.filter(item => {
                const value = item[key];
                if (seen.has(value)) return false;
                seen.add(value);
                return true;
            });
        }

        return [...new Set(arr)];
    }

    /**
     * Перемешивание массива (алгоритм Фишера-Йетса)
     * @param {Array} arr - массив
     * @returns {Array}
     */
    function shuffle(arr) {
        const shuffled = [...arr];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // ==========================================
    // РАБОТА С ЦВЕТОМ
    // ==========================================

    /**
     * HEX в RGB
     * @param {string} hex - цвет в HEX
     * @returns {object|null} {r, g, b}
     */
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * RGB в HEX
     * @param {number} r - красный (0-255)
     * @param {number} g - зелёный (0-255)
     * @param {number} b - синий (0-255)
     * @returns {string}
     */
    function rgbToHex(r, g, b) {
        return '#' + [r, g, b]
            .map(x => x.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Осветление цвета
     * @param {string} hex - HEX цвет
     * @param {number} percent - процент осветления (0-100)
     * @returns {string}
     */
    function lightenColor(hex, percent) {
        const rgb = hexToRgb(hex);
        if (!rgb) return hex;

        const t = percent / 100;
        const r = Math.round(rgb.r + (255 - rgb.r) * t);
        const g = Math.round(rgb.g + (255 - rgb.g) * t);
        const b = Math.round(rgb.b + (255 - rgb.b) * t);

        return rgbToHex(r, g, b);
    }

    /**
     * Затемнение цвета
     * @param {string} hex - HEX цвет
     * @param {number} percent - процент затемнения (0-100)
     * @returns {string}
     */
    function darkenColor(hex, percent) {
        const rgb = hexToRgb(hex);
        if (!rgb) return hex;

        const t = percent / 100;
        const r = Math.round(rgb.r * (1 - t));
        const g = Math.round(rgb.g * (1 - t));
        const b = Math.round(rgb.b * (1 - t));

        return rgbToHex(r, g, b);
    }

    /**
     * Случайный цвет
     * @param {boolean} pastel - пастельный оттенок
     * @returns {string}
     */
    function randomColor(pastel = false) {
        if (pastel) {
            const hue = Math.floor(Math.random() * 360);
            return `hsl(${hue}, 70%, 80%)`;
        }
        
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        return rgbToHex(r, g, b);
    }

    // ==========================================
    // РАБОТА С ХРАНИЛИЩЕМ
    // ==========================================

    /**
     * Безопасная запись в localStorage
     * @param {string} key - ключ
     * @param {*} value - значение
     * @returns {boolean}
     */
    function setStorage(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('[Utils] Ошибка записи в localStorage:', error);
            return false;
        }
    }

    /**
     * Безопасное чтение из localStorage
     * @param {string} key - ключ
     * @param {*} defaultValue - значение по умолчанию
     * @returns {*}
     */
    function getStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error('[Utils] Ошибка чтения из localStorage:', error);
            return defaultValue;
        }
    }

    /**
     * Удаление ключа из localStorage
     * @param {string} key - ключ
     * @returns {boolean}
     */
    function removeStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('[Utils] Ошибка удаления из localStorage:', error);
            return false;
        }
    }

    // ==========================================
    // РАБОТА С URL
    // ==========================================

    /**
     * Получение параметров URL
     * @param {string} param - имя параметра
     * @returns {string|null}
     */
    function getUrlParam(param) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(param);
    }

    /**
     * Установка параметров URL без перезагрузки
     * @param {object} params - объект параметров
     */
    function setUrlParams(params) {
        const url = new URL(window.location);
        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                url.searchParams.delete(key);
            } else {
                url.searchParams.set(key, value);
            }
        });
        window.history.replaceState({}, '', url);
    }

    /**
     * Копирование текста в буфер обмена
     * @param {string} text - текст для копирования
     * @returns {Promise<boolean>}
     */
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            // Fallback для старых браузеров
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            
            try {
                document.execCommand('copy');
                return true;
            } catch (err) {
                console.error('[Utils] Ошибка копирования:', err);
                return false;
            } finally {
                document.body.removeChild(textarea);
            }
        }
    }

    // ==========================================
    // ПРОВЕРКИ И ВАЛИДАЦИЯ
    // ==========================================

    /**
     * Проверка, является ли значение пустым
     * @param {*} value - значение
     * @returns {boolean}
     */
    function isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim().length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    }

    /**
     * Проверка на мобильное устройство
     * @returns {boolean}
     */
    function isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );
    }

    /**
     * Проверка поддержки сенсорного экрана
     * @returns {boolean}
     */
    function isTouchDevice() {
        return ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               (navigator.msMaxTouchPoints > 0);
    }

    /**
     * Проверка поддержки WebP
     * @returns {Promise<boolean>}
     */
    async function supportsWebP() {
        if (!self.createImageBitmap) return false;

        const webpData = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
        
        try {
            const response = await fetch(webpData);
            const blob = await response.blob();
            return blob.type === 'image/webp';
        } catch {
            return false;
        }
    }

    // ==========================================
    // ЛОГИРОВАНИЕ И ОТЛАДКА
    // ==========================================

    /**
     * Структурированное логирование
     * @param {string} level - уровень (log, warn, error, info)
     * @param {string} module - название модуля
     * @param {string} message - сообщение
     * @param {*} data - дополнительные данные
     */
    function log(level, module, message, data = null) {
        if (!window.DEBUG_MODE && level === 'log') return;

        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${module}]`;

        switch (level) {
            case 'error':
                console.error(prefix, message, data || '');
                break;
            case 'warn':
                console.warn(prefix, message, data || '');
                break;
            case 'info':
                console.info(prefix, message, data || '');
                break;
            default:
                console.log(prefix, message, data || '');
        }
    }

    /**
     * Измерение времени выполнения функции
     * @param {Function} func - функция
     * @param {string} label - метка
     * @returns {Function}
     */
    function measurePerformance(func, label = 'Function') {
        return function(...args) {
            const start = performance.now();
            const result = func.apply(this, args);
            const end = performance.now();
            
            console.log(`[Utils] ${label} выполнена за ${(end - start).toFixed(2)}мс`);
            return result;
        };
    }

    // ==========================================
    // ПУБЛИЧНЫЙ API
    // ==========================================

    return {
        // DOM
        $,
        $$,
        createElement,
        removeElement,
        clearElement,

        // Классы
        addClass,
        removeClass,
        toggleClass,
        hasClass,

        // События
        delegate,
        debounce,
        throttle,
        once,
        raf,
        caf,

        // Дата и время
        formatDate,
        timeAgo,
        generateId,

        // Числа
        formatNumber,
        compactNumber,
        random,
        clamp,
        lerp,

        // Строки
        truncate,
        slugify,
        capitalize,
        escapeHTML,
        unescapeHTML,

        // Массивы и объекты
        deepClone,
        sortByKey,
        groupBy,
        unique,
        shuffle,

        // Цвета
        hexToRgb,
        rgbToHex,
        lightenColor,
        darkenColor,
        randomColor,

        // Хранилище
        setStorage,
        getStorage,
        removeStorage,

        // URL и буфер
        getUrlParam,
        setUrlParams,
        copyToClipboard,

        // Проверки
        isEmpty,
        isMobile,
        isTouchDevice,
        supportsWebP,

        // Отладка
        log,
        measurePerformance
    };

})();


/* ============================================================
   ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
   ============================================================ */

window.Utils = Utils;


/* ============================================================
   ВСТРОЕННЫЕ УТИЛИТЫ ДЛЯ УДОБСТВА (алиасы)
   ============================================================ */

// Короткие алиасы для часто используемых функций
window.$ = Utils.$;
window.$$ = Utils.$$;


/* ============================================================
   ПОЛИФИЛЫ ДЛЯ СТАРЫХ БРАУЗЕРОВ
   ============================================================ */

// Element.closest() полифил
if (!Element.prototype.closest) {
    Element.prototype.closest = function(selector) {
        let el = this;
        while (el && el.nodeType === 1) {
            if (el.matches(selector)) return el;
            el = el.parentNode;
        }
        return null;
    };
}

// Element.matches() полифил
if (!Element.prototype.matches) {
    Element.prototype.matches = 
        Element.prototype.matchesSelector ||
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector ||
        Element.prototype.oMatchesSelector ||
        Element.prototype.webkitMatchesSelector ||
        function(selector) {
            const matches = (this.document || this.ownerDocument).querySelectorAll(selector);
            let i = matches.length;
            while (--i >= 0 && matches.item(i) !== this) {}
            return i > -1;
        };
}

// Array.from() полифил
if (!Array.from) {
    Array.from = function(arrayLike) {
        return Array.prototype.slice.call(arrayLike);
    };
}

// Object.entries() полифил
if (!Object.entries) {
    Object.entries = function(obj) {
        const ownProps = Object.keys(obj);
        let i = ownProps.length;
        const resArray = new Array(i);
        while (i--) {
            resArray[i] = [ownProps[i], obj[ownProps[i]]];
        }
        return resArray;
    };
}

// Object.assign() полифил
if (!Object.assign) {
    Object.assign = function(target) {
        if (target === null || target === undefined) {
            throw new TypeError('Cannot convert undefined or null to object');
        }
        const to = Object(target);
        for (let index = 1; index < arguments.length; index++) {
            const nextSource = arguments[index];
            if (nextSource !== null && nextSource !== undefined) {
                for (const nextKey in nextSource) {
                    if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                        to[nextKey] = nextSource[nextKey];
                    }
                }
            }
        }
        return to;
    };
}


/* ============================================================
   ИНИЦИАЛИЗАЦИЯ УТИЛИТ ПРИ ЗАГРУЗКЕ
   ============================================================ */

console.log('[Utils] Утилиты загружены и готовы к использованию');
console.log('[Utils] Доступные модули:', Object.keys(Utils).join(', '));