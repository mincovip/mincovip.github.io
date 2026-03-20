(() => {
  "use strict";

  const STORAGE_KEY = "iyf_weekly_anime_calendar_v1";

  const DAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  const els = {};
  let storageMode = "localStorage"; // or "memory"
  let memoryState = null;

  const defaultState = () => ({
    version: 1,
    days: Array.from({ length: 7 }, () => []),
  });

  const getTodayIndex = () => {
    // JS: Sunday=0..Saturday=6；我们需要 Monday=0..Sunday=6
    const d = new Date();
    return (d.getDay() + 6) % 7;
  };

  const uuid = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  };

  const normalizeUrl = (input) => {
    const raw = String(input || "").trim();
    if (!raw) return "";
    try {
      return new URL(raw).toString();
    } catch {
      // 允许用户输入没带协议的域名（尽量兼容）
      try {
        return new URL("https://" + raw.replace(/^\/+/, "")).toString();
      } catch {
        return "";
      }
    }
  };

  const safeStorageAvailable = () => {
    try {
      const k = "__test__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  };

  const showToast = (message, ms = 2400) => {
    if (!els.toast) return;

    els.toast.textContent = message;
    els.toast.hidden = false;

    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      if (!els.toast) return;
      els.toast.hidden = true;
    }, ms);
  };

  const normalizeItem = (item) => {
    if (!item || typeof item !== "object") return null;

    const title = String(item.title || item.name || "").trim();
    const url = normalizeUrl(item.url || item.link || "");
    const remark = String(item.remark || item.note || item.desc || "").trim();

    if (!title) return null;

    return {
      id: String(item.id || "").trim() || uuid(),
      title,
      url, // 允许空：前端会给出校验提示（避免导入失败）
      remark,
    };
  };

  const validateAndNormalizeState = (obj) => {
    if (!obj || typeof obj !== "object") return null;

    const version = Number(obj.version) || 1;

    // 兼容不同形态：days 或 data.days 或 days: { "0": [...] }
    let daysRaw = obj.days;
    if (!daysRaw && obj.data && obj.data.days) daysRaw = obj.data.days;

    // daysRaw 可能是数组或对象
    let daysArr = null;

    if (Array.isArray(daysRaw)) {
      daysArr = daysRaw;
    } else if (daysRaw && typeof daysRaw === "object") {
      // 对象形态：{ "0": [...], "1": [...] }
      daysArr = Array.from({ length: 7 }, (_, i) => daysRaw[i] || []);
    }

    if (!daysArr || daysArr.length !== 7) return null;

    const days = daysArr.map((items) => {
      if (!Array.isArray(items)) return [];
      const normalized = items.map(normalizeItem).filter(Boolean);
      return normalized;
    });

    return { version, days };
  };

  const loadState = () => {
    const base = defaultState();

    if (!safeStorageAvailable()) {
      storageMode = "memory";
      if (memoryState) return memoryState;
      return base;
    }

    storageMode = "localStorage";

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return base;

      const parsed = JSON.parse(raw);
      const normalized = validateAndNormalizeState(parsed);
      return normalized || base;
    } catch {
      return base;
    }
  };

  const persistState = (state) => {
    try {
      if (storageMode === "memory") {
        memoryState = state;
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 写入失败不应导致页面不可用：直接降级到内存
      storageMode = "memory";
      memoryState = state;
      showToast("本地存储不可用，已改为内存模式（刷新可能丢失）。");
    }
  };

  const state = {
    currentDay: getTodayIndex(),
    data: defaultState(),
    editingId: null,
  };

  const initRefs = () => {
    els.dayTabs = document.getElementById("dayTabs");
    els.dayTitle = document.getElementById("dayTitle");
    els.dayHint = document.getElementById("dayHint");
    els.animeList = document.getElementById("animeList");
    els.emptyState = document.getElementById("emptyState");

    els.btnConfig = document.getElementById("btnConfig");
    els.btnExport = document.getElementById("btnExport");
    els.btnImportLabel = document.getElementById("btnImportLabel");
    els.fileImport = document.getElementById("fileImport");

    els.configModal = document.getElementById("configModal");
    els.modalOverlay = document.getElementById("modalOverlay");
    els.btnModalClose = document.getElementById("btnModalClose");
    els.btnModalDone = document.getElementById("btnModalDone");
    els.modalDayLabel = document.getElementById("modalDayLabel");

    els.inputTitle = document.getElementById("inputTitle");
    els.inputUrl = document.getElementById("inputUrl");
    els.inputRemark = document.getElementById("inputRemark");
    els.inputEditId = document.getElementById("inputEditId");
    els.animeForm = document.getElementById("animeForm");
    els.btnAddOrSave = document.getElementById("btnAddOrSave");
    els.btnResetForm = document.getElementById("btnResetForm");

    els.configList = document.getElementById("configList");

    els.toast = document.getElementById("toast");
    return true;
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  };

  const renderDayTabs = () => {
    if (!els.dayTabs) return;

    els.dayTabs.textContent = "";
    DAY_LABELS.forEach((label, idx) => {
      const btn = el("button", "day-tab", label);
      btn.type = "button";
      btn.dataset.dayIndex = String(idx);
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", idx === state.currentDay ? "true" : "false");
      if (idx === state.currentDay) btn.classList.add("is-active");
      els.dayTabs.appendChild(btn);
    });
  };

  const renderAnimeList = () => {
    if (!els.animeList) return;

    const items = state.data.days[state.currentDay] || [];
    els.dayTitle && (els.dayTitle.textContent = DAY_LABELS[state.currentDay] || "");
    if (els.dayHint) {
      els.dayHint.textContent = `共 ${items.length} 条 · 点击「动漫配置」管理记录`;
    }

    els.animeList.textContent = "";

    const frag = document.createDocumentFragment();

    if (items.length === 0) {
      if (els.emptyState) els.emptyState.hidden = false;
      els.animeList.appendChild(frag);
      return;
    }

    if (els.emptyState) els.emptyState.hidden = true;

    items.forEach((item) => {
      const card = el("div", "anime-card");

      const left = el("div", "anime-main");
      left.appendChild(el("div", "anime-title", item.title));

      if (item.remark) {
        left.appendChild(el("div", "anime-remark", item.remark));
      }

      const urlBadge = el("div", "anime-url-badge");
      const dot = el("span", "dot");
      const shortUrl = (() => {
        try {
          if (!item.url) return "未填写网址";
          const u = new URL(item.url);
          return `${u.host}${u.pathname}`;
        } catch {
          return item.url ? "网址已保存" : "未填写网址";
        }
      })();

      urlBadge.appendChild(dot);
      urlBadge.appendChild(el("span", "", shortUrl));
      left.appendChild(urlBadge);

      const right = el("div", "anime-actions");

      const openBtn = el("button", "btn btn-primary btn-sm", "打开");
      openBtn.type = "button";
      openBtn.dataset.action = "open";
      openBtn.dataset.id = item.id;
      openBtn.dataset.url = item.url || "";
      if (!item.url) openBtn.disabled = true;

      const editBtn = el("button", "btn btn-ghost btn-sm", "编辑");
      editBtn.type = "button";
      editBtn.dataset.action = "edit";
      editBtn.dataset.id = item.id;

      right.appendChild(openBtn);
      right.appendChild(editBtn);

      card.appendChild(left);
      card.appendChild(right);
      frag.appendChild(card);
    });

    els.animeList.appendChild(frag);
  };

  const openModal = (editingId = null) => {
    if (!els.configModal || !els.modalOverlay) return;

    state.editingId = editingId;
    els.modalDayLabel && (els.modalDayLabel.textContent = DAY_LABELS[state.currentDay] || "");

    // 回填/刷新
    fillFormForEditing();
    renderConfigList();

    els.modalOverlay.hidden = false;
    els.configModal.hidden = false;

    document.body.style.overflow = "hidden";
  };

  const closeModal = () => {
    if (!els.configModal || !els.modalOverlay) return;

    els.modalOverlay.hidden = true;
    els.configModal.hidden = true;

    document.body.style.overflow = "";

    state.editingId = null;
    els.inputEditId && (els.inputEditId.value = "");
    if (els.animeForm) els.animeForm.reset();
    if (els.btnAddOrSave) els.btnAddOrSave.textContent = "添加";
  };

  const fillFormForEditing = () => {
    if (!els.inputEditId || !els.inputTitle || !els.inputUrl || !els.inputRemark || !els.btnAddOrSave) return;

    if (!state.editingId) {
      els.inputEditId.value = "";
      els.btnAddOrSave.textContent = "添加";
      return;
    }

    const items = state.data.days[state.currentDay] || [];
    const target = items.find((x) => x.id === state.editingId);

    if (!target) {
      els.inputEditId.value = "";
      els.btnAddOrSave.textContent = "添加";
      return;
    }

    els.inputEditId.value = target.id;
    els.inputTitle.value = target.title || "";
    els.inputUrl.value = target.url || "";
    els.inputRemark.value = target.remark || "";
    els.btnAddOrSave.textContent = "保存修改";
  };

  const renderConfigList = () => {
    if (!els.configList) return;

    const items = state.data.days[state.currentDay] || [];
    els.configList.textContent = "";

    if (items.length === 0) {
      const empty = el("div", "empty");
      empty.style.marginTop = "6px";
      empty.innerHTML = `
        <div class="empty-title">该星期暂无记录</div>
        <div class="empty-desc">填写上方表单并点击「添加」即可。</div>
      `;
      els.configList.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    items.forEach((item) => {
      const node = el("div", "config-item");

      const left = el("div", "left");
      left.appendChild(el("div", "title", item.title || ""));
      const metaLines = [];

      if (item.remark) metaLines.push(item.remark);

      if (item.url) {
        try {
          const u = new URL(item.url);
          metaLines.push(`${u.host}${u.pathname}`);
        } catch {
          metaLines.push(item.url);
        }
      } else {
        metaLines.push("未填写网址");
      }

      const meta = el("div", "meta", metaLines.join(" · "));
      left.appendChild(meta);

      const right = el("div", "right");

      const editBtn = el("button", "btn btn-ghost btn-sm", "编辑");
      editBtn.type = "button";
      editBtn.dataset.action = "edit";
      editBtn.dataset.id = item.id;

      const delBtn = el("button", "btn btn-danger btn-sm", "删除");
      delBtn.type = "button";
      delBtn.dataset.action = "delete";
      delBtn.dataset.id = item.id;

      right.appendChild(editBtn);
      right.appendChild(delBtn);

      node.appendChild(left);
      node.appendChild(right);

      frag.appendChild(node);
    });

    els.configList.appendChild(frag);
  };

  const setCurrentDay = (idx) => {
    if (idx < 0 || idx > 6) return;
    state.currentDay = idx;
    renderDayTabs();
    renderAnimeList();
  };

  const handleExport = () => {
    try {
      const payload = JSON.stringify(state.data, null, 2);
      const blob = new Blob([payload], { type: "application/json;charset=utf-8" });

      const a = document.createElement("a");
      const d = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const name = `iyf_weekly_anime_calendar_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;

      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();

      showToast("导出成功！");
    } catch {
      showToast("导出失败，请稍后重试。");
    }
  };

  const handleImport = async (file) => {
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const normalized = validateAndNormalizeState(parsed);

      if (!normalized) {
        showToast("导入失败：数据格式不正确。");
        return;
      }

      const ok = window.confirm("导入将覆盖当前数据，是否继续？");
      if (!ok) return;

      state.data = normalized;
      persistState(state.data);

      renderDayTabs();
      renderAnimeList();
      showToast("导入成功！");
      closeModal();
    } catch {
      showToast("导入失败：无法读取或解析 JSON。");
    }
  };

  const initEventBindings = () => {
    if (els.dayTabs) {
      els.dayTabs.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-day-index]");
        if (!btn) return;
        const idx = Number(btn.dataset.dayIndex);
        setCurrentDay(idx);
      });
    }

    if (els.btnConfig) {
      els.btnConfig.addEventListener("click", () => openModal(null));
    }

    if (els.animeList) {
      els.animeList.addEventListener("click", (e) => {
        const target = e.target.closest("[data-action]");
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === "open") {
          const url = String(target.dataset.url || "");
          if (!url) {
            showToast("该条目未填写网址。");
            return;
          }
          window.open(url, "_blank", "noopener,noreferrer");
        }

        if (action === "edit") {
          openModal(id || null);
        }
      });
    }

    if (els.btnExport) {
      els.btnExport.addEventListener("click", handleExport);
    }

    if (els.fileImport) {
      els.fileImport.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        void handleImport(file);
        // 允许重复导入同一文件：清空 input
        if (els.fileImport) els.fileImport.value = "";
      });
    }

    if (els.btnModalClose) els.btnModalClose.addEventListener("click", closeModal);
    if (els.btnModalDone) els.btnModalDone.addEventListener("click", closeModal);

    if (els.modalOverlay) {
      els.modalOverlay.addEventListener("click", closeModal);
    }

    if (els.btnResetForm) {
      els.btnResetForm.addEventListener("click", () => {
        state.editingId = null;
        if (els.animeForm) els.animeForm.reset();
        if (els.inputEditId) els.inputEditId.value = "";
        if (els.btnAddOrSave) els.btnAddOrSave.textContent = "添加";
      });
    }

    // ESC 关闭（仅当弹窗打开时）
    document.addEventListener("keydown", (e) => {
      const isOpen = els.configModal && !els.configModal.hidden;
      if (!isOpen) return;
      if (e.key === "Escape") closeModal();
    });

    // 配置弹窗列表：编辑/删除
    if (els.configList) {
      els.configList.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn) return;

        const action = btn.dataset.action;
        const id = btn.dataset.id;

        if (action === "edit") {
          openModal(id);
          return;
        }

        if (action === "delete") {
          const items = state.data.days[state.currentDay] || [];
          const idx = items.findIndex((x) => x.id === id);
          if (idx === -1) return;

          const ok = window.confirm("确定删除该条目吗？");
          if (!ok) return;

          items.splice(idx, 1);
          state.data.days[state.currentDay] = items;
          persistState(state.data);
          renderConfigList();
          renderAnimeList();
          showToast("删除成功。");
          // 如果正在编辑它，就退出编辑状态
          if (state.editingId === id) {
            state.editingId = null;
            if (els.animeForm) els.animeForm.reset();
            if (els.inputEditId) els.inputEditId.value = "";
            if (els.btnAddOrSave) els.btnAddOrSave.textContent = "添加";
          }
          return;
        }
      });
    }

    // 表单提交：添加/保存修改
    if (els.animeForm) {
      els.animeForm.addEventListener("submit", (e) => {
        e.preventDefault();

        if (!els.inputTitle || !els.inputUrl || !els.inputRemark || !els.btnAddOrSave || !els.inputEditId) return;

        const title = String(els.inputTitle.value || "").trim();
        const rawUrl = String(els.inputUrl.value || "").trim();
        const remark = String(els.inputRemark.value || "").trim();

        if (!title) {
          showToast("请输入动漫名称。");
          return;
        }

        const url = normalizeUrl(rawUrl);
        if (!url) {
          showToast("网址格式不正确，请输入完整 URL（例如 https://...）。");
          return;
        }

        const items = state.data.days[state.currentDay] || [];
        const editId = String(els.inputEditId.value || "").trim();

        if (editId) {
          const idx = items.findIndex((x) => x.id === editId);
          if (idx === -1) {
            showToast("编辑目标不存在，请重试。");
            return;
          }

          items[idx] = {
            ...items[idx],
            title,
            url,
            remark,
          };

          state.data.days[state.currentDay] = items;
          persistState(state.data);

          renderConfigList();
          renderAnimeList();
          showToast("保存成功。");

          state.editingId = null;
          els.animeForm.reset();
          els.inputEditId.value = "";
          els.btnAddOrSave.textContent = "添加";
          return;
        }

        // 添加
        const newItem = { id: uuid(), title, url, remark };
        items.push(newItem);
        state.data.days[state.currentDay] = items;

        persistState(state.data);

        renderConfigList();
        renderAnimeList();
        showToast("添加成功。");

        els.animeForm.reset();
        els.btnAddOrSave.textContent = "添加";
      });
    }
  };

  const initSafe = () => {
    try {
      initRefs();
      state.data = loadState();

      // 标题副文案
      if (els.subtitle) {
        const now = new Date();
        const w = ["日", "一", "二", "三", "四", "五", "六"];
        const line1 = `今天是 ${w[now.getDay()]}星期`;
        const storageLine =
          storageMode === "localStorage" ? "数据保存在本地浏览器（localStorage）" : "本地存储不可用，使用内存模式";
        els.subtitle.textContent = `${line1} · ${storageLine}`;
      }

      renderDayTabs();
      renderAnimeList();

      initEventBindings();

      // GH Pages 预览时偶发渲染时序问题：做一次轻量刷新
      window.setTimeout(() => {
        renderDayTabs();
        renderAnimeList();
      }, 120);
    } catch (err) {
      // 容错：避免 JS 初始化失败导致页面失去交互
      // eslint-disable-next-line no-console
      console.error(err);
      if (els.toast) showToast("页面初始化失败：请刷新后重试。");
    }
  };

  document.addEventListener("DOMContentLoaded", initSafe);
})();

