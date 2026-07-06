/* ============================================================
   data.js — DataManager: Загрузка и управление данными мира
   Версия 2.1 — Добавлена поддержка группировки стран (анклавы)
   ============================================================ */

const DataManager = (() => {
    'use strict';

    // ==========================================
    // ПРИВАТНЫЕ ПЕРЕМЕННЫЕ
    // ==========================================

    /** Базовый путь к директории с данными */
    const DATA_PATH = 'data/';

    /** Загруженные данные (кэш) */
    let _countries = null;
    let _alliances = null;
    let _history = null;
    let _relations = null;

    /** Индексы для быстрого поиска */
    let _countriesById = {};
    let _countriesByAlliance = {};
    let _alliancesById = {};
    let _relationsByCountry = {};
    
    /** Индексы для группировки стран */
    let _countryGroups = {};
    let _countryToGroup = {};

    /** Флаги состояния */
    let _isLoaded = false;
    let _isLoading = false;

    /** Массив колбэков для события загрузки */
    let _onLoadCallbacks = [];

    /** Кэш для хранения Promise'ов загрузки */
    let _loadPromise = null;

    // ==========================================
    // ПРИВАТНЫЕ МЕТОДЫ
    // ==========================================

    /**
     * Загружает JSON файл по URL
     * @param {string} url - путь к файлу
     * @returns {Promise<object>} распарсенные данные
     */
    async function _fetchJSON(url) {
        try {
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            console.error(`[DataManager] Ошибка загрузки ${url}:`, error);
            throw error;
        }
    }

    /**
     * Строит индексы для быстрого доступа к данным
     */
    function _buildIndexes() {
        // Очищаем индексы
        _countriesById = {};
        _countriesByAlliance = {};
        _alliancesById = {};
        _relationsByCountry = {};
        _countryGroups = {};
        _countryToGroup = {};

        // Индекс стран по ID
        if (_countries) {
            _countries.forEach(country => {
                if (country.id) {
                    _countriesById[country.id] = country;
                    _countriesById[country.id.toLowerCase()] = country;
                }

                // Группировка по альянсам
                if (country.alliance && country.alliance !== 'Нет' && country.alliance !== 'Отсутствует') {
                    const allianceKey = country.alliance.toLowerCase();
                    if (!_countriesByAlliance[allianceKey]) {
                        _countriesByAlliance[allianceKey] = [];
                    }
                    _countriesByAlliance[allianceKey].push(country);
                }

                // Группировка стран (анклавы, части государств)
                if (country.groupId) {
                    if (!_countryGroups[country.groupId]) {
                        _countryGroups[country.groupId] = [];
                    }
                    _countryGroups[country.groupId].push(country.id);
                    _countryToGroup[country.id] = country.groupId;
                }
            });
        }

        // Индекс альянсов по ID
        if (_alliances) {
            _alliances.forEach(alliance => {
                if (alliance.id) {
                    _alliancesById[alliance.id] = alliance;
                    _alliancesById[alliance.id.toLowerCase()] = alliance;
                }
            });
        }

        // Индекс отношений по стране
        if (_relations) {
            _relations.forEach(rel => {
                if (rel.countryId) {
                    _relationsByCountry[rel.countryId] = rel.relations || [];
                    _relationsByCountry[rel.countryId.toLowerCase()] = rel.relations || [];
                }
            });
        }

        console.log(
            `[DataManager] Индексы построены: ` +
            `${Object.keys(_countriesById).length} стран, ` +
            `${Object.keys(_alliancesById).length} альянсов, ` +
            `${Object.keys(_relationsByCountry).length} наборов отношений, ` +
            `${Object.keys(_countryGroups).length} групп стран`
        );
    }

    /**
     * Валидирует структуру загруженных данных
     * @param {Array} countries - массив стран
     * @returns {Array} массив ошибок или пустой
     */
    function _validateCountries(countries) {
        const errors = [];

        if (!Array.isArray(countries)) {
            errors.push('Данные стран должны быть массивом');
            return errors;
        }

        const requiredFields = ['id', 'name', 'capital'];
        const seenIds = new Set();

        countries.forEach((country, index) => {
            requiredFields.forEach(field => {
                if (!country[field]) {
                    errors.push(`Страна #${index}: отсутствует поле "${field}"`);
                }
            });

            if (country.id) {
                if (seenIds.has(country.id)) {
                    errors.push(`Страна "${country.name}": дублирующийся ID "${country.id}"`);
                }
                seenIds.add(country.id);
            }
        });

        return errors;
    }

    /**
     * Нормализует данные стран
     * @param {Array} countries - массив стран
     * @returns {Array} нормализованный массив
     */
    function _normalizeCountries(countries) {
        return countries.map(country => ({
            id: country.id || `country_${Math.random().toString(36).substr(2, 9)}`,
            name: country.name || 'Неизвестная страна',
            capital: country.capital || 'Нет данных',
            leader: country.leader || 'Нет данных',
            ideology: country.ideology || 'Нет данных',
            population: Number(country.population) || 0,
            army: Number(country.army) || 0,
            economy: country.economy || 'Нет данных',
            alliance: country.alliance || 'Нет',
            description: country.description || 'Описание отсутствует',
            flag: country.flag || 'flags/default.png',
            color: country.color || null,
            founded: country.founded || null,
            groupId: country.groupId || null,
            isMainPart: country.isMainPart !== undefined ? country.isMainPart : true,
            history: country.history || [],
            neighbors: country.neighbors || []
        }));
    }

    /**
     * Загружает все данные параллельно
     * @returns {Promise<object>} объект со всеми данными
     */
    async function _loadAllData() {
        const startTime = performance.now();

        try {
            const [countries, alliances, history, relations] = await Promise.all([
                _fetchJSON(`${DATA_PATH}countries.json`).catch(err => {
                    console.warn('[DataManager] Не удалось загрузить страны:', err.message);
                    return [];
                }),
                _fetchJSON(`${DATA_PATH}alliances.json`).catch(err => {
                    console.warn('[DataManager] Не удалось загрузить альянсы:', err.message);
                    return [];
                }),
                _fetchJSON(`${DATA_PATH}history.json`).catch(err => {
                    console.warn('[DataManager] Не удалось загрузить историю:', err.message);
                    return [];
                }),
                _fetchJSON(`${DATA_PATH}relations.json`).catch(err => {
                    console.warn('[DataManager] Не удалось загрузить отношения:', err.message);
                    return [];
                })
            ]);

            const errors = _validateCountries(countries);
            if (errors.length > 0) {
                console.warn('[DataManager] Найдены ошибки в данных стран:');
                errors.forEach(err => console.warn('  -', err));
            }

            _countries = _normalizeCountries(countries);
            _alliances = Array.isArray(alliances) ? alliances : [];
            _history = Array.isArray(history) ? history : [];
            _relations = Array.isArray(relations) ? relations : [];

            _buildIndexes();

            const loadTime = (performance.now() - startTime).toFixed(1);
            console.log(`[DataManager] Все данные загружены за ${loadTime}мс`);
            console.log(`  Стран: ${_countries.length}`);
            console.log(`  Альянсов: ${_alliances.length}`);
            console.log(`  Исторических событий: ${_history.length}`);
            console.log(`  Наборов отношений: ${_relations.length}`);
            console.log(`  Групп стран: ${Object.keys(_countryGroups).length}`);

            return { 
                countries: _countries, 
                alliances: _alliances, 
                history: _history,
                relations: _relations
            };

        } catch (error) {
            console.error('[DataManager] Критическая ошибка загрузки:', error);
            
            _countries = [];
            _alliances = [];
            _history = [];
            _relations = [];
            _buildIndexes();
            
            throw error;
        }
    }

    // ==========================================
    // МЕТОДЫ ДЛЯ ГРУППИРОВКИ СТРАН
    // ==========================================

    /**
     * Получает все части страны по groupId
     * @param {string} groupId - ID группы
     * @returns {Array} массив ID всех частей
     */
    function getCountryPartsByGroup(groupId) {
        if (!groupId) return [];
        return _countryGroups[groupId] ? [..._countryGroups[groupId]] : [];
    }

    /**
     * Получает основную часть группы
     * @param {string} groupId - ID группы
     * @returns {object|null} основная страна или null
     */
    function getMainCountryPart(groupId) {
        const parts = getCountryPartsByGroup(groupId);
        if (parts.length === 0) return null;

        // Ищем isMainPart = true
        for (const id of parts) {
            const country = getCountryById(id);
            if (country && country.isMainPart) return country;
        }

        // Если нет явной основной части, возвращаем первую
        return getCountryById(parts[0]);
    }

    /**
     * Проверяет, является ли страна частью группы
     * @param {string} countryId - ID страны
     * @returns {boolean}
     */
    function isCountryInGroup(countryId) {
        return !!_countryToGroup[countryId];
    }

    /**
     * Получает groupId для страны
     * @param {string} countryId - ID страны
     * @returns {string|null}
     */
    function getCountryGroupId(countryId) {
        return _countryToGroup[countryId] || null;
    }

    /**
     * Получает все связанные ID для страны (включая части группы)
     * @param {string} countryId - ID страны
     * @returns {string[]} массив всех связанных ID
     */
    function getConnectedCountryIds(countryId) {
        const country = getCountryById(countryId);
        if (!country) return [countryId];

        // Если страна в группе
        if (country.groupId) {
            return getCountryPartsByGroup(country.groupId);
        }

        // Проверяем, не является ли ID частью группы
        const groupId = _countryToGroup[countryId];
        if (groupId) {
            return getCountryPartsByGroup(groupId);
        }

        return [countryId];
    }

    /**
     * Получает название группы (обычно название основной страны)
     * @param {string} countryId - ID страны
     * @returns {string}
     */
    function getGroupDisplayName(countryId) {
        const groupId = _countryToGroup[countryId];
        if (!groupId) {
            const country = getCountryById(countryId);
            return country ? country.name : '';
        }

        const mainPart = getMainCountryPart(groupId);
        return mainPart ? mainPart.name : groupId;
    }

    /**
     * Получает все группы стран
     * @returns {object} объект с группами
     */
    function getAllCountryGroups() {
        return { ..._countryGroups };
    }

    // ==========================================
    // ПУБЛИЧНЫЕ МЕТОДЫ (API)
    // ==========================================

    /**
     * Загружает все данные мира
     * @returns {Promise<object>} Promise с объектом данных
     */
    async function loadData() {
        if (_isLoaded && _countries) {
            console.log('[DataManager] Данные уже загружены, возвращаю из кэша');
            return { 
                countries: _countries, 
                alliances: _alliances, 
                history: _history,
                relations: _relations
            };
        }

        if (_isLoading && _loadPromise) {
            console.log('[DataManager] Загрузка уже выполняется, ожидаю...');
            return _loadPromise;
        }

        _isLoading = true;
        _loadPromise = _loadAllData();

        try {
            const data = await _loadPromise;
            _isLoaded = true;
            _isLoading = false;

            _onLoadCallbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console.error('[DataManager] Ошибка в колбэке загрузки:', err);
                }
            });

            return data;

        } catch (error) {
            _isLoading = false;
            _loadPromise = null;
            throw error;
        }
    }

    /**
     * Регистрирует колбэк, который выполнится после загрузки данных
     * @param {Function} callback - функция(data)
     */
    function onDataLoaded(callback) {
        if (typeof callback !== 'function') {
            console.error('[DataManager] onDataLoaded: аргумент должен быть функцией');
            return;
        }

        if (_isLoaded && _countries) {
            callback({ 
                countries: _countries, 
                alliances: _alliances, 
                history: _history,
                relations: _relations
            });
        } else {
            _onLoadCallbacks.push(callback);
        }
    }

    /**
     * Получить все страны
     * @returns {Array} массив стран
     */
    function getAllCountries() {
        return _countries ? [..._countries] : [];
    }

    /**
     * Получить страну по ID
     * @param {string} id - идентификатор страны
     * @returns {object|null} объект страны или null
     */
    function getCountryById(id) {
        if (!id) return null;
        
        if (_countriesById[id]) return _countriesById[id];
        if (_countriesById[id.toLowerCase()]) return _countriesById[id.toLowerCase()];
        
        return null;
    }

    /**
     * Поиск стран по названию
     * @param {string} query - поисковый запрос
     * @param {object} options - опции поиска
     * @returns {Array} массив найденных стран
     */
    function searchCountries(query, options = {}) {
        if (!query || !_countries) return [];

        const {
            caseSensitive = false,
            limit = 20
        } = options;

        const searchQuery = caseSensitive ? query : query.toLowerCase();

        const results = _countries.filter(country => {
            const name = caseSensitive ? country.name : country.name.toLowerCase();
            const capital = caseSensitive ? country.capital : country.capital.toLowerCase();
            
            return name.includes(searchQuery) || capital.includes(searchQuery);
        });

        return results.slice(0, limit);
    }

    /**
     * Получить страны по альянсу
     * @param {string} allianceName - название альянса
     * @returns {Array} массив стран альянса
     */
    function getCountriesByAlliance(allianceName) {
        if (!allianceName) return [];
        const key = allianceName.toLowerCase();
        return _countriesByAlliance[key] ? [..._countriesByAlliance[key]] : [];
    }

    /**
     * Получить все альянсы
     * @returns {Array} массив альянсов
     */
    function getAllAlliances() {
        return _alliances ? [..._alliances] : [];
    }

    /**
     * Получить альянс по ID
     * @param {string} id - идентификатор альянса
     * @returns {object|null} объект альянса или null
     */
    function getAllianceById(id) {
        if (!id) return null;
        return _alliancesById[id] || _alliancesById[id.toLowerCase()] || null;
    }

    /**
     * Получить альянс, в котором состоит страна
     * @param {string} countryId - ID страны
     * @returns {object|null} объект альянса или null
     */
    function getAllianceByCountry(countryId) {
        const country = getCountryById(countryId);
        if (!country || !country.alliance || country.alliance === 'Нет' || country.alliance === 'Отсутствует') return null;

        const allianceName = country.alliance.toLowerCase();
        for (const alliance of (_alliances || [])) {
            if (alliance.name && alliance.name.toLowerCase() === allianceName) {
                return alliance;
            }
        }

        return null;
    }

    /**
     * Получить историю мира (все события)
     * @returns {Array} массив исторических событий
     */
    function getWorldHistory() {
        return _history ? [..._history] : [];
    }

    /**
     * Получить историю конкретной страны (включая все части группы)
     * @param {string} countryId - ID страны
     * @returns {Array} массив событий страны
     */
    function getCountryHistory(countryId) {
        if (!_history || !Array.isArray(_history)) return [];

        // Получаем все связанные ID (включая анклавы)
        const connectedIds = getConnectedCountryIds(countryId);
        const lowerConnectedIds = connectedIds.map(id => id.toLowerCase());

        return _history.filter(event => {
            if (!event.countryId) return false;
            const eventCountryId = event.countryId.toLowerCase();
            return lowerConnectedIds.includes(eventCountryId);
        });
    }

    /**
     * Получить соседей страны
     * @param {string} countryId - ID страны
     * @returns {Array} массив объектов соседних стран
     */
    function getNeighbors(countryId) {
        const country = getCountryById(countryId);
        if (!country || !country.neighbors) return [];

        return country.neighbors
            .map(neighborId => getCountryById(neighborId))
            .filter(Boolean);
    }

    /**
     * Получить отношения для страны
     * @param {string} countryId - ID страны
     * @returns {Array} массив отношений
     */
    function getRelationsForCountry(countryId) {
        if (!countryId) {
            console.warn('[DataManager] getRelationsForCountry: countryId не указан');
            return [];
        }

        if (!_relations || _relations.length === 0) {
            return [];
        }

        if (_relationsByCountry[countryId]) {
            return [..._relationsByCountry[countryId]];
        }

        if (_relationsByCountry[countryId.toLowerCase()]) {
            return [..._relationsByCountry[countryId.toLowerCase()]];
        }

        for (const key of Object.keys(_relationsByCountry)) {
            if (key.toLowerCase().includes(countryId.toLowerCase()) ||
                countryId.toLowerCase().includes(key.toLowerCase())) {
                return [..._relationsByCountry[key]];
            }
        }

        return [];
    }

    /**
     * Получить все отношения
     * @returns {Array} массив всех отношений
     */
    function getAllRelations() {
        return _relations ? [..._relations] : [];
    }

    /**
     * Получить статистику мира
     * @returns {object} объект со статистикой
     */
    function getWorldStats() {
        if (!_countries) return null;

        const totalPopulation = _countries.reduce((sum, c) => sum + (Number(c.population) || 0), 0);
        const totalArmy = _countries.reduce((sum, c) => sum + (Number(c.army) || 0), 0);
        const uniqueIdeologies = [...new Set(_countries.map(c => c.ideology).filter(Boolean))];
        const uniqueAlliances = [...new Set(_countries.map(c => c.alliance).filter(a => a !== 'Нет' && a !== 'Отсутствует'))];

        return {
            totalCountries: _countries.length,
            totalPopulation,
            totalArmy,
            uniqueIdeologies: uniqueIdeologies.length,
            uniqueAlliances: uniqueAlliances.length,
            ideologyList: uniqueIdeologies,
            allianceList: uniqueAlliances,
            averagePopulation: _countries.length > 0 
                ? Math.round(totalPopulation / _countries.length) 
                : 0,
            averageArmy: _countries.length > 0 
                ? Math.round(totalArmy / _countries.length) 
                : 0,
            relationsLoaded: _relations ? _relations.length : 0,
            countryGroups: Object.keys(_countryGroups).length
        };
    }

    /**
     * Сбросить все загруженные данные
     */
    function resetData() {
        _countries = null;
        _alliances = null;
        _history = null;
        _relations = null;
        _countriesById = {};
        _countriesByAlliance = {};
        _alliancesById = {};
        _relationsByCountry = {};
        _countryGroups = {};
        _countryToGroup = {};
        _isLoaded = false;
        _isLoading = false;
        _loadPromise = null;
        _onLoadCallbacks = [];
        
        console.log('[DataManager] Данные сброшены');
    }

    /**
     * Проверить, загружены ли данные
     * @returns {boolean}
     */
    function isDataLoaded() {
        return _isLoaded && _countries !== null;
    }

    /**
     * Получить состояние загрузки
     * @returns {object}
     */
    function getLoadState() {
        return {
            isLoaded: _isLoaded,
            isLoading: _isLoading,
            countriesCount: _countries ? _countries.length : 0,
            alliancesCount: _alliances ? _alliances.length : 0,
            historyCount: _history ? _history.length : 0,
            relationsCount: _relations ? _relations.length : 0,
            groupsCount: Object.keys(_countryGroups).length
        };
    }

    /**
     * Экспортировать все данные
     * @returns {object} объект со всеми данными
     */
    function exportAllData() {
        return {
            countries: _countries ? [..._countries] : [],
            alliances: _alliances ? [..._alliances] : [],
            history: _history ? [..._history] : [],
            relations: _relations ? [..._relations] : [],
            exportDate: new Date().toISOString(),
            version: '2.1'
        };
    }

    /**
     * Импортировать данные
     * @param {object} data - объект с данными
     * @returns {boolean}
     */
    function importData(data) {
        if (!data || !data.countries) {
            console.error('[DataManager] Некорректные данные для импорта');
            return false;
        }

        const errors = _validateCountries(data.countries);
        if (errors.length > 0) {
            console.error('[DataManager] Ошибки валидации при импорте:', errors);
            return false;
        }

        _countries = _normalizeCountries(data.countries);
        _alliances = data.alliances || [];
        _history = data.history || [];
        _relations = data.relations || [];
        _isLoaded = true;
        _buildIndexes();

        console.log('[DataManager] Данные успешно импортированы');
        return true;
    }

    // ==========================================
    // ПУБЛИЧНЫЙ API
    // ==========================================

    return {
        // Загрузка
        loadData,
        onDataLoaded,
        isDataLoaded,
        getLoadState,

        // Страны
        getAllCountries,
        getCountryById,
        searchCountries,
        getCountriesByAlliance,

        // Альянсы
        getAllAlliances,
        getAllianceById,
        getAllianceByCountry,

        // История
        getWorldHistory,
        getCountryHistory,

        // Отношения
        getRelationsForCountry,
        getAllRelations,

        // Группировка стран (анклавы)
        getCountryPartsByGroup,
        getMainCountryPart,
        isCountryInGroup,
        getCountryGroupId,
        getConnectedCountryIds,
        getGroupDisplayName,
        getAllCountryGroups,

        // Связи
        getNeighbors,

        // Статистика
        getWorldStats,

        // Управление
        resetData,
        exportAllData,
        importData
    };

})();


/* ============================================================
   ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
   ============================================================ */

window.DataManager = DataManager;