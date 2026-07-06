/* ============================================================
   panel.js — PanelManager v2.4
   Добавлено модальное окно для просмотра флага
   ============================================================ */

const PanelManager = (() => {
    'use strict';

    // ==========================================
    // ПРИВАТНЫЕ ПЕРЕМЕННЫЕ
    // ==========================================

    let _elements = {
        panel: null,
        placeholder: null,
        infoContainer: null,
        flag: null,
        name: null,
        capital: null,
        leader: null,
        ideology: null,
        population: null,
        alliance: null,
        description: null,
        historyBtn: null,
        historyContainer: null,
        historyList: null,
        backBtn: null,
        historySearch: null,
        historyTagFilter: null,
        headerContainer: null,
        headerInfo: null,
        // Модалка флага
        flagModal: null,
        flagModalImage: null
    };

    let _callbacks = {
        onOpen: null,
        onClose: null
    };

    let _state = {
        isOpen: false,
        currentCountry: null,
        currentCountryId: null,
        showingHistory: false,
        historyEvents: [],
        filteredEvents: [],
        activeTag: null,
        searchQuery: ''
    };

    let _settings = {
        animationDuration: 350,
        visibleFields: ['capital', 'ideology', 'population', 'alliance', 'description']
    };

    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ
    // ==========================================

    function init(options = {}) {
        _elements.panel = options.panel || document.getElementById('country-panel');
        _elements.placeholder = options.placeholder || document.getElementById('country-placeholder');
        _elements.infoContainer = options.infoContainer || document.getElementById('country-info');

        if (options.onOpen) _callbacks.onOpen = options.onOpen;
        if (options.onClose) _callbacks.onClose = options.onClose;
        if (options.settings) _settings = { ..._settings, ...options.settings };

        if (!_elements.panel) {
            console.error('[PanelManager] Панель не найдена');
            return false;
        }

        _cacheElements();
        _restructureInfoContainer();
        _addHistoryButtonToHeader();
        _createHistorySection();
        _createFlagModal();
        _injectStyles();

        console.log('[PanelManager] Инициализация завершена');
        return true;
    }

    function _cacheElements() {
        _elements.flag = document.getElementById('countryFlag');
        _elements.name = document.getElementById('countryName');
        _elements.capital = document.getElementById('countryCapital');
        _elements.leader = document.getElementById('countryLeader');
        _elements.ideology = document.getElementById('countryIdeology');
        _elements.population = document.getElementById('countryPopulation');
        _elements.alliance = document.getElementById('countryAlliance');
        _elements.description = document.getElementById('countryDescription');
    }

    function _restructureInfoContainer() {
        if (!_elements.infoContainer) return;

        _elements.headerContainer = document.createElement('div');
        _elements.headerContainer.className = 'country-header';

        if (_elements.flag) {
            _elements.flag.parentNode?.removeChild(_elements.flag);
            _elements.headerContainer.appendChild(_elements.flag);
        }

        _elements.headerInfo = document.createElement('div');
        _elements.headerInfo.className = 'country-header-info';

        if (_elements.name) {
            _elements.name.parentNode?.removeChild(_elements.name);
            _elements.headerInfo.appendChild(_elements.name);
        }

        if (_elements.leader) {
            _elements.leader.parentNode?.removeChild(_elements.leader);
        }

        _elements.headerContainer.appendChild(_elements.headerInfo);
        _elements.infoContainer.insertBefore(_elements.headerContainer, _elements.infoContainer.firstChild);
    }

    function _addHistoryButtonToHeader() {
        const header = _elements.panel?.querySelector('.panel-header');
        if (!header) return;

        _elements.historyBtn = document.createElement('button');
        _elements.historyBtn.className = 'panel-history-btn-header';
        _elements.historyBtn.textContent = 'История';
        _elements.historyBtn.addEventListener('click', () => _showHistory());
        header.appendChild(_elements.historyBtn);
    }

    function _createFlagModal() {
        // Оверлей
        _elements.flagModal = document.createElement('div');
        _elements.flagModal.className = 'flag-modal-overlay';
        _elements.flagModal.addEventListener('click', () => _closeFlagModal());

        // Изображение
        _elements.flagModalImage = document.createElement('img');
        _elements.flagModalImage.className = 'flag-modal-image';
        _elements.flagModalImage.addEventListener('click', (e) => e.stopPropagation());
        _elements.flagModal.appendChild(_elements.flagModalImage);

        // Кнопка закрытия
        const closeBtn = document.createElement('button');
        closeBtn.className = 'flag-modal-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => _closeFlagModal());
        _elements.flagModal.appendChild(closeBtn);

        document.body.appendChild(_elements.flagModal);
    }

    function _openFlagModal(flagSrc) {
        _elements.flagModalImage.src = flagSrc;
        _elements.flagModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function _closeFlagModal() {
        _elements.flagModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function _createHistorySection() {
        if (!_elements.infoContainer) return;

        _elements.historyContainer = document.createElement('div');
        _elements.historyContainer.className = 'panel-history-container';
        _elements.historyContainer.style.display = 'none';

        _elements.backBtn = document.createElement('button');
        _elements.backBtn.className = 'panel-back-btn';
        _elements.backBtn.textContent = '← Назад';
        _elements.backBtn.addEventListener('click', () => _hideHistory());

        const historyHeader = document.createElement('div');
        historyHeader.className = 'history-header';
        const historyTitle = document.createElement('h3');
        historyTitle.className = 'history-title';
        historyTitle.textContent = 'История событий';
        historyHeader.appendChild(historyTitle);

        _elements.historySearch = document.createElement('input');
        _elements.historySearch.type = 'text';
        _elements.historySearch.className = 'history-search';
        _elements.historySearch.placeholder = 'Поиск по новостям...';
        _elements.historySearch.addEventListener('input', () => {
            _state.searchQuery = _elements.historySearch.value.toLowerCase();
            _applyFilters();
        });

        _elements.historyTagFilter = document.createElement('div');
        _elements.historyTagFilter.className = 'history-tags';

        _elements.historyList = document.createElement('div');
        _elements.historyList.className = 'history-list';

        _elements.historyContainer.appendChild(_elements.backBtn);
        _elements.historyContainer.appendChild(historyHeader);
        _elements.historyContainer.appendChild(_elements.historySearch);
        _elements.historyContainer.appendChild(_elements.historyTagFilter);
        _elements.historyContainer.appendChild(_elements.historyList);

        _elements.infoContainer.appendChild(_elements.historyContainer);
    }

    // ==========================================
    // ОТОБРАЖЕНИЕ СТРАНЫ
    // ==========================================

    function showCountry(country) {
        if (!country) return;

        _state.currentCountry = country;
        _state.currentCountryId = country.id;
        _state.showingHistory = false;
        _state.activeTag = null;
        _state.searchQuery = '';

        _fillData(country);

        if (_elements.placeholder) _elements.placeholder.style.display = 'none';
        if (_elements.infoContainer) {
            _elements.infoContainer.style.display = 'block';
            _elements.infoContainer.style.opacity = '0';
            _showMainInfo();
            requestAnimationFrame(() => {
                _elements.infoContainer.style.transition = 'opacity 200ms ease';
                _elements.infoContainer.style.opacity = '1';
            });
        }

        openPanel();
    }

    function _showMainInfo() {
        const mainElements = [
            _elements.headerContainer, _elements.capital,
            _elements.ideology, _elements.population,
            _elements.alliance, _elements.description
        ];
        
        mainElements.forEach(el => {
            if (el) el.style.display = '';
        });

        if (_elements.historyContainer) _elements.historyContainer.style.display = 'none';
        if (_elements.historyBtn) _elements.historyBtn.style.display = '';
    }

    function _fillData(country) {
        // Флаг с обработчиком клика
        if (_elements.flag) {
            _elements.flag.src = country.flag || 'flags/default.png';
            _elements.flag.alt = 'Флаг ' + (country.name || '');
            _elements.flag.onerror = function() { this.src = 'flags/default.png'; };
            _elements.flag.style.cursor = 'pointer';
            _elements.flag.title = 'Нажмите для просмотра';
            _elements.flag.onclick = function() {
                _openFlagModal(country.flag || 'flags/default.png');
            };
        }

        // Название
        if (_elements.name) {
            _elements.name.textContent = country.name || 'Неизвестная страна';
        }

        // Правитель в headerInfo
        if (_elements.leader && _elements.headerInfo) {
            if (!_elements.headerInfo.contains(_elements.leader)) {
                _elements.headerInfo.appendChild(_elements.leader);
            }
            _elements.leader.textContent = country.leader || 'Нет данных';
        }

        // Поля
        const fields = {
            capital: _elements.capital,
            ideology: _elements.ideology,
            population: _elements.population,
            alliance: _elements.alliance,
            description: _elements.description
        };

        Object.entries(fields).forEach(([field, element]) => {
            if (!element || !_settings.visibleFields.includes(field)) return;
            let value = country[field];
            if (field === 'population' && value) value = Utils.formatNumber(Number(value));
            if (field === 'alliance') value = value && value !== 'Нет' && value !== 'Отсутствует' ? value : 'Не состоит в альянсах';
            element.textContent = value || 'Нет данных';
        });
    }

    // ==========================================
    // ИСТОРИЯ
    // ==========================================

    function _showHistory() {
        _state.showingHistory = true;

        const mainElements = [
            _elements.headerContainer, _elements.capital,
            _elements.ideology, _elements.population,
            _elements.alliance, _elements.description
        ];
        
        mainElements.forEach(el => { if (el) el.style.display = 'none'; });
        if (_elements.historyBtn) _elements.historyBtn.style.display = 'none';
        if (_elements.historyContainer) _elements.historyContainer.style.display = 'block';
        if (_elements.historySearch) _elements.historySearch.value = '';
        _state.searchQuery = '';
        _state.activeTag = null;

        _loadAndDisplayHistory();
    }

    function _hideHistory() {
        _state.showingHistory = false;
        _showMainInfo();
    }

    function _loadAndDisplayHistory() {
        if (!_elements.historyList) return;
        
        _elements.historyList.innerHTML = '<div class="history-loading"><div class="history-spinner"></div><p>Загрузка...</p></div>';

        setTimeout(() => {
            let historyEvents = [];
            const tags = new Set();

            if (window.DataManager) {
                const worldHistory = DataManager.getWorldHistory();
                const connectedIds = DataManager.getConnectedCountryIds(_state.currentCountryId);
                const lowerIds = connectedIds.map(id => id.toLowerCase());

                historyEvents = worldHistory
                    .filter(event => {
                        if (!event.countryId) return false;
                        return lowerIds.includes(event.countryId.toLowerCase());
                    })
                    .sort((a, b) => {
                        const dateA = _parseDate(a.date);
                        const dateB = _parseDate(b.date);
                        return dateB - dateA;
                    });

                historyEvents.forEach(e => { if (e.type) tags.add(e.type); });
            }

            _state.historyEvents = historyEvents;
            _state.filteredEvents = [...historyEvents];
            _renderTagFilters([...tags]);
            _displayFilteredEvents();
        }, 300);
    }

    function _parseDate(dateStr) {
        if (!dateStr) return new Date(0);
        const parts = dateStr.split('.');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
        return new Date(dateStr);
    }

    function _renderTagFilters(tags) {
        if (!_elements.historyTagFilter) return;

        const tagLabels = {
            political: 'Политика', economic: 'Экономика', military: 'Военное',
            technological: 'Технологии', diplomatic: 'Дипломатия', other: 'Прочее'
        };

        let html = '<button class="history-tag' + (!_state.activeTag ? ' active' : '') + '" data-tag="">Все (' + _state.historyEvents.length + ')</button>';

        tags.forEach(tag => {
            const count = _state.historyEvents.filter(e => e.type === tag).length;
            html += '<button class="history-tag' + (_state.activeTag === tag ? ' active' : '') + '" data-tag="' + tag + '">' + (tagLabels[tag] || tag) + ' (' + count + ')</button>';
        });

        _elements.historyTagFilter.innerHTML = html;

        _elements.historyTagFilter.querySelectorAll('.history-tag').forEach(btn => {
            btn.addEventListener('click', () => {
                _state.activeTag = btn.dataset.tag || null;
                _applyFilters();
                _renderTagFilters(tags);
            });
        });
    }

    function _applyFilters() {
        let events = [..._state.historyEvents];
        if (_state.activeTag) events = events.filter(e => e.type === _state.activeTag);
        if (_state.searchQuery) {
            events = events.filter(e => {
                const title = (e.title || '').toLowerCase();
                const desc = (e.description || '').toLowerCase();
                return title.includes(_state.searchQuery) || desc.includes(_state.searchQuery);
            });
        }
        _state.filteredEvents = events;
        _displayFilteredEvents();
    }

    function _displayFilteredEvents() {
        if (!_elements.historyList) return;

        const events = _state.filteredEvents;
        if (events.length === 0) {
            _elements.historyList.innerHTML = '<div class="history-empty"><p>Ничего не найдено</p><span>по вашему запросу</span></div>';
            return;
        }

        const tagLabels = {
            political: 'Политика', economic: 'Экономика', military: 'Военное',
            technological: 'Технологии', diplomatic: 'Дипломатия', other: 'Прочее'
        };

        let html = '';
        events.forEach(event => {
            const typeLabel = tagLabels[event.type] || 'Прочее';
            html += '<div class="history-event">';
            html += '<div class="history-event-header">';
            html += '<span class="history-event-type type-' + (event.type || 'other') + '">' + typeLabel + '</span>';
            html += '<span class="history-event-date">' + (event.date || 'Нет даты') + '</span>';
            html += '</div>';
            html += '<h4 class="history-event-title">' + (event.title || 'Без названия') + '</h4>';
            html += '<p class="history-event-desc">' + (event.description || 'Нет описания') + '</p>';
            if (event.importance === 'major') html += '<span class="history-badge-major">Важное</span>';
            html += '</div>';
        });

        _elements.historyList.innerHTML = html;
    }

    function hideCountry() {
        _state.currentCountry = null;
        _state.currentCountryId = null;
        _state.showingHistory = false;
        _state.activeTag = null;
        _state.searchQuery = '';
        if (_elements.placeholder) _elements.placeholder.style.display = '';
        if (_elements.infoContainer) _elements.infoContainer.style.display = 'none';
        if (_elements.historyContainer) _elements.historyContainer.style.display = 'none';
        if (_elements.historySearch) _elements.historySearch.value = '';
        _showMainInfo();
        closePanel();
    }

    // ==========================================
    // УПРАВЛЕНИЕ ПАНЕЛЬЮ
    // ==========================================

    function openPanel() {
        if (_state.isOpen || !_elements.panel) return;
        _state.isOpen = true;
        _elements.panel.style.transform = 'translateX(0)';
        _elements.panel.setAttribute('aria-hidden', 'false');
        document.body.classList.add('panel-opened');
        if (_callbacks.onOpen) _callbacks.onOpen(_state.currentCountry);
    }

    function closePanel() {
        if (!_state.isOpen || !_elements.panel) return;
        _state.isOpen = false;
        _elements.panel.style.transform = 'translateX(100%)';
        _elements.panel.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('panel-opened');
        if (_callbacks.onClose) _callbacks.onClose();
    }

    function togglePanel() {
        _state.isOpen ? closePanel() : openPanel();
    }

    // ==========================================
    // СТИЛИ
    // ==========================================

    function _injectStyles() {
    if (document.getElementById('panel-manager-styles')) {
        document.getElementById('panel-manager-styles').remove();
    }

    const styles = document.createElement('style');
    styles.id = 'panel-manager-styles';
    styles.textContent = `
        #country-panel{position:relative;width:var(--panel-width,380px);height:100%;background:var(--color-bg-secondary);border-left:1px solid var(--color-border);overflow-y:auto;overflow-x:hidden;flex-shrink:0;z-index:10;will-change:transform}
        #country-panel .panel-header{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:var(--color-bg-glass,rgba(255,255,255,0.8));border-bottom:1px solid var(--color-border-light);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);gap:12px}
        #country-panel .panel-header h2{font-size:16px;font-weight:700;color:var(--color-text-primary);margin:0;flex-shrink:0}
        .panel-history-btn-header{padding:6px 14px;background:var(--color-bg-tertiary);border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-secondary);font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;white-space:nowrap;flex-shrink:0;margin-left:auto}
        .panel-history-btn-header:hover{background:var(--color-accent-light);color:var(--color-accent);border-color:var(--color-accent)}
        #country-panel .panel-body{padding:18px 22px}
        
        /* Плейсхолдер */
        #country-placeholder{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px 20px;color:var(--color-text-muted)}
        #country-placeholder .placeholder-icon{font-size:56px;margin-bottom:20px;opacity:0.5;animation:float 3s ease-in-out infinite}
        #country-placeholder h3{font-size:18px;font-weight:700;color:var(--color-text-primary);margin-bottom:8px}
        #country-placeholder p{font-size:14px;line-height:1.6}
        @keyframes float{0%,100%{transform:translateY(0px)}50%{transform:translateY(-8px)}}
        
        #country-info{animation:fadeSlideIn 0.3s ease}
        @keyframes fadeSlideIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        
        /* Шапка: флаг + название/правитель */
        .country-header{display:flex;align-items:center;gap:14px;margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--color-border-light)}
        #countryFlag{width:72px;height:48px;object-fit:cover;border-radius:6px;box-shadow:0 2px 6px rgba(0,0,0,0.1);border:1px solid var(--color-border);flex-shrink:0;margin:0;cursor:pointer;transition:transform 0.15s ease,box-shadow 0.15s ease}
        #countryFlag:hover{transform:scale(1.06);box-shadow:0 3px 10px rgba(0,0,0,0.18)}
        #countryFlag:active{transform:scale(0.96)}
        .country-header-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
        #countryName{font-size:20px;font-weight:800;color:var(--color-text-primary);line-height:1.2;letter-spacing:-0.3px;margin:0}
        #countryLeader{font-size:14px;font-weight:500;color:var(--color-text-secondary);line-height:1.3;margin:0}
        
        /* Поля информации */
        .info-fields{display:flex;flex-direction:column;gap:0;margin-top:2px}
        .info-fields p{display:flex;align-items:baseline;padding:11px 0;margin:0;border-bottom:1px solid var(--color-border-light);gap:10px}
        .info-fields p:last-child{border-bottom:none;padding-bottom:0}
        .info-fields p strong{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--color-text-muted);min-width:100px;flex-shrink:0;line-height:1.4}
        .info-fields p span{font-size:15px;font-weight:500;color:var(--color-text-primary);line-height:1.4;flex:1}
        
        /* Описание */
        .description-section{margin-top:18px;padding-top:16px;border-top:1px solid var(--color-border-light)}
        .description-section h3{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--color-text-muted);margin:0 0 8px}
        #countryDescription{font-size:14px;line-height:1.7;color:var(--color-text-secondary);margin:0}
        
        /* Модалка флага */
        .flag-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;opacity:0;visibility:hidden;transition:opacity 0.25s ease,visibility 0.25s ease;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
        .flag-modal-overlay.active{opacity:1;visibility:visible}
        .flag-modal-image{max-width:85vw;max-height:80vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.4);transform:scale(0.9);transition:transform 0.25s ease}
        .flag-modal-overlay.active .flag-modal-image{transform:scale(1)}
        .flag-modal-close{position:absolute;top:20px;right:20px;width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.15);border:1px solid rgba(255,255,255,0.3);border-radius:50%;color:white;font-size:24px;cursor:pointer;transition:all 0.2s;line-height:1}
        .flag-modal-close:hover{background:rgba(239,68,68,0.8);border-color:rgba(239,68,68,0.8);transform:rotate(90deg)}
        
        /* История */
        .panel-history-container{padding-top:4px}
        .panel-back-btn{display:inline-flex;align-items:center;padding:7px 14px;background:transparent;border:1px solid var(--color-border);border-radius:6px;color:var(--color-text-secondary);font-size:13px;font-weight:500;cursor:pointer;transition:all 0.2s;margin-bottom:14px}
        .panel-back-btn:hover{background:var(--color-accent-light);color:var(--color-accent);border-color:var(--color-accent)}
        .history-header{margin-bottom:12px}
        .history-title{font-size:18px;font-weight:700;color:var(--color-text-primary);margin:0 0 4px}
        .history-search{width:100%;padding:9px 14px;background:var(--color-bg-tertiary);border:1px solid var(--color-border);border-radius:8px;font-size:13px;color:var(--color-text-primary);outline:none;transition:all 0.2s;margin-bottom:12px;box-sizing:border-box}
        .history-search:focus{border-color:var(--color-accent);box-shadow:0 0 0 3px var(--color-accent-light)}
        .history-search::placeholder{color:var(--color-text-muted)}
        .history-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
        .history-tag{padding:5px 12px;background:var(--color-bg-tertiary);border:1px solid var(--color-border);border-radius:20px;font-size:12px;font-weight:500;color:var(--color-text-secondary);cursor:pointer;transition:all 0.15s;white-space:nowrap}
        .history-tag:hover{background:var(--color-accent-light);color:var(--color-accent)}
        .history-tag.active{background:var(--color-accent);color:white;border-color:var(--color-accent)}
        .history-list{display:flex;flex-direction:column;gap:12px}
        .history-event{background:var(--color-bg-tertiary);border-radius:8px;padding:14px 16px;border-left:2px solid var(--color-border);transition:all 0.15s}
        .history-event:hover{border-left-color:var(--color-accent);background:var(--color-accent-subtle)}
        .history-event-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px}
        .history-event-type{display:inline-block;padding:3px 10px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px}
        .type-political{background:rgba(59,130,246,0.15);color:#3b82f6}
        .type-economic{background:rgba(16,185,129,0.15);color:#10b981}
        .type-military{background:rgba(239,68,68,0.15);color:#ef4444}
        .type-technological{background:rgba(139,92,246,0.15);color:#8b5cf6}
        .type-diplomatic{background:rgba(245,158,11,0.15);color:#d97706}
        .type-other{background:rgba(107,114,128,0.15);color:#6b7280}
        .history-event-date{font-size:12px;color:var(--color-text-muted)}
        .history-event-title{font-size:15px;font-weight:600;color:var(--color-text-primary);margin:0 0 6px;line-height:1.3}
        .history-event-desc{font-size:13px;color:var(--color-text-secondary);line-height:1.6;margin:0 0 6px}
        .history-badge-major{display:inline-block;padding:2px 8px;background:rgba(245,158,11,0.15);color:#d97706;border-radius:3px;font-size:10px;font-weight:600}
        .history-loading{display:flex;flex-direction:column;align-items:center;padding:40px 20px;gap:10px;color:var(--color-text-muted)}
        .history-spinner{width:28px;height:28px;border:2px solid var(--color-border);border-top-color:var(--color-accent);border-radius:50%;animation:spin 0.8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .history-empty{display:flex;flex-direction:column;align-items:center;padding:40px 20px;color:var(--color-text-muted);text-align:center;gap:4px;font-size:14px}
        .history-empty span{font-size:12px;opacity:0.6}
        
        @media(max-width:768px){
            #country-panel{position:fixed;top:var(--topbar-height,56px);right:0;bottom:var(--statusbar-height,36px);width:100%;max-width:400px;box-shadow:-8px 0 24px rgba(0,0,0,0.15);transform:translateX(100%)}
            .flag-modal-image{max-width:95vw;max-height:70vh}
            #country-panel .panel-body{padding:14px 16px}
            #countryFlag{width:64px;height:42px}
            #countryName{font-size:18px}
        }
    `;

    document.head.appendChild(styles);
}

    // ==========================================
    // API
    // ==========================================

    return {
        init: init,
        showCountry: showCountry,
        hideCountry: hideCountry,
        openPanel: openPanel,
        closePanel: closePanel,
        togglePanel: togglePanel,
        isOpen: function() { return _state.isOpen; },
        getCurrentCountry: function() { return _state.currentCountry; },
        destroy: function() {
            closePanel();
            _closeFlagModal();
            _state.currentCountry = null;
        }
    };

})();

window.PanelManager = PanelManager;