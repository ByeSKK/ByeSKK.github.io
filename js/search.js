/* ============================================================
   search.js — SearchManager: Поиск стран и навигация
   Автодополнение, фильтрация, предложения, история поиска
   ============================================================ */

const SearchManager = (() => {
    'use strict';

    // ==========================================
    // ПРИВАТНЫЕ ПЕРЕМЕННЫЕ
    // ==========================================

    /** DOM-элементы */
    let _elements = {
        searchInput: null,
        searchContainer: null,
        suggestionsList: null,
        searchIcon: null,
        clearButton: null,
        resultsCount: null
    };

    /** Колбэки */
    let _callbacks = {
        onSelect: null,
        onSearch: null,
        onClear: null,
        onFocus: null,
        onBlur: null
    };

    /** Состояние */
    let _state = {
        isOpen: false,
        isSearching: false,
        query: '',
        results: [],
        selectedIndex: -1,
        totalResults: 0,
        isFocused: false
    };

    /** Настройки */
    let _settings = {
        minQueryLength: 1,
        maxResults: 10,
        debounceDelay: 250,
        suggestionItemClass: 'search-suggestion',
        activeItemClass: 'search-suggestion-active',
        highlightedClass: 'search-highlight',
        showCountryFlag: true,
        showCountryCapital: true,
        showCountryAlliance: true,
        searchFields: ['name', 'capital', 'leader', 'alliance'],
        sortBy: 'relevance', // relevance, name, population
        enableHistory: true,
        maxHistoryItems: 5,
        animationDuration: 200,
        placeholder: 'Поиск страны...',
        noResultsText: 'Страны не найдены',
        searchingText: 'Поиск...',
        errorText: 'Ошибка поиска'
    };

    /** Таймеры */
    let _timers = {};

    /** Кэш */
    let _cache = {
        allCountries: [],
        searchHistory: [],
        lastResults: []
    };

    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ
    // ==========================================

    /**
     * Инициализация менеджера поиска
     * @param {object} options - параметры
     */
    function init(options = {}) {
        console.log('[SearchManager] Инициализация...');

        // Сохраняем элементы
        _elements.searchInput = options.searchInput || document.getElementById('searchInput');

        // Сохраняем колбэки
        if (options.onSelect) _callbacks.onSelect = options.onSelect;
        if (options.onSearch) _callbacks.onSearch = options.onSearch;
        if (options.onClear) _callbacks.onClear = options.onClear;
        if (options.onFocus) _callbacks.onFocus = options.onFocus;
        if (options.onBlur) _callbacks.onBlur = options.onBlur;

        // Обновляем настройки
        if (options.settings) {
            _settings = { ..._settings, ...options.settings };
        }

        // Проверяем наличие поля поиска
        if (!_elements.searchInput) {
            console.error('[SearchManager] Поле поиска не найдено');
            return false;
        }

        // Создаём обёртку и дополнительные элементы
        _createSearchStructure();

        // Загружаем историю
        _loadSearchHistory();

        // Привязываем события
        _bindEvents();

        console.log('[SearchManager] Инициализация завершена');
        return true;
    }

    /**
     * Создаёт структуру поиска
     */
    function _createSearchStructure() {
        // Создаём контейнер-обёртку
        _elements.searchContainer = _createElement('div', {
            className: 'search-container'
        });

        // Оборачиваем input в контейнер
        const parent = _elements.searchInput.parentNode;
        parent.insertBefore(_elements.searchContainer, _elements.searchInput);
        _elements.searchContainer.appendChild(_elements.searchInput);

        // Иконка поиска
        _elements.searchIcon = _createElement('span', {
            className: 'search-icon',
            html: '🔍'
        });
        _elements.searchContainer.appendChild(_elements.searchIcon);

        // Кнопка очистки
        _elements.clearButton = _createElement('button', {
            className: 'search-clear hidden',
            title: 'Очистить поиск',
            html: '✕',
            onClick: () => clearSearch()
        });
        _elements.searchContainer.appendChild(_elements.clearButton);

        // Счётчик результатов
        _elements.resultsCount = _createElement('span', {
            className: 'search-results-count hidden'
        });
        _elements.searchContainer.appendChild(_elements.resultsCount);

        // Список предложений
        _elements.suggestionsList = _createElement('div', {
            className: 'search-suggestions hidden'
        });
        _elements.searchContainer.appendChild(_elements.suggestionsList);

        // Обновляем placeholder
        _elements.searchInput.placeholder = _settings.placeholder;
        _elements.searchInput.setAttribute('autocomplete', 'off');
        _elements.searchInput.setAttribute('aria-label', 'Поиск страны');
        _elements.searchInput.setAttribute('aria-autocomplete', 'list');
        _elements.searchInput.setAttribute('role', 'combobox');
    }

    /**
     * Привязывает события
     */
    function _bindEvents() {
        if (!_elements.searchInput) return;

        // Ввод текста с debounce
        _elements.searchInput.addEventListener('input', 
            Utils.debounce(_handleInput, _settings.debounceDelay)
        );

        // Мгновенная реакция на некоторые клавиши
        _elements.searchInput.addEventListener('keydown', _handleKeyDown);

        // Фокус
        _elements.searchInput.addEventListener('focus', () => {
            _state.isFocused = true;
            _elements.searchContainer.classList.add('search-focused');
            
            if (_state.query.length >= _settings.minQueryLength) {
                _openSuggestions();
            } else if (_cache.searchHistory.length > 0) {
                _showSearchHistory();
            }

            if (_callbacks.onFocus) {
                _callbacks.onFocus();
            }
        });

        // Потеря фокуса
        _elements.searchInput.addEventListener('blur', () => {
            // Задержка, чтобы успел сработать клик по предложению
            _timers.blur = setTimeout(() => {
                _state.isFocused = false;
                _elements.searchContainer.classList.remove('search-focused');
                _closeSuggestions();
                
                if (_callbacks.onBlur) {
                    _callbacks.onBlur();
                }
            }, 200);
        });

        // Закрытие по клику вне поиска
        document.addEventListener('click', (event) => {
            if (_state.isOpen && 
                !_elements.searchContainer.contains(event.target)) {
                _closeSuggestions();
            }
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && _state.isOpen) {
                _closeSuggestions();
                _elements.searchInput.blur();
            }
        });

        // Горячая клавиша для фокуса поиска
        document.addEventListener('keydown', (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
                event.preventDefault();
                _elements.searchInput.focus();
            }
            
            // Слэш для быстрого поиска (как во многих приложениях)
            if (event.key === '/' && 
                document.activeElement !== _elements.searchInput &&
                document.activeElement?.tagName !== 'INPUT' &&
                document.activeElement?.tagName !== 'TEXTAREA') {
                event.preventDefault();
                _elements.searchInput.focus();
            }
        });
    }

    // ==========================================
    // ОБРАБОТЧИКИ СОБЫТИЙ
    // ==========================================

    /**
     * Обработка ввода текста
     */
    function _handleInput() {
        const query = _elements.searchInput.value.trim();
        _state.query = query;

        // Показываем/скрываем кнопку очистки
        _elements.clearButton.classList.toggle('hidden', query.length === 0);

        if (query.length < _settings.minQueryLength) {
            _state.results = [];
            _state.totalResults = 0;
            _state.selectedIndex = -1;
            
            _closeSuggestions();
            _updateResultsCount();
            
            // Показываем историю если поле пустое и в фокусе
            if (query.length === 0 && _state.isFocused) {
                _showSearchHistory();
            }

            // Оповещаем об очистке поиска
            if (_callbacks.onClear) {
                _callbacks.onClear();
            }
            if (_callbacks.onSearch) {
                _callbacks.onSearch('');
            }

            return;
        }

        // Выполняем поиск
        _performSearch(query);
    }

    /**
     * Обработка нажатий клавиш
     * @param {KeyboardEvent} event
     */
    function _handleKeyDown(event) {
        if (!_state.isOpen) {
            // Открываем предложения при нажатии стрелок
            if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && 
                _state.query.length >= _settings.minQueryLength) {
                event.preventDefault();
                _openSuggestions();
                _updateSelection(event.key === 'ArrowDown' ? 1 : -1);
            }
            return;
        }

        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                _updateSelection(1);
                break;

            case 'ArrowUp':
                event.preventDefault();
                _updateSelection(-1);
                break;

            case 'Enter':
                event.preventDefault();
                _selectCurrentItem();
                break;

            case 'Escape':
                event.preventDefault();
                _closeSuggestions();
                break;

            case 'Tab':
                // Выбираем текущий элемент при табуляции
                if (_state.selectedIndex >= 0) {
                    event.preventDefault();
                    _selectCurrentItem();
                }
                break;
        }
    }

    // ==========================================
    // ПОИСК
    // ==========================================

    /**
     * Выполняет поиск стран
     * @param {string} query - поисковый запрос
     */
    function _performSearch(query) {
        if (!window.DataManager) {
            console.error('[SearchManager] DataManager не доступен');
            return;
        }

        _state.isSearching = true;

        // Получаем все страны (кэшируем)
        if (_cache.allCountries.length === 0) {
            _cache.allCountries = DataManager.getAllCountries();
        }

        const allCountries = _cache.allCountries;
        const results = [];

        const searchQuery = query.toLowerCase();

        // Поиск по всем указанным полям
        allCountries.forEach(country => {
            let relevance = 0;
            const matchDetails = [];

            _settings.searchFields.forEach(field => {
                const value = country[field];
                if (!value) return;

                const fieldValue = value.toString().toLowerCase();
                
                // Точное совпадение
                if (fieldValue === searchQuery) {
                    relevance += 100;
                    matchDetails.push({ field, type: 'exact' });
                }
                // Начинается с запроса
                else if (fieldValue.startsWith(searchQuery)) {
                    relevance += 50;
                    matchDetails.push({ field, type: 'starts' });
                }
                // Содержит запрос
                else if (fieldValue.includes(searchQuery)) {
                    relevance += 25;
                    matchDetails.push({ field, type: 'contains' });
                }
                // Содержит все слова из запроса
                else if (_containsAllWords(fieldValue, searchQuery)) {
                    relevance += 15;
                    matchDetails.push({ field, type: 'words' });
                }
            });

            if (relevance > 0) {
                results.push({
                    country,
                    relevance,
                    matchDetails
                });
            }
        });

        // Сортировка
        _sortResults(results);

        // Сохраняем результаты
        _state.results = results.slice(0, _settings.maxResults);
        _state.totalResults = results.length;
        _state.selectedIndex = -1;
        _state.isSearching = false;

        // Кэшируем последние результаты
        _cache.lastResults = results;

        // Обновляем UI
        _renderSuggestions();
        _updateResultsCount();

        // Открываем предложения
        if (_state.results.length > 0) {
            _openSuggestions();
        } else {
            _showNoResults();
        }

        // Вызываем колбэк
        if (_callbacks.onSearch) {
            _callbacks.onSearch(query);
        }
    }

    /**
     * Проверяет, содержит ли строка все слова из запроса
     * @param {string} text - текст для поиска
     * @param {string} query - запрос
     * @returns {boolean}
     */
    function _containsAllWords(text, query) {
        const words = query.split(/\s+/);
        return words.every(word => text.includes(word));
    }

    /**
     * Сортирует результаты поиска
     * @param {Array} results - массив результатов
     */
    function _sortResults(results) {
        switch (_settings.sortBy) {
            case 'name':
                results.sort((a, b) => 
                    a.country.name.localeCompare(b.country.name, 'ru')
                );
                break;
            
            case 'population':
                results.sort((a, b) => 
                    (Number(b.country.population) || 0) - (Number(a.country.population) || 0)
                );
                break;
            
            case 'relevance':
            default:
                results.sort((a, b) => b.relevance - a.relevance);
                break;
        }
    }

    // ==========================================
    // ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ
    // ==========================================

    /**
     * Отображает список предложений
     */
    function _renderSuggestions() {
        if (!_elements.suggestionsList) return;

        // Очищаем список
        _elements.suggestionsList.innerHTML = '';

        if (_state.results.length === 0) {
            _showNoResults();
            return;
        }

        // Создаём элементы списка
        _state.results.forEach((result, index) => {
            const item = _createSuggestionItem(result, index);
            _elements.suggestionsList.appendChild(item);
        });

        // Показываем количество всех результатов
        if (_state.totalResults > _settings.maxResults) {
            const moreInfo = _createElement('div', {
                className: 'search-more-info'
            }, `Показано ${_settings.maxResults} из ${_state.totalResults} результатов`);
            _elements.suggestionsList.appendChild(moreInfo);
        }

        // Обновляем ARIA
        _elements.searchInput.setAttribute('aria-expanded', 'true');
    }

    /**
     * Создаёт элемент предложения
     * @param {object} result - результат поиска
     * @param {number} index - индекс
     * @returns {Element}
     */
    function _createSuggestionItem(result, index) {
        const { country, matchDetails } = result;

        const item = _createElement('div', {
            className: _settings.suggestionItemClass,
            dataset: { index, countryId: country.id },
            onMouseDown: (e) => {
                // Предотвращаем blur до клика
                e.preventDefault();
                _selectItem(index);
            },
            onMouseEnter: () => {
                _state.selectedIndex = index;
                _updateSuggestionHighlight();
            }
        });

        // Флаг
        if (_settings.showCountryFlag) {
            const flag = _createElement('img', {
                className: 'suggestion-flag',
                src: country.flag || 'flags/default.png',
                alt: country.name,
                onerror: function() { 
                    this.src = 'flags/default.png'; 
                }
            });
            item.appendChild(flag);
        }

        // Информация
        const info = _createElement('div', {
            className: 'suggestion-info'
        });

        // Название с подсветкой совпадения
        const nameEl = _createElement('div', {
            className: 'suggestion-name',
            html: _highlightMatch(country.name, _state.query)
        });
        info.appendChild(nameEl);

        // Детали
        const detailsEl = _createElement('div', {
            className: 'suggestion-details'
        });

        if (_settings.showCountryCapital && country.capital) {
            const capitalText = _highlightMatch(
                `🏛️ ${country.capital}`, 
                _state.query
            );
            detailsEl.innerHTML += capitalText;
        }

        if (_settings.showCountryAlliance && country.alliance && country.alliance !== 'Нет') {
            detailsEl.innerHTML += ` · 🛡️ ${country.alliance}`;
        }

        if (country.population) {
            detailsEl.innerHTML += ` · 👥 ${Utils.compactNumber(country.population)}`;
        }

        info.appendChild(detailsEl);
        item.appendChild(info);

        // Иконка выбора
        const selectIcon = _createElement('span', {
            className: 'suggestion-select-icon'
        }, '↩');
        item.appendChild(selectIcon);

        return item;
    }

    /**
     * Подсвечивает совпадения в тексте
     * @param {string} text - исходный текст
     * @param {string} query - поисковый запрос
     * @returns {string} HTML с подсветкой
     */
    function _highlightMatch(text, query) {
        if (!query || query.length === 0) return Utils.escapeHTML(text);

        const escapedText = Utils.escapeHTML(text);
        const escapedQuery = Utils.escapeHTML(query);
        
        // Экранируем специальные символы regex
        const regexStr = escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${regexStr})`, 'gi');

        return escapedText.replace(regex, 
            `<mark class="${_settings.highlightedClass}">$1</mark>`
        );
    }

    /**
     * Показывает сообщение об отсутствии результатов
     */
    function _showNoResults() {
        if (!_elements.suggestionsList) return;

        _elements.suggestionsList.innerHTML = `
            <div class="search-no-results">
                <span class="no-results-icon">🔍</span>
                <p>${_settings.noResultsText}</p>
                <span class="no-results-query">по запросу "${Utils.escapeHTML(_state.query)}"</span>
            </div>
        `;

        // Показываем предложения даже при отсутствии результатов
        _openSuggestions();
    }

    /**
     * Показывает историю поиска
     */
    function _showSearchHistory() {
        if (!_elements.suggestionsList || 
            !_settings.enableHistory || 
            _cache.searchHistory.length === 0) {
            return;
        }

        _elements.suggestionsList.innerHTML = '';

        // Заголовок истории
        const historyHeader = _createElement('div', {
            className: 'search-history-header'
        }, [
            _createElement('span', {}, '📋 Недавние'),
            _createElement('button', {
                className: 'clear-history-btn',
                onClick: () => _clearSearchHistory()
            }, 'Очистить')
        ]);
        _elements.suggestionsList.appendChild(historyHeader);

        // Элементы истории
        _cache.searchHistory.forEach((item, index) => {
            const historyItem = _createElement('div', {
                className: 'search-history-item',
                onMouseDown: (e) => {
                    e.preventDefault();
                    _elements.searchInput.value = item.query;
                    _handleInput();
                }
            }, [
                _createElement('span', { className: 'history-icon' }, '🕒'),
                _createElement('span', { className: 'history-query' }, item.query),
                _createElement('span', { className: 'history-time' }, 
                    Utils.timeAgo(item.timestamp))
            ]);
            _elements.suggestionsList.appendChild(historyItem);
        });

        _openSuggestions();
    }

    // ==========================================
    // УПРАВЛЕНИЕ ВЫБОРОМ
    // ==========================================

    /**
     * Обновляет выбранный индекс
     * @param {number} direction - направление (1 вниз, -1 вверх)
     */
    function _updateSelection(direction) {
        const maxIndex = _state.results.length - 1;

        if (maxIndex < 0) {
            _state.selectedIndex = -1;
            return;
        }

        let newIndex = _state.selectedIndex + direction;

        // Циклическая навигация
        if (newIndex > maxIndex) newIndex = 0;
        if (newIndex < 0) newIndex = maxIndex;

        _state.selectedIndex = newIndex;
        _updateSuggestionHighlight();
        _scrollToSelected();
    }

    /**
     * Обновляет подсветку активного предложения
     */
    function _updateSuggestionHighlight() {
        if (!_elements.suggestionsList) return;

        const items = _elements.suggestionsList.querySelectorAll(
            `.${_settings.suggestionItemClass}`
        );

        items.forEach((item, index) => {
            if (index === _state.selectedIndex) {
                item.classList.add(_settings.activeItemClass);
                item.setAttribute('aria-selected', 'true');
            } else {
                item.classList.remove(_settings.activeItemClass);
                item.setAttribute('aria-selected', 'false');
            }
        });
    }

    /**
     * Прокручивает список к выбранному элементу
     */
    function _scrollToSelected() {
        if (!_elements.suggestionsList) return;

        const activeItem = _elements.suggestionsList.querySelector(
            `.${_settings.activeItemClass}`
        );

        if (activeItem) {
            activeItem.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth'
            });
        }
    }

    /**
     * Выбирает текущий подсвеченный элемент
     */
    function _selectCurrentItem() {
        if (_state.selectedIndex >= 0 && 
            _state.selectedIndex < _state.results.length) {
            _selectItem(_state.selectedIndex);
        } else if (_state.results.length === 1) {
            // Если только один результат, выбираем его
            _selectItem(0);
        }
    }

    /**
     * Выбирает элемент по индексу
     * @param {number} index - индекс
     */
    function _selectItem(index) {
        if (index < 0 || index >= _state.results.length) return;

        const result = _state.results[index];
        const country = result.country;

        console.log(`[SearchManager] Выбрана страна: ${country.name}`);

        // Сохраняем в историю
        _addToHistory(_state.query);

        // Обновляем поле ввода
        _elements.searchInput.value = country.name;
        _state.query = country.name;
        _elements.clearButton.classList.remove('hidden');

        // Закрываем предложения
        _closeSuggestions();

        // Снимаем фокус с поиска
        _elements.searchInput.blur();

        // Вызываем колбэк выбора
        if (_callbacks.onSelect) {
            _callbacks.onSelect(country.id, country);
        }

        // Обновляем счётчик
        _updateResultsCount();
    }

    // ==========================================
    // ОТКРЫТИЕ/ЗАКРЫТИЕ ПРЕДЛОЖЕНИЙ
    // ==========================================

    /**
     * Открывает список предложений
     */
    function _openSuggestions() {
        if (_state.isOpen) return;

        _state.isOpen = true;
        _elements.suggestionsList.classList.remove('hidden');
        _elements.suggestionsList.style.animation = 
            `fadeInDown ${_settings.animationDuration}ms ease`;

        _elements.searchContainer.classList.add('search-has-suggestions');
    }

    /**
     * Закрывает список предложений
     */
    function _closeSuggestions() {
        if (!_state.isOpen) return;

        _state.isOpen = false;
        _elements.suggestionsList.classList.add('hidden');
        _elements.searchContainer.classList.remove('search-has-suggestions');
        _elements.searchInput.setAttribute('aria-expanded', 'false');
    }

    // ==========================================
    // ОЧИСТКА И СБРОС
    // ==========================================

    /**
     * Очищает поиск
     */
    function clearSearch() {
        console.log('[SearchManager] Очистка поиска');

        _elements.searchInput.value = '';
        _elements.searchInput.focus();
        
        _state.query = '';
        _state.results = [];
        _state.totalResults = 0;
        _state.selectedIndex = -1;
        
        _elements.clearButton.classList.add('hidden');
        _closeSuggestions();
        _updateResultsCount();

        // Вызываем колбэки
        if (_callbacks.onClear) {
            _callbacks.onClear();
        }
        if (_callbacks.onSearch) {
            _callbacks.onSearch('');
        }
    }

    /**
     * Сбрасывает состояние поиска
     */
    function reset() {
        clearSearch();
        _cache.allCountries = [];
        _cache.lastResults = [];
        _state.isSearching = false;
    }

    // ==========================================
    // ИСТОРИЯ ПОИСКА
    // ==========================================

    /**
     * Добавляет запрос в историю
     * @param {string} query - поисковый запрос
     */
    function _addToHistory(query) {
        if (!_settings.enableHistory || !query) return;

        // Удаляем дубликат
        _cache.searchHistory = _cache.searchHistory.filter(
            item => item.query.toLowerCase() !== query.toLowerCase()
        );

        // Добавляем в начало
        _cache.searchHistory.unshift({
            query,
            timestamp: Date.now()
        });

        // Ограничиваем размер
        if (_cache.searchHistory.length > _settings.maxHistoryItems) {
            _cache.searchHistory = _cache.searchHistory.slice(
                0, 
                _settings.maxHistoryItems
            );
        }

        // Сохраняем в localStorage
        _saveSearchHistory();
    }

    /**
     * Загружает историю из localStorage
     */
    function _loadSearchHistory() {
        const saved = Utils.getStorage('rp-search-history', []);
        
        if (Array.isArray(saved)) {
            _cache.searchHistory = saved.slice(0, _settings.maxHistoryItems);
        }
    }

    /**
     * Сохраняет историю в localStorage
     */
    function _saveSearchHistory() {
        Utils.setStorage('rp-search-history', _cache.searchHistory);
    }

    /**
     * Очищает историю поиска
     */
    function _clearSearchHistory() {
        _cache.searchHistory = [];
        Utils.removeStorage('rp-search-history');
        
        if (_elements.suggestionsList) {
            _elements.suggestionsList.innerHTML = '';
        }
        
        _closeSuggestions();
        
        console.log('[SearchManager] История поиска очищена');
    }

    // ==========================================
    // УТИЛИТЫ
    // ==========================================

    /**
     * Обновляет счётчик результатов
     */
    function _updateResultsCount() {
        if (!_elements.resultsCount) return;

        if (_state.totalResults > 0) {
            _elements.resultsCount.textContent = 
                `Найдено: ${_state.totalResults}`;
            _elements.resultsCount.classList.remove('hidden');
        } else if (_state.query.length >= _settings.minQueryLength) {
            _elements.resultsCount.textContent = 'Ничего не найдено';
            _elements.resultsCount.classList.remove('hidden');
        } else {
            _elements.resultsCount.classList.add('hidden');
        }
    }

    /**
     * Создаёт DOM-элемент
     */
    function _createElement(tag, attributes = {}, children = null) {
        return Utils.createElement(tag, attributes, children);
    }

    /**
     * Получает текущие результаты поиска
     * @returns {Array}
     */
    function getResults() {
        return [..._state.results];
    }

    /**
     * Получает состояние поиска
     * @returns {object}
     */
    function getState() {
        return { ..._state };
    }

    /**
     * Программно устанавливает поисковый запрос
     * @param {string} query - запрос
     */
    function setQuery(query) {
        if (!_elements.searchInput) return;
        
        _elements.searchInput.value = query;
        _elements.searchInput.focus();
        _handleInput();
    }

    /**
     * Уничтожает менеджер поиска
     */
    function destroy() {
        // Очищаем таймеры
        Object.values(_timers).forEach(timer => clearTimeout(timer));
        _timers = {};

        // Закрываем предложения
        _closeSuggestions();

        // Очищаем кэш
        _cache.allCountries = [];
        _cache.lastResults = [];
        
        // Удаляем дополнительные элементы
        if (_elements.suggestionsList) {
            _elements.suggestionsList.remove();
        }
        if (_elements.clearButton) {
            _elements.clearButton.remove();
        }
        if (_elements.searchIcon) {
            _elements.searchIcon.remove();
        }

        console.log('[SearchManager] Уничтожен');
    }

    // ==========================================
    // ПУБЛИЧНЫЙ API
    // ==========================================

    return {
        // Инициализация
        init,

        // Управление
        clearSearch,
        reset,
        setQuery,

        // Состояние
        getResults,
        getState,
        isOpen: () => _state.isOpen,

        // История
        clearHistory: _clearSearchHistory,
        getHistory: () => [..._cache.searchHistory],

        // Уничтожение
        destroy
    };

})();


/* ============================================================
   ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
   ============================================================ */

window.SearchManager = SearchManager;


/* ============================================================
   ДИНАМИЧЕСКИЕ СТИЛИ ДЛЯ ПОИСКА
   ============================================================ */

const searchStyles = document.createElement('style');
searchStyles.textContent = `
    /* Контейнер поиска */
    .search-container {
        position: relative;
        flex: 1;
        max-width: 480px;
    }
    
    .search-icon {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 16px;
        pointer-events: none;
        opacity: 0.6;
        transition: opacity 0.2s;
    }
    
    .search-focused .search-icon {
        opacity: 1;
    }
    
    /* Кнопка очистки */
    .search-clear {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-bg-tertiary);
        border: none;
        border-radius: 50%;
        color: var(--color-text-muted);
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
        opacity: 0.7;
    }
    
    .search-clear:hover {
        background: var(--color-danger);
        color: white;
        opacity: 1;
    }
    
    /* Счётчик результатов */
    .search-results-count {
        position: absolute;
        right: 40px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 12px;
        color: var(--color-text-muted);
        white-space: nowrap;
        pointer-events: none;
    }
    
    /* Список предложений */
    .search-suggestions {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: 0;
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        box-shadow: var(--shadow-lg);
        max-height: 400px;
        overflow-y: auto;
        z-index: 500;
    }
    
    /* Элемент предложения */
    .search-suggestion {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        cursor: pointer;
        transition: background 0.15s;
        border-bottom: 1px solid var(--color-border-light);
    }
    
    .search-suggestion:last-child {
        border-bottom: none;
    }
    
    .search-suggestion:hover,
    .search-suggestion-active {
        background: var(--color-accent-light);
    }
    
    .search-suggestion-active {
        border-left: 3px solid var(--color-accent);
    }
    
    .suggestion-flag {
        width: 32px;
        height: 24px;
        border-radius: 3px;
        object-fit: cover;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        flex-shrink: 0;
    }
    
    .suggestion-info {
        flex: 1;
        min-width: 0;
    }
    
    .suggestion-name {
        font-weight: 600;
        font-size: 14px;
        color: var(--color-text-primary);
        margin-bottom: 2px;
    }
    
    .suggestion-details {
        font-size: 12px;
        color: var(--color-text-muted);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    
    .suggestion-select-icon {
        font-size: 16px;
        opacity: 0;
        transition: opacity 0.2s;
        color: var(--color-accent);
    }
    
    .search-suggestion:hover .suggestion-select-icon,
    .search-suggestion-active .suggestion-select-icon {
        opacity: 1;
    }
    
    /* Подсветка совпадений */
    .search-highlight {
        background: var(--color-accent-light);
        color: var(--color-accent);
        font-weight: 600;
        padding: 1px 3px;
        border-radius: 2px;
    }
    
    /* Нет результатов */
    .search-no-results {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 30px 20px;
        color: var(--color-text-muted);
        text-align: center;
        gap: 8px;
    }
    
    .no-results-icon {
        font-size: 32px;
        opacity: 0.5;
    }
    
    .no-results-query {
        font-size: 12px;
        font-style: italic;
    }
    
    /* Больше результатов */
    .search-more-info {
        padding: 10px 16px;
        text-align: center;
        font-size: 12px;
        color: var(--color-text-muted);
        background: var(--color-bg-tertiary);
        border-top: 1px solid var(--color-border-light);
    }
    
    /* История поиска */
    .search-history-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 16px;
        font-size: 12px;
        font-weight: 600;
        color: var(--color-text-muted);
        border-bottom: 1px solid var(--color-border-light);
    }
    
    .clear-history-btn {
        background: none;
        border: none;
        color: var(--color-accent);
        font-size: 12px;
        cursor: pointer;
        padding: 2px 8px;
        border-radius: 4px;
        transition: background 0.2s;
    }
    
    .clear-history-btn:hover {
        background: var(--color-accent-light);
    }
    
    .search-history-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        cursor: pointer;
        transition: background 0.15s;
        font-size: 14px;
    }
    
    .search-history-item:hover {
        background: var(--color-accent-light);
    }
    
    .history-icon {
        font-size: 14px;
        opacity: 0.5;
    }
    
    .history-query {
        flex: 1;
        color: var(--color-text-primary);
    }
    
    .history-time {
        font-size: 11px;
        color: var(--color-text-muted);
    }
    
    /* Анимации */
    @keyframes fadeInDown {
        from {
            opacity: 0;
            transform: translateY(-8px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    /* Адаптивность */
    @media (max-width: 768px) {
        .search-container {
            max-width: none;
        }
        
        .search-suggestions {
            position: fixed;
            top: var(--topbar-height, 56px);
            left: 8px;
            right: 8px;
            max-height: 60vh;
        }
        
        .suggestion-details {
            display: none;
        }
    }
`;

document.head.appendChild(searchStyles);