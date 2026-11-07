(function () {
  "use strict";

  const config = window.EXOLAND_CONFIG || {};
  const currentPage = document.body.dataset.page || "overview";
  const mobileQuery = window.matchMedia("(max-width: 900px)");

  const navigation = [
    {
      title: "Главное",
      number: "01",
      items: [
        {
          id: "overview",
          href: "index.html",
          title: "Информация",
          short: "О сервере и его идее",
          keywords: "главная обзор exoland сервер полу ванильный"
        },
        {
          id: "join",
          href: "join.html",
          title: "Как присоединиться?",
          short: "Путь от клиента до входа",
          keywords: "вход ip адрес версия подключение начать"
        }
      ]
    },
    {
      title: "Клиент",
      number: "02",
      items: [
        {
          id: "required-mod",
          href: "required-mod.html",
          title: "Обязательный мод",
          short: "Один мод для игры",
          keywords: "мод обязательный установка загрузчик скачать"
        },
        {
          id: "recommended-mods",
          href: "recommended-mods.html",
          title: "Желательные моды",
          short: "Оптимизация и удобство",
          keywords: "sodium iris appleskin свет шейдеры моды список"
        }
      ]
    },
    {
      title: "Мир ExoLand",
      number: "03",
      items: [
        {
          id: "lore",
          href: "lore.html",
          title: "РП и живой лор",
          short: "Как влиять на историю",
          keywords: "лор rp рп роль персонаж событие канон фракция"
        },
        {
          id: "rules",
          href: "rules.html",
          title: "Правила сервера",
          short: "Границы честной игры",
          keywords: "правила гриферство читы пвп чат наказания"
        }
      ]
    },
    {
      title: "Помощь",
      number: "04",
      items: [
        {
          id: "faq",
          href: "faq.html",
          title: "Частые вопросы",
          short: "Короткие ответы",
          keywords: "faq чзв вопросы ответы вайп лицензия помощь"
        }
      ]
    }
  ];

  const pages = navigation.flatMap((group) =>
    group.items.map((item) => ({ ...item, group: group.title }))
  );

  function getValue(path) {
    return path.split(".").reduce((value, key) => value && value[key], config);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function icon(name) {
    const icons = {
      menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
      close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
      search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
      arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
      copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
      external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8"/><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
      check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>'
    };
    return icons[name] || "";
  }

  function renderSidebar() {
    const mount = document.getElementById("sidebar-mount");
    if (!mount) return;

    const groups = navigation
      .map((group) => {
        const links = group.items
          .map(
            (item) => `
              <a class="nav-link${item.id === currentPage ? " is-active" : ""}"
                 href="${item.href}"${item.id === currentPage ? ' aria-current="page"' : ""}>
                <span class="nav-link__marker"></span>
                <span>
                  <strong>${item.title}</strong>
                  <small>${item.short}</small>
                </span>
              </a>`
          )
          .join("");

        return `
          <section class="nav-group" aria-labelledby="nav-${group.number}">
            <div class="nav-group__title" id="nav-${group.number}">
              <span>${group.number}</span>${group.title}
            </div>
            ${links}
          </section>`;
      })
      .join("");

    mount.innerHTML = `
      <aside class="sidebar" id="sidebar" aria-label="Навигация по WIKI">
        <div class="sidebar__top">
          <a class="brand" href="index.html">
            <img src="Source/EL.png" alt="" width="52" height="52">
            <span><strong>EXOLAND</strong><small>База знаний</small></span>
          </a>
          <button class="icon-button sidebar__close" type="button" data-sidebar-close aria-label="Закрыть меню">
            ${icon("close")}
          </button>
        </div>

        <div class="server-state">
          <span class="status-dot" aria-hidden="true"></span>
          <span><small>Статус проекта</small><strong data-config="server.status"></strong></span>
        </div>

        <nav class="sidebar__nav">${groups}</nav>

        <a class="sidebar-cta" href="join.html">
          <span><small>Впервые здесь?</small><strong>Начать путешествие</strong></span>
          ${icon("arrow")}
        </a>
      </aside>`;
  }

  function renderTopbar() {
    const mount = document.getElementById("topbar-mount");
    if (!mount) return;
    const page = pages.find((item) => item.id === currentPage) || pages[0];

    mount.innerHTML = `
      <header class="topbar">
        <button class="icon-button menu-button" id="menu-button" type="button"
                aria-label="Открыть навигацию" aria-controls="sidebar" aria-expanded="false">
          ${icon("menu")}
        </button>
        <div class="breadcrumbs" aria-label="Хлебные крошки">
          <a href="index.html">WIKI</a><span>/</span><span>${page.group}</span><span>/</span><strong>${page.title}</strong>
        </div>
        <button class="search-button" id="search-button" type="button">
          ${icon("search")}<span>Поиск по WIKI</span><kbd>Ctrl K</kbd>
        </button>
      </header>`;
  }

  function renderFooter() {
    const mount = document.getElementById("footer-mount");
    if (!mount) return;
    mount.innerHTML = `
      <footer class="footer">
        <div class="footer__brand"><img src="Source/EL.png" alt="" width="34" height="34"><span>ExoLand WIKI</span></div>
        <p></p>
        <span>© <span data-config="project.year"></span> ExoLand</span>
      </footer>`;
  }

  function renderPager() {
    const mount = document.getElementById("pager-mount");
    if (!mount) return;
    const index = pages.findIndex((item) => item.id === currentPage);
    if (index < 0) return;
    const previous = pages[index - 1];
    const next = pages[index + 1];

    mount.innerHTML = `
      <nav class="page-pager" aria-label="Соседние статьи">
        ${previous ? `<a class="page-pager__link page-pager__link--previous" href="${previous.href}"><small>Предыдущая статья</small><strong>${previous.title}</strong></a>` : "<span></span>"}
        ${next ? `<a class="page-pager__link page-pager__link--next" href="${next.href}"><small>Следующая статья</small><strong>${next.title}</strong>${icon("arrow")}</a>` : "<span></span>"}
      </nav>`;
  }

  function renderSearch() {
    const mount = document.getElementById("search-mount");
    if (!mount) return;
    mount.innerHTML = `
      <dialog class="search-dialog" id="search-dialog">
        <div class="search-dialog__bar">
          ${icon("search")}
          <label class="sr-only" for="wiki-search">Поиск по WIKI</label>
          <input id="wiki-search" type="search" placeholder="Например: моды, лор или правила" autocomplete="off">
          <button class="icon-button" id="search-close" type="button" aria-label="Закрыть поиск">${icon("close")}</button>
        </div>
        <div class="search-dialog__hint"><span>Разделы WIKI</span><span><kbd>Esc</kbd> закрыть</span></div>
        <div class="search-results" id="search-results"></div>
      </dialog>`;
  }

  function applyConfig() {
    document.querySelectorAll("[data-config]").forEach((element) => {
      const value = getValue(element.dataset.config);
      element.textContent = value == null || value === "" ? "Не указано" : value;
    });

    document.querySelectorAll("[data-config-link]").forEach((link) => {
      const href = getValue(link.dataset.configLink);
      if (href) {
        link.href = href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      } else {
        link.removeAttribute("href");
        link.classList.add("is-disabled");
        link.setAttribute("aria-disabled", "true");
        const fallback = link.dataset.fallback;
        if (fallback) {
          const label = link.querySelector("[data-link-label]");
          if (label) label.textContent = fallback;
        }
      }
    });

    document.querySelectorAll("[data-address-state]").forEach((element) => {
      element.classList.toggle("is-pending", !getValue("server.addressPublished"));
    });
  }

  function setSidebar(open) {
    if (mobileQuery.matches) {
      document.body.classList.toggle("sidebar-open", open);
    } else {
      document.body.classList.toggle("sidebar-collapsed", !open);
      try {
        localStorage.setItem("exoland-sidebar-open", String(open));
      } catch (_) {
        // Local storage can be unavailable when the file is opened locally.
      }
    }
    const button = document.getElementById("menu-button");
    if (button) button.setAttribute("aria-expanded", String(open));
  }

  function initSidebar() {
    let desktopOpen = true;
    try {
      desktopOpen = localStorage.getItem("exoland-sidebar-open") !== "false";
    } catch (_) {
      desktopOpen = true;
    }
    if (!mobileQuery.matches) setSidebar(desktopOpen);

    document.getElementById("menu-button")?.addEventListener("click", () => {
      const open = mobileQuery.matches
        ? !document.body.classList.contains("sidebar-open")
        : document.body.classList.contains("sidebar-collapsed");
      setSidebar(open);
    });

    document.querySelectorAll("[data-sidebar-close], .sidebar .nav-link").forEach((element) => {
      element.addEventListener("click", () => {
        if (mobileQuery.matches) setSidebar(false);
      });
    });

    mobileQuery.addEventListener?.("change", (event) => {
      document.body.classList.remove("sidebar-open");
      if (event.matches) {
        document.body.classList.remove("sidebar-collapsed");
      } else {
        let open = true;
        try {
          open = localStorage.getItem("exoland-sidebar-open") !== "false";
        } catch (_) {
          open = true;
        }
        setSidebar(open);
      }
    });
  }

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timeout);
    showToast.timeout = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  async function copyText(text, successMessage) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    showToast(successMessage || "Скопировано");
  }

  function initCopyButtons() {
    document.querySelectorAll("[data-copy-server]").forEach((button) => {
      if (!getValue("server.addressPublished")) {
        button.disabled = true;
        button.title = "Адрес ещё не опубликован";
        return;
      }
      button.addEventListener("click", () => copyText(getValue("server.address"), "Адрес сервера скопирован"));
    });

    document.querySelectorAll("[data-copy-text]").forEach((button) => {
      button.addEventListener("click", () => copyText(button.dataset.copyText, "Шаблон скопирован"));
    });
  }

  function renderSearchResults(query) {
    const target = document.getElementById("search-results");
    if (!target) return;
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    const matches = pages.filter((page) => {
      const haystack = `${page.title} ${page.short} ${page.group} ${page.keywords}`.toLocaleLowerCase("ru-RU");
      return !normalized || haystack.includes(normalized);
    });

    if (!matches.length) {
      target.innerHTML = '<div class="search-empty"><strong>Ничего не найдено</strong><span>Попробуйте другой запрос или откройте раздел из меню.</span></div>';
      return;
    }

    target.innerHTML = matches
      .map(
        (page) => `
          <a class="search-result" href="${page.href}">
            <span><small>${page.group}</small><strong>${page.title}</strong><em>${page.short}</em></span>
            ${icon("arrow")}
          </a>`
      )
      .join("");
  }

  function initSearch() {
    const dialog = document.getElementById("search-dialog");
    const input = document.getElementById("wiki-search");
    if (!dialog || !input) return;

    function openSearch() {
      renderSearchResults("");
      dialog.showModal();
      window.setTimeout(() => input.focus(), 30);
    }

    function closeSearch() {
      dialog.close();
      input.value = "";
    }

    document.getElementById("search-button")?.addEventListener("click", openSearch);
    document.getElementById("search-close")?.addEventListener("click", closeSearch);
    input.addEventListener("input", () => renderSearchResults(input.value));
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeSearch();
    });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        dialog.open ? closeSearch() : openSearch();
      }
      if (event.key === "/" && !dialog.open && !/input|textarea/i.test(document.activeElement?.tagName || "")) {
        event.preventDefault();
        openSearch();
      }
    });
  }

  function initModFilters() {
    const controls = document.querySelectorAll("[data-mod-filter]");
    const cards = document.querySelectorAll("[data-mod-kind]");
    if (!controls.length || !cards.length) return;

    controls.forEach((button) => {
      button.addEventListener("click", () => {
        controls.forEach((control) => control.classList.remove("is-active"));
        button.classList.add("is-active");
        const filter = button.dataset.modFilter;
        cards.forEach((card) => {
          card.hidden = filter !== "all" && card.dataset.modKind !== filter;
        });
      });
    });
  }

  function initReveal() {
    document.documentElement.classList.add("reveal-ready");
    if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.querySelectorAll("[data-reveal]").forEach((element) => element.classList.add("is-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    document.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));
  }

  renderSidebar();
  renderTopbar();
  renderFooter();
  renderPager();
  renderSearch();
  applyConfig();
  initSidebar();
  initCopyButtons();
  initSearch();
  initModFilters();
  initReveal();
})();
