/* ============================================================
   zoom.js — ZoomManager: Масштабирование и перемещение карты
   Zoom, pan, центрирование, жесты, анимации
   ============================================================ */

const ZoomManager = (() => {
    'use strict';

    // ==========================================
    // ПРИВАТНЫЕ ПЕРЕМЕННЫЕ
    // ==========================================

    /** DOM-элементы */
    let _elements = {
        container: null,
        zoomContainer: null,
        zoomInBtn: null,
        zoomOutBtn: null,
        resetBtn: null
    };

    /** SVG элемент */
    let _svgElement = null;

    /** Колбэки */
    let _callbacks = {
        onZoomChange: null,
        onPanStart: null,
        onPanMove: null,
        onPanEnd: null
    };

    /** Состояние */
    let _state = {
        // Масштабирование
        zoom: 1,
        minZoom: 0.3,
        maxZoom: 5,
        zoomStep: 0.1,
        zoomEasing: 0.1,
        
        // Панорамирование
        panX: 0,
        panY: 0,
        isPanning: false,
        panStartX: 0,
        panStartY: 0,
        lastPanX: 0,
        lastPanY: 0,
        
        // Анимация
        isAnimating: false,
        animationId: null,
        
        // Границы
        bounds: {
            minX: -2000,
            maxX: 2000,
            minY: -1500,
            maxY: 1500
        },
        
        // Жесты
        touchStartDistance: 0,
        touchStartZoom: 1,
        touchStartPanX: 0,
        touchStartPanY: 0,
        lastTouchX: 0,
        lastTouchY: 0,
        
        // Состояние
        isInitialized: false,
        smoothZoomEnabled: true,
        panEnabled: true,
        zoomEnabled: true
    };

    /** Настройки */
    let _settings = {
        // Зум
        zoomStep: 0.1,
        zoomStepLarge: 0.3,
        minZoom: 0.3,
        maxZoom: 5,
        initialZoom: 1,
        doubleClickZoom: 1.5,
        scrollZoomSpeed: 0.001,
        
        // Пан
        panFriction: 0.92,
        panMomentum: true,
        
        // Анимация
        animationDuration: 300,
        smoothZoomDuration: 400,
        
        // Жесты
        pinchZoomEnabled: true,
        doubleTapZoomEnabled: true,
        
        // Границы
        boundPan: true,
        boundZoom: true,
        
        // Курсор
        grabCursor: true,
        grabbingClass: 'panning',
        
        // Кнопки
        showZoomControls: true,
        zoomInLabel: '+',
        zoomOutLabel: '−',
        resetLabel: '⟲'
    };

    /** Таймеры */
    let _timers = {};

    /** Скорость для инерции */
    let _velocity = { x: 0, y: 0 };
    let _lastPanTime = 0;

    // ==========================================
    // ИНИЦИАЛИЗАЦИЯ
    // ==========================================

    /**
     * Инициализация менеджера зума
     * @param {object} options - параметры
     */
    function init(options = {}) {
        console.log('[ZoomManager] Инициализация...');

        // Сохраняем элементы
        _elements.container = options.container || document.getElementById('map-container');
        _elements.zoomContainer = options.zoomContainer || document.getElementById('zoom-container');
        _elements.zoomInBtn = options.zoomInBtn || document.getElementById('zoomIn');
        _elements.zoomOutBtn = options.zoomOutBtn || document.getElementById('zoomOut');
        _elements.resetBtn = options.resetBtn || document.getElementById('resetZoom');

        // Сохраняем колбэки
        if (options.onZoomChange) _callbacks.onZoomChange = options.onZoomChange;
        if (options.onPanStart) _callbacks.onPanStart = options.onPanStart;
        if (options.onPanMove) _callbacks.onPanMove = options.onPanMove;
        if (options.onPanEnd) _callbacks.onPanEnd = options.onPanEnd;

        // Обновляем настройки
        if (options.settings) {
            _settings = { ..._settings, ...options.settings };
            // Синхронизируем с состоянием
            _state.minZoom = _settings.minZoom;
            _state.maxZoom = _settings.maxZoom;
            _state.zoomStep = _settings.zoomStep;
            _state.zoom = _settings.initialZoom;
        }

        // Проверяем наличие контейнера
        if (!_elements.container) {
            console.error('[ZoomManager] Контейнер карты не найден');
            return false;
        }

        if (!_elements.zoomContainer) {
            console.error('[ZoomManager] Zoom-контейнер не найден');
            return false;
        }

        // Находим SVG элемент
        _findSVGElement();

        // Настраиваем контейнер
        _setupContainer();

        // Привязываем события
        _bindEvents();

        // Применяем начальный зум
        _applyTransform();

        _state.isInitialized = true;

        console.log('[ZoomManager] Инициализация завершена');
        console.log(`  Зум: ${_state.zoom}x, Границы: ${_state.minZoom}-${_state.maxZoom}x`);

        return true;
    }

    /**
     * Находит SVG элемент в контейнере
     */
    function _findSVGElement() {
        const svgContainer = document.getElementById('svg-container');
        if (svgContainer) {
            _svgElement = svgContainer.querySelector('svg');
        }
    }

    /**
     * Настраивает контейнер карты
     */
    function _setupContainer() {
        if (!_elements.container) return;

        // Стили контейнера
        _elements.container.style.overflow = 'hidden';
        _elements.container.style.position = 'relative';
        _elements.container.style.touchAction = 'none'; // Предотвращаем жесты браузера

        // Стили zoom-контейнера
        if (_elements.zoomContainer) {
            _elements.zoomContainer.style.transformOrigin = '0 0';
            _elements.zoomContainer.style.transition = 
                `transform ${_settings.animationDuration}ms ${_state.zoomEasing}`;
            _elements.zoomContainer.style.willChange = 'transform';
        }

        // Курсор
        if (_settings.grabCursor) {
            _elements.container.style.cursor = 'grab';
        }
    }

    /**
     * Привязывает все события
     */
    function _bindEvents() {
        if (!_elements.container) return;

        // ==========================================
        // МЫШЬ
        // ==========================================

        // Колёсико мыши (зум)
        _elements.container.addEventListener('wheel', _handleWheel, { passive: false });

        // Двойной клик (зум)
        _elements.container.addEventListener('dblclick', _handleDoubleClick);

        // Перетаскивание (пан)
        _elements.container.addEventListener('mousedown', _handleMouseDown);
        document.addEventListener('mousemove', _handleMouseMove);
        document.addEventListener('mouseup', _handleMouseUp);

        // Предотвращаем выделение текста при перетаскивании
        _elements.container.addEventListener('selectstart', (e) => {
            if (_state.isPanning) {
                e.preventDefault();
            }
        });

        // ==========================================
        // ТАЧ (МОБИЛЬНЫЕ)
        // ==========================================

        _elements.container.addEventListener('touchstart', _handleTouchStart, { passive: false });
        _elements.container.addEventListener('touchmove', _handleTouchMove, { passive: false });
        _elements.container.addEventListener('touchend', _handleTouchEnd);
        _elements.container.addEventListener('touchcancel', _handleTouchEnd);

        // ==========================================
        // КНОПКИ ЗУМА
        // ==========================================

        if (_elements.zoomInBtn) {
            _elements.zoomInBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                zoomIn();
            });
        }

        if (_elements.zoomOutBtn) {
            _elements.zoomOutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                zoomOut();
            });
        }

        if (_elements.resetBtn) {
            _elements.resetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                resetView();
            });
        }

        // ==========================================
        // КЛАВИАТУРА
        // ==========================================

        document.addEventListener('keydown', (event) => {
            // Игнорируем если фокус в поле ввода
            if (event.target.tagName === 'INPUT' || 
                event.target.tagName === 'TEXTAREA' ||
                event.target.isContentEditable) {
                return;
            }

            switch (event.key) {
                case '+':
                case '=':
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        zoomIn(_state.zoomStep * 3);
                    }
                    break;

                case '-':
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        zoomOut(_state.zoomStep * 3);
                    }
                    break;

                case '0':
                    if (event.ctrlKey || event.metaKey) {
                        event.preventDefault();
                        resetView();
                    }
                    break;

                case 'ArrowLeft':
                    if (_state.isPanning) return;
                    panBy(50, 0);
                    break;

                case 'ArrowRight':
                    if (_state.isPanning) return;
                    panBy(-50, 0);
                    break;

                case 'ArrowUp':
                    if (_state.isPanning) return;
                    panBy(0, 50);
                    break;

                case 'ArrowDown':
                    if (_state.isPanning) return;
                    panBy(0, -50);
                    break;
            }
        });

        // ==========================================
        // ИЗМЕНЕНИЕ РАЗМЕРА ОКНА
        // ==========================================

        window.addEventListener('resize', Utils.debounce(() => {
            _clampPanBounds();
            _applyTransform(false);
        }, 250));
    }

    // ==========================================
    // ОБРАБОТЧИКИ МЫШИ
    // ==========================================

    /**
     * Обработчик колёсика мыши
     * @param {WheelEvent} event
     */
    function _handleWheel(event) {
        if (!_state.zoomEnabled) return;

        event.preventDefault();

        // Направление зума
        const delta = -Math.sign(event.deltaY);
        const zoomFactor = 1 + Math.abs(event.deltaY) * _settings.scrollZoomSpeed;
        
        let newZoom = _state.zoom;
        
        if (delta > 0) {
            newZoom *= zoomFactor;
        } else {
            newZoom /= zoomFactor;
        }

        // Ограничиваем зум
        newZoom = Utils.clamp(newZoom, _state.minZoom, _state.maxZoom);

        // Зум к точке курсора
        if (event.ctrlKey || event.metaKey) {
            // Точный зум с центрированием на курсор
            zoomToPoint(newZoom, event.clientX, event.clientY);
        } else {
            // Обычный зум от центра
            setZoom(newZoom, true);
        }
    }

    /**
     * Обработчик двойного клика
     * @param {MouseEvent} event
     */
    function _handleDoubleClick(event) {
        if (!_state.zoomEnabled || !_settings.doubleClickZoom) return;

        event.preventDefault();

        const rect = _elements.container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Переключаем между текущим зумом и увеличенным
        const targetZoom = _state.zoom < 2 
            ? _state.zoom * _settings.doubleClickZoom 
            : _state.zoom / _settings.doubleClickZoom;

        const clampedZoom = Utils.clamp(targetZoom, _state.minZoom, _state.maxZoom);
        
        zoomToPoint(clampedZoom, event.clientX, event.clientY);
    }

    /**
     * Обработчик нажатия мыши
     * @param {MouseEvent} event
     */
    function _handleMouseDown(event) {
        if (!_state.panEnabled) return;

        // Игнорируем если клик по стране (пусть MapManager обрабатывает)
        if (event.target.closest('.country-path, .country-selected, .country-hovered')) {
            return;
        }

        // Игнорируем правую кнопку
        if (event.button !== 0) return;

        event.preventDefault();

        _state.isPanning = true;
        _state.panStartX = event.clientX - _state.panX;
        _state.panStartY = event.clientY - _state.panY;
        _state.lastPanX = event.clientX;
        _state.lastPanY = event.clientY;
        _lastPanTime = Date.now();
        
        // Сбрасываем скорость
        _velocity.x = 0;
        _velocity.y = 0;

        // Обновляем курсор
        _elements.container.classList.add(_settings.grabbingClass);
        _elements.container.style.cursor = 'grabbing';

        // Останавливаем текущую анимацию
        _stopAnimation();

        // Вызываем колбэк
        if (_callbacks.onPanStart) {
            _callbacks.onPanStart({ x: _state.panX, y: _state.panY });
        }
    }

    /**
     * Обработчик движения мыши
     * @param {MouseEvent} event
     */
    function _handleMouseMove(event) {
        if (!_state.isPanning) return;

        const currentTime = Date.now();
        const deltaTime = currentTime - _lastPanTime || 1;

        // Вычисляем скорость для инерции
        _velocity.x = (event.clientX - _state.lastPanX) / deltaTime * 16;
        _velocity.y = (event.clientY - _state.lastPanY) / deltaTime * 16;

        // Обновляем позицию
        _state.panX = event.clientX - _state.panStartX;
        _state.panY = event.clientY - _state.panStartY;

        // Ограничиваем границами
        if (_settings.boundPan) {
            _clampPanBounds();
        }

        _state.lastPanX = event.clientX;
        _state.lastPanY = event.clientY;
        _lastPanTime = currentTime;

        // Применяем трансформацию без анимации
        _applyTransform(false);

        // Вызываем колбэк
        if (_callbacks.onPanMove) {
            _callbacks.onPanMove({ x: _state.panX, y: _state.panY });
        }
    }

    /**
     * Обработчик отпускания мыши
     * @param {MouseEvent} event
     */
    function _handleMouseUp(event) {
        if (!_state.isPanning) return;

        _state.isPanning = false;
        _elements.container.classList.remove(_settings.grabbingClass);
        _elements.container.style.cursor = _settings.grabCursor ? 'grab' : '';

        // Применяем инерцию
        if (_settings.panMomentum && (Math.abs(_velocity.x) > 0.5 || Math.abs(_velocity.y) > 0.5)) {
            _applyMomentum();
        }

        // Вызываем колбэк
        if (_callbacks.onPanEnd) {
            _callbacks.onPanEnd({ x: _state.panX, y: _state.panY });
        }
    }

    // ==========================================
    // ОБРАБОТЧИКИ ТАЧ
    // ==========================================

    /**
     * Обработчик начала касания
     * @param {TouchEvent} event
     */
    function _handleTouchStart(event) {
        if (event.touches.length === 2) {
            // Пинч (двумя пальцами)
            event.preventDefault();
            
            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            
            _state.touchStartDistance = _getTouchDistance(touch1, touch2);
            _state.touchStartZoom = _state.zoom;
            _state.touchStartPanX = _state.panX;
            _state.touchStartPanY = _state.panY;

            // Средняя точка между пальцами
            _state.lastTouchX = (touch1.clientX + touch2.clientX) / 2;
            _state.lastTouchY = (touch1.clientY + touch2.clientY) / 2;

        } else if (event.touches.length === 1) {
            // Один палец — пан
            const touch = event.touches[0];
            
            _state.isPanning = true;
            _state.panStartX = touch.clientX - _state.panX;
            _state.panStartY = touch.clientY - _state.panY;
            _state.lastPanX = touch.clientX;
            _state.lastPanY = touch.clientY;
            _lastPanTime = Date.now();
            
            _velocity.x = 0;
            _velocity.y = 0;

            _stopAnimation();
        }
    }

    /**
     * Обработчик движения пальцев
     * @param {TouchEvent} event
     */
    function _handleTouchMove(event) {
        if (event.touches.length === 2 && _settings.pinchZoomEnabled) {
            // Пинч-зум
            event.preventDefault();

            const touch1 = event.touches[0];
            const touch2 = event.touches[1];
            
            const currentDistance = _getTouchDistance(touch1, touch2);
            const scale = currentDistance / _state.touchStartDistance;
            
            let newZoom = _state.touchStartZoom * scale;
            newZoom = Utils.clamp(newZoom, _state.minZoom, _state.maxZoom);

            // Центр пинча
            const centerX = (touch1.clientX + touch2.clientX) / 2;
            const centerY = (touch1.clientY + touch2.clientY) / 2;

            // Перемещение при пинче
            const deltaX = centerX - _state.lastTouchX;
            const deltaY = centerY - _state.lastTouchY;

            _state.zoom = newZoom;
            _state.panX = _state.touchStartPanX + deltaX;
            _state.panY = _state.touchStartPanY + deltaY;

            _state.lastTouchX = centerX;
            _state.lastTouchY = centerY;

            _applyTransform(false);

            // Обновляем отображение зума
            _notifyZoomChange();

        } else if (event.touches.length === 1 && _state.isPanning) {
            // Пан одним пальцем
            const touch = event.touches[0];
            
            const currentTime = Date.now();
            const deltaTime = currentTime - _lastPanTime || 1;

            _velocity.x = (touch.clientX - _state.lastPanX) / deltaTime * 16;
            _velocity.y = (touch.clientY - _state.lastPanY) / deltaTime * 16;

            _state.panX = touch.clientX - _state.panStartX;
            _state.panY = touch.clientY - _state.panStartY;

            if (_settings.boundPan) {
                _clampPanBounds();
            }

            _state.lastPanX = touch.clientX;
            _state.lastPanY = touch.clientY;
            _lastPanTime = currentTime;

            _applyTransform(false);
        }
    }

    /**
     * Обработчик окончания касания
     * @param {TouchEvent} event
     */
    function _handleTouchEnd(event) {
        if (event.touches.length === 0) {
            _state.isPanning = false;

            // Применяем инерцию
            if (_settings.panMomentum && 
                (Math.abs(_velocity.x) > 0.3 || Math.abs(_velocity.y) > 0.3)) {
                _applyMomentum();
            }
        }
    }

    /**
     * Вычисляет расстояние между двумя точками касания
     * @param {Touch} touch1
     * @param {Touch} touch2
     * @returns {number}
     */
    function _getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // ==========================================
    // ТРАНСФОРМАЦИЯ
    // ==========================================

    /**
     * Применяет трансформацию к zoom-контейнеру
     * @param {boolean} animate - с анимацией
     */
    function _applyTransform(animate = true) {
        if (!_elements.zoomContainer) return;

        const transform = `translate(${_state.panX}px, ${_state.panY}px) scale(${_state.zoom})`;

        if (animate) {
            _elements.zoomContainer.style.transition = 
                `transform ${_settings.animationDuration}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
        } else {
            _elements.zoomContainer.style.transition = 'none';
        }

        _elements.zoomContainer.style.transform = transform;
    }

    /**
    * Ограничивает панорамирование границами
    */
    function _clampPanBounds() {
    if (!_elements.container) return;

    const containerRect = _elements.container.getBoundingClientRect();
    const containerW = containerRect.width;
    const containerH = containerRect.height;

    // Увеличенный множитель для границ (было 2, стало 5)
    const boundsMultiplier = 5;
    
    // Вычисляем границы с учётом зума и множителя
    const scaledW = containerW * _state.zoom * boundsMultiplier;
    const scaledH = containerH * _state.zoom * boundsMultiplier;

    const maxPanX = Math.max(0, (scaledW - containerW) / 2);
    const maxPanY = Math.max(0, (scaledH - containerH) / 2);

    _state.panX = Utils.clamp(_state.panX, -maxPanX, maxPanX);
    _state.panY = Utils.clamp(_state.panY, -maxPanY, maxPanY);
}

    // ==========================================
    // ЗУМ
    // ==========================================

    /**
     * Увеличивает масштаб
     * @param {number} step - шаг (по умолчанию из настроек)
     */
    function zoomIn(step = null) {
        const zoomStep = step || _state.zoomStep;
        const newZoom = _state.zoom + zoomStep;
        setZoom(newZoom, true);
    }

    /**
     * Уменьшает масштаб
     * @param {number} step - шаг
     */
    function zoomOut(step = null) {
        const zoomStep = step || _state.zoomStep;
        const newZoom = _state.zoom - zoomStep;
        setZoom(newZoom, true);
    }

    /**
     * Устанавливает масштаб
     * @param {number} zoom - новый масштаб
     * @param {boolean} animate - с анимацией
     */
    function setZoom(zoom, animate = true) {
        const oldZoom = _state.zoom;
        const newZoom = Utils.clamp(zoom, _state.minZoom, _state.maxZoom);

        if (newZoom === oldZoom) return;

        _state.zoom = newZoom;

        // Корректируем пан при изменении зума
        if (_elements.container) {
            const rect = _elements.container.getBoundingClientRect();
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const scale = newZoom / oldZoom;
            _state.panX = centerX - (centerX - _state.panX) * scale;
            _state.panY = centerY - (centerY - _state.panY) * scale;

            if (_settings.boundPan) {
                _clampPanBounds();
            }
        }

        _applyTransform(animate);
        _notifyZoomChange();
    }

    /**
     * Зум к определённой точке
     * @param {number} zoom - целевой масштаб
     * @param {number} clientX - X координата мыши
     * @param {number} clientY - Y координата мыши
     */
    function zoomToPoint(zoom, clientX, clientY) {
        if (!_elements.container) return;

        const rect = _elements.container.getBoundingClientRect();
        const containerX = clientX - rect.left;
        const containerY = clientY - rect.top;

        const oldZoom = _state.zoom;
        const newZoom = Utils.clamp(zoom, _state.minZoom, _state.maxZoom);

        if (newZoom === oldZoom) return;

        // Вычисляем новое положение, чтобы точка под курсором осталась на месте
        const scale = newZoom / oldZoom;
        _state.panX = clientX - rect.left - (containerX - _state.panX) * scale;
        _state.panY = clientY - rect.top - (containerY - _state.panY) * scale;
        _state.zoom = newZoom;

        if (_settings.boundPan) {
            _clampPanBounds();
        }

        _applyTransform(false);
        _notifyZoomChange();
    }

    /**
     * Плавный зум
     * @param {number} targetZoom - целевой масштаб
     * @param {number} duration - длительность
     */
    function smoothZoom(targetZoom, duration = null) {
        const startZoom = _state.zoom;
        const endZoom = Utils.clamp(targetZoom, _state.minZoom, _state.maxZoom);
        const animDuration = duration || _settings.smoothZoomDuration;

        if (startZoom === endZoom) return;

        _stopAnimation();

        const startTime = performance.now();

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / animDuration, 1);

            // Easing: easeInOutCubic
            const eased = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            _state.zoom = startZoom + (endZoom - startZoom) * eased;
            _applyTransform(false);
            _notifyZoomChange();

            if (progress < 1) {
                _state.animationId = requestAnimationFrame(animate);
            } else {
                _state.isAnimating = false;
                _state.animationId = null;
            }
        }

        _state.isAnimating = true;
        _state.animationId = requestAnimationFrame(animate);
    }

    /**
     * Сбрасывает зум к начальному
     */
    function resetZoom() {
        setZoom(_settings.initialZoom, true);
    }

    // ==========================================
    // ПАН (ПЕРЕМЕЩЕНИЕ)
    // ==========================================

    /**
     * Перемещает карту на указанное смещение
     * @param {number} dx - смещение по X
     * @param {number} dy - смещение по Y
     * @param {boolean} animate - с анимацией
     */
    function panBy(dx, dy, animate = true) {
        _state.panX += dx;
        _state.panY += dy;

        if (_settings.boundPan) {
            _clampPanBounds();
        }

        _applyTransform(animate);
    }

    /**
     * Перемещает карту к указанным координатам
     * @param {number} x - целевая X позиция
     * @param {number} y - целевая Y позиция
     * @param {boolean} animate - с анимацией
     */
    function panTo(x, y, animate = true) {
        _state.panX = x;
        _state.panY = y;

        if (_settings.boundPan) {
            _clampPanBounds();
        }

        _applyTransform(animate);
    }

    /**
     * Центрирует карту на указанной точке
     * @param {number} x - X координата в системе SVG
     * @param {number} y - Y координата в системе SVG
     * @param {boolean} animate - с анимацией
     */
    function centerOn(x, y, animate = true) {
        if (!_elements.container) return;

        const rect = _elements.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        _state.panX = centerX - x * _state.zoom;
        _state.panY = centerY - y * _state.zoom;

        if (_settings.boundPan) {
            _clampPanBounds();
        }

        _applyTransform(animate);
    }

    /**
     * Сбрасывает панорамирование
     */
    function resetPan() {
        panTo(0, 0, true);
    }

    // ==========================================
    // СБРОС ВИДА
    // ==========================================

    /**
     * Полный сброс вида (зум + пан)
     */
    function resetView() {
        _stopAnimation();
        
        _state.zoom = _settings.initialZoom;
        _state.panX = 0;
        _state.panY = 0;
        
        _applyTransform(true);
        _notifyZoomChange();
        
        console.log('[ZoomManager] Вид сброшен');
    }

    /**
     * Анимированный сброс вида
     */
    function animateResetView() {
        _stopAnimation();

        const startZoom = _state.zoom;
        const startPanX = _state.panX;
        const startPanY = _state.panY;
        const endZoom = _settings.initialZoom;
        const duration = _settings.animationDuration;

        const startTime = performance.now();

        function animate(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing: easeInOutCubic
            const eased = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            _state.zoom = startZoom + (endZoom - startZoom) * eased;
            _state.panX = startPanX * (1 - eased);
            _state.panY = startPanY * (1 - eased);

            _applyTransform(false);
            _notifyZoomChange();

            if (progress < 1) {
                _state.animationId = requestAnimationFrame(animate);
            } else {
                _state.isAnimating = false;
                _state.animationId = null;
            }
        }

        _state.isAnimating = true;
        _state.animationId = requestAnimationFrame(animate);
    }

    // ==========================================
    // ИНЕРЦИЯ
    // ==========================================

    /**
     * Применяет инерционное движение
     */
    function _applyMomentum() {
        if (!_settings.panMomentum) return;

        _stopAnimation();

        const friction = _settings.panFriction;
        let vx = _velocity.x;
        let vy = _velocity.y;

        function animate() {
            if (Math.abs(vx) < 0.1 && Math.abs(vy) < 0.1) {
                _state.animationId = null;
                return;
            }

            _state.panX += vx;
            _state.panY += vy;

            vx *= friction;
            vy *= friction;

            if (_settings.boundPan) {
                _clampPanBounds();
                
                // Останавливаем инерцию при достижении границ
                if (_state.panX <= _state.bounds.minX || 
                    _state.panX >= _state.bounds.maxX) {
                    vx = 0;
                }
                if (_state.panY <= _state.bounds.minY || 
                    _state.panY >= _state.bounds.maxY) {
                    vy = 0;
                }
            }

            _applyTransform(false);
            _state.animationId = requestAnimationFrame(animate);
        }

        _state.animationId = requestAnimationFrame(animate);
    }

    /**
     * Останавливает текущую анимацию
     */
    function _stopAnimation() {
        if (_state.animationId) {
            cancelAnimationFrame(_state.animationId);
            _state.animationId = null;
        }
        _state.isAnimating = false;
    }

    // ==========================================
    // УВЕДОМЛЕНИЯ
    // ==========================================

    /**
     * Оповещает об изменении зума
     */
    function _notifyZoomChange() {
        if (_callbacks.onZoomChange) {
            _callbacks.onZoomChange(_state.zoom);
        }

        // Обновляем зум в статусбаре (если есть)
        const zoomValueEl = document.getElementById('zoomValue');
        if (zoomValueEl) {
            const percentage = Math.round(_state.zoom * 100);
            zoomValueEl.textContent = `${percentage}%`;
        }
    }

    // ==========================================
    // УТИЛИТЫ
    // ==========================================

    /**
     * Получает текущий зум
     * @returns {number}
     */
    function getZoom() {
        return _state.zoom;
    }

    /**
     * Получает текущее смещение
     * @returns {object} {x, y}
     */
    function getPan() {
        return { x: _state.panX, y: _state.panY };
    }

    /**
     * Получает состояние
     * @returns {object}
     */
    function getState() {
        return { ..._state };
    }

    /**
     * Включает/выключает зум
     * @param {boolean} enabled
     */
    function setZoomEnabled(enabled) {
        _state.zoomEnabled = enabled;
    }

    /**
     * Включает/выключает панорамирование
     * @param {boolean} enabled
     */
    function setPanEnabled(enabled) {
        _state.panEnabled = enabled;
    }

    /**
     * Обновляет размеры при ресайзе
     */
    function handleResize() {
        if (_settings.boundPan) {
            _clampPanBounds();
            _applyTransform(false);
        }
    }

    /**
     * Уничтожает менеджер зума
     */
    function destroy() {
        _stopAnimation();

        // Очищаем таймеры
        Object.values(_timers).forEach(timer => clearTimeout(timer));
        _timers = {};

        // Сбрасываем трансформацию
        if (_elements.zoomContainer) {
            _elements.zoomContainer.style.transform = '';
            _elements.zoomContainer.style.transition = '';
        }

        // Убираем обработчики
        if (_elements.container) {
            _elements.container.style.cursor = '';
            _elements.container.classList.remove(_settings.grabbingClass);
        }

        _state.isInitialized = false;

        console.log('[ZoomManager] Уничтожен');
    }

    // ==========================================
    // ПУБЛИЧНЫЙ API
    // ==========================================

    return {
        // Инициализация
        init,

        // Зум
        zoomIn,
        zoomOut,
        setZoom,
        zoomToPoint,
        smoothZoom,
        resetZoom,

        // Пан
        panBy,
        panTo,
        centerOn,
        resetPan,

        // Сброс
        resetView,
        animateResetView,

        // Состояние
        getZoom,
        getPan,
        getState,

        // Управление
        setZoomEnabled,
        setPanEnabled,

        // Утилиты
        handleResize,
        destroy
    };

})();


/* ============================================================
   ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
   ============================================================ */

window.ZoomManager = ZoomManager;