(() => {
  'use strict';

  const BANK = window.CET4_BANK;
  const VOCAB_BASE = (window.CET4_VOCAB && Array.isArray(window.CET4_VOCAB.words)) ? window.CET4_VOCAB.words : [];
  const VOCAB_MORE = (window.CET4_VOCAB_MORE && Array.isArray(window.CET4_VOCAB_MORE.words))
    ? window.CET4_VOCAB_MORE.words
    : [];
  const VOCAB_EXTRA = window.CET4_VOCAB_EXTRA || {};
  const VOCAB_THIRD = window.CET4_VOCAB_THIRD || {};
  const COLLOCATIONS = (window.CET4_COLLOCATIONS && Array.isArray(window.CET4_COLLOCATIONS.items))
    ? window.CET4_COLLOCATIONS.items
    : [];
  const PHRASAL = (window.CET4_PHRASAL && Array.isArray(window.CET4_PHRASAL.items))
    ? window.CET4_PHRASAL.items
    : [];
  const CONFUSABLES = (window.CET4_CONFUSABLES && Array.isArray(window.CET4_CONFUSABLES.items))
    ? window.CET4_CONFUSABLES.items
    : [];
  VOCAB_BASE.forEach((entry) => {
    entry.examples = [{ collocation: entry.collocation, sentence: entry.sentence, zh: entry.zh }];
    if (VOCAB_EXTRA[entry.word]) entry.examples.push(VOCAB_EXTRA[entry.word]);
  });
  const VOCAB = [
    ...VOCAB_BASE,
    ...VOCAB_MORE.map((entry) => ({
      ...entry,
      collocation: entry.examples?.[0]?.collocation || '',
      sentence: entry.examples?.[0]?.sentence || '',
      zh: entry.examples?.[0]?.zh || ''
    }))
  ];
  VOCAB.forEach((entry) => {
    if (VOCAB_THIRD[entry.word]) entry.examples.push(VOCAB_THIRD[entry.word]);
  });
  const vocabById = new Map(VOCAB.map((word) => [word.id, word]));
  const view = document.getElementById('view');
  const modalRoot = document.getElementById('modal-root');
  const toastStack = document.getElementById('toast-stack');
  const STORAGE_KEY = 'cet4lab.state.v1';

  if (!BANK) {
    view.innerHTML = '<div class="empty"><h3>题库数据没有加载</h3><p>请确认 data.js 与 index.html 在同一个文件夹中。</p></div>';
    return;
  }

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const icon = (name, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;

  const nl2p = (text) => String(text || '')
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const dateFromKey = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const formatDate = (value) => {
    const d = value instanceof Date ? value : new Date(value);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const formatDateTime = (value) => {
    const d = value instanceof Date ? value : new Date(value);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatClock = (ms) => {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const countWords = (text) => (String(text || '').match(/[A-Za-z]+(?:['’-][A-Za-z]+)?/g) || []).length;

  const MODULES = {
    listening: {
      label: '听力理解', en: 'Listening', icon: 'volume', count: 22,
      accent: '#2f7d7a', soft: 'color-mix(in srgb, #2f7d7a 13%, var(--card))',
      blurb: '新闻、长对话与篇章。先做题，再核对原文。'
    },
    cloze: {
      label: '选词填空', en: 'Banked Cloze', icon: 'pen', count: 20,
      accent: '#b8842d', soft: 'color-mix(in srgb, #b8842d 14%, var(--card))',
      blurb: '从 15 个词中选出 10 个，训练搭配与语篇逻辑。'
    },
    matching: {
      label: '长篇阅读', en: 'Matching', icon: 'layers', count: 20,
      accent: '#506ba0', soft: 'color-mix(in srgb, #506ba0 13%, var(--card))',
      blurb: '把 10 个陈述定位到 A—G 段，练同义替换。'
    },
    careful: {
      label: '仔细阅读', en: 'Careful Reading', icon: 'eye', count: 20,
      accent: '#8c5a78', soft: 'color-mix(in srgb, #8c5a78 12%, var(--card))',
      blurb: '细节、推理、主旨与态度，逐题拆解定位依据。'
    },
    writing: {
      label: '写作', en: 'Writing', icon: 'pen', count: 2,
      accent: '#116466', soft: 'color-mix(in srgb, #116466 12%, var(--card))',
      blurb: '应用文与议论文，附范文、亮点表达与评分标准。'
    },
    translation: {
      label: '翻译', en: 'Translation', icon: 'languages', count: 2,
      accent: '#b8842d', soft: 'color-mix(in srgb, #b8842d 13%, var(--card))',
      blurb: '文化与社会经济主题，附参考译文与信息点提示。'
    }
  };

  const MODULE_ORDER = ['listening', 'cloze', 'matching', 'careful', 'writing', 'translation'];

  // ---------- state ----------

  const defaultState = () => ({
    version: 1,
    history: {},
    bookmarks: [],
    examAttempts: [],
    drafts: {},
    tasks: {},
    activity: {},
    vocab: { status: {}, bookmarks: [], quizHistory: [] },
    settings: { theme: 'light' }
  });

  let storageWorks = true;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      return {
        ...base,
        ...parsed,
        history: parsed.history && typeof parsed.history === 'object' ? parsed.history : {},
        bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
        examAttempts: Array.isArray(parsed.examAttempts) ? parsed.examAttempts : [],
        drafts: parsed.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {},
        tasks: parsed.tasks && typeof parsed.tasks === 'object' ? parsed.tasks : {},
        activity: parsed.activity && typeof parsed.activity === 'object' ? parsed.activity : {},
        vocab: {
          status: parsed.vocab && parsed.vocab.status && typeof parsed.vocab.status === 'object' ? parsed.vocab.status : {},
          bookmarks: parsed.vocab && Array.isArray(parsed.vocab.bookmarks) ? parsed.vocab.bookmarks : [],
          quizHistory: parsed.vocab && Array.isArray(parsed.vocab.quizHistory) ? parsed.vocab.quizHistory : []
        },
        settings: { ...base.settings, ...(parsed.settings || {}) }
      };
    } catch (error) {
      storageWorks = false;
      return defaultState();
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      if (storageWorks) {
        storageWorks = false;
        toast('浏览器禁止了本地存储，本次进度只在当前页面有效。', 'error');
      }
    }
  }

  let state = loadState();

  applyTheme(state.settings.theme || 'light');

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const use = $('#theme-toggle use');
    if (use) use.setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon');
  }

  // ---------- data index ----------

  const questionIndex = new Map();
  const allQuestions = [];

  function indexQuestion(q, group, module) {
    const item = { ...q, group, module };
    questionIndex.set(item.id, item);
    allQuestions.push(item);
    return item;
  }

  BANK.listening.forEach((group) => {
    group.questions.forEach((q) => indexQuestion(q, group, 'listening'));
  });

  BANK.cloze.forEach((group) => {
    Object.keys(group.answers).forEach((number) => {
      const exp = group.explanations[number];
      indexQuestion({
        id: `${group.id}-B${number}`,
        number: Number(number),
        stem: `选词填空第 ${number} 空`,
        answer: group.answers[number],
        skill: exp.meta,
        explanation: exp.text
      }, group, 'cloze');
    });
  });

  BANK.matching.forEach((group) => {
    group.statements.forEach((statement) => {
      indexQuestion({
        ...statement,
        module: 'matching',
        groupId: group.id
      }, group, 'matching');
    });
  });

  BANK.careful.forEach((group) => {
    group.questions.forEach((q) => indexQuestion(q, group, 'careful'));
  });

  allQuestions.sort((a, b) => a.number - b.number);

  const qById = (id) => questionIndex.get(id);

  function groupFor(module, groupId) {
    if (module === 'listening') return BANK.listening.find((g) => g.id === groupId);
    if (module === 'cloze') return BANK.cloze.find((g) => g.id === groupId);
    if (module === 'matching') return BANK.matching.find((g) => g.id === groupId);
    if (module === 'careful') return BANK.careful.find((g) => g.id === groupId);
    return null;
  }

  function questionsFor(module, group) {
    if (module === 'listening' || module === 'careful') return group.questions.map((q) => qById(q.id));
    if (module === 'cloze') return Object.keys(group.answers).map((n) => qById(`${group.id}-B${n}`));
    if (module === 'matching') return group.statements.map((s) => qById(s.id));
    return [];
  }

  function moduleQuestions(module) {
    return allQuestions.filter((q) => q.module === module);
  }

  function groupsForModule(module) {
    if (module === 'listening') return BANK.listening;
    if (module === 'cloze') return BANK.cloze;
    if (module === 'matching') return BANK.matching;
    if (module === 'careful') return BANK.careful;
    return [];
  }

  // ---------- progress ----------

  function getStats() {
    const entries = Object.entries(state.history).filter(([id]) => questionIndex.has(id));
    let attempts = 0;
    entries.forEach(([, h]) => {
      attempts += h.totalAttempts || h.attempts || 1;
    });
    const correct = entries.filter(([, h]) => h.correct).length;
    const wrong = entries.filter(([, h]) => !h.correct).length;
    return {
      attempted: entries.length,
      attempts,
      correct,
      wrong,
      accuracy: entries.length ? Math.round((correct / entries.length) * 100) : 0,
      total: allQuestions.length
    };
  }

  function moduleStats(module) {
    const list = moduleQuestions(module);
    const done = list.filter((q) => state.history[q.id]);
    const correct = done.filter((q) => state.history[q.id].correct).length;
    return {
      total: list.length,
      done: done.length,
      correct,
      wrong: done.length - correct,
      pct: list.length ? Math.round((done.length / list.length) * 100) : 0,
      accuracy: done.length ? Math.round((correct / done.length) * 100) : 0
    };
  }

  function todayCount() {
    return state.activity[todayKey()] || 0;
  }

  function streakCount() {
    let cursor = new Date();
    if (!state.activity[todayKey()]) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    for (let i = 0; i < 366; i += 1) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
      if (!state.activity[key]) break;
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }

  // ---------- vocabulary ----------

  function vocabStatus(id) {
    return state.vocab.status[id]?.status || 'new';
  }

  function vocabStats() {
    const statuses = Object.values(state.vocab.status);
    const known = statuses.filter((s) => s.status === 'known').length;
    const fuzzy = statuses.filter((s) => s.status === 'fuzzy').length;
    const difficult = statuses.filter((s) => s.status === 'difficult').length;
    const learned = known + fuzzy + difficult;
    return {
      total: VOCAB.length,
      known,
      fuzzy,
      difficult,
      learned,
      review: fuzzy + difficult,
      bookmarks: state.vocab.bookmarks.length,
      pct: VOCAB.length ? Math.round((learned / VOCAB.length) * 100) : 0
    };
  }

  function setVocabStatus(id, status) {
    if (!vocabById.has(id)) return;
    if (status === 'new') {
      delete state.vocab.status[id];
    } else {
      state.vocab.status[id] = { status, at: Date.now() };
    }
    saveState();
    updateShell();
  }

  function isVocabBookmarked(id) {
    return state.vocab.bookmarks.includes(id);
  }

  function toggleVocabBookmark(id) {
    if (!vocabById.has(id)) return;
    if (isVocabBookmarked(id)) {
      state.vocab.bookmarks = state.vocab.bookmarks.filter((item) => item !== id);
      toast('已从词汇收藏移除');
    } else {
      state.vocab.bookmarks = [id, ...state.vocab.bookmarks];
      toast('已收藏这个词');
    }
    saveState();
  }

  function dailyWord() {
    if (!VOCAB.length) return null;
    const start = new Date(new Date().getFullYear(), 0, 0);
    const day = Math.floor((Date.now() - start.getTime()) / 86400000);
    return VOCAB[day % VOCAB.length];
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightWord(sentence, word) {
    const safe = esc(sentence);
    const pattern = new RegExp(`\\b(${escapeRegExp(word)})(s|es|ed|d|ing|ly)?\\b`, 'gi');
    return safe.replace(pattern, '<mark>$1$2</mark>');
  }

  function vocabThemeList() {
    return ['全部', ...Array.from(new Set(VOCAB.map((w) => w.theme)))];
  }

  function recordAnswer(question, answer) {
    const q = typeof question === 'string' ? qById(question) : question;
    if (!q) return false;
    const ok = answer === q.answer;
    const previous = state.history[q.id] || { totalAttempts: 0, totalCorrect: 0 };
    const entry = {
      ...previous,
      attempts: (previous.totalAttempts || previous.attempts || 0) + 1,
      totalAttempts: (previous.totalAttempts || previous.attempts || 0) + 1,
      totalCorrect: (previous.totalCorrect || 0) + (ok ? 1 : 0),
      correct: ok,
      lastAnswer: answer,
      lastAt: Date.now(),
      module: q.module
    };
    state.history[q.id] = entry;
    const key = todayKey();
    state.activity[key] = (state.activity[key] || 0) + 1;
    saveState();
    updateShell();
    return ok;
  }

  function isBookmarked(id) {
    return state.bookmarks.includes(id);
  }

  function toggleBookmark(id) {
    if (isBookmarked(id)) {
      state.bookmarks = state.bookmarks.filter((item) => item !== id);
      toast('已从收藏夹移除');
    } else {
      state.bookmarks = [id, ...state.bookmarks];
      toast('已加入收藏夹');
    }
    saveState();
    updateShell();
    return isBookmarked(id);
  }

  function wrongQuestions() {
    return allQuestions.filter((q) => state.history[q.id] && !state.history[q.id].correct);
  }

  function bookmarkQuestions() {
    return state.bookmarks.map((id) => qById(id)).filter(Boolean);
  }

  // ---------- shell ----------

  function updateShell() {
    const stats = getStats();
    const wrong = wrongQuestions().length;
    const bookmarks = bookmarkQuestions().length;
    const pct = stats.total ? Math.round((stats.attempted / stats.total) * 100) : 0;
    const sideText = $('#side-progress-text');
    const sideBar = $('#side-progress-bar');
    const sideCaption = $('#side-progress-caption');
    if (sideText) sideText.textContent = `${pct}%`;
    if (sideBar) sideBar.style.width = `${pct}%`;
    if (sideCaption) {
      sideCaption.textContent = pct === 0
        ? '还没有开始，先做 10 道题热身。'
        : pct === 100
          ? '题库已全部完成，去模考检验一下。'
          : `已完成 ${stats.attempted} / ${stats.total} 题，保持节奏。`;
    }
    const wrongBadge = $('#nav-wrong-badge');
    if (wrongBadge) {
      wrongBadge.textContent = String(wrong);
      wrongBadge.hidden = wrong === 0;
    }
    const bookmarkBadge = $('#nav-bookmark-badge');
    if (bookmarkBadge) {
      bookmarkBadge.textContent = String(bookmarks);
      bookmarkBadge.hidden = bookmarks === 0;
    }
    const streak = $('#top-streak');
    if (streak) streak.textContent = String(streakCount());
    const vocabBadge = $('#nav-vocab-badge');
    if (vocabBadge) {
      vocabBadge.textContent = String(VOCAB.length);
      vocabBadge.hidden = VOCAB.length === 0;
    }
    const themeUse = $('#theme-toggle use');
    if (themeUse) themeUse.setAttribute('href', document.documentElement.dataset.theme === 'dark' ? '#i-sun' : '#i-moon');
  }

  function setActiveNav(route) {
    const root = route.split('/')[0];
    const navRoot = root === 'writing' || root === 'translation' ? 'practice' : root;
    $$('.nav a').forEach((a) => {
      const nav = a.dataset.nav;
      a.classList.toggle('active', nav === navRoot);
    });
    const labels = {
      home: '首页',
      practice: '专项练习',
      vocab: '四级词汇',
      exam: '模拟考试',
      wrong: '错题本',
      bookmarks: '收藏夹',
      stats: '学习数据',
      settings: '设置与备份',
      writing: '写作训练',
      translation: '翻译训练'
    };
    const crumb = $('#crumb');
    if (crumb) crumb.innerHTML = `<strong>${esc(labels[root] || '学习空间')}</strong>`;
  }

  function closeNav() {
    document.body.classList.remove('nav-open');
  }

  function toast(message, type = 'success') {
    if (!toastStack) return;
    const node = document.createElement('div');
    node.className = `toast ${type === 'error' ? 'error' : ''}`;
    node.innerHTML = `${icon(type === 'error' ? 'x' : 'check')}<span>${esc(message)}</span>`;
    toastStack.appendChild(node);
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transform = 'translateY(6px)';
      setTimeout(() => node.remove(), 250);
    }, 2600);
  }

  function showModal(html) {
    modalRoot.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
    modalRoot.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const first = modalRoot.querySelector('button, [href], input, select, textarea');
      if (first) first.focus();
    }, 20);
  }

  function closeModal() {
    modalRoot.classList.remove('open');
    modalRoot.innerHTML = '';
    document.body.style.overflow = '';
  }

  function confirmModal({ title, body, confirmText = '确认', danger = false, onConfirm }) {
    showModal(`
      <h2>${esc(title)}</h2>
      <p>${body}</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-action="close-modal">取消</button>
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm-modal">${esc(confirmText)}</button>
      </div>
    `);
    const btn = $('[data-action="confirm-modal"]');
    if (btn) {
      btn.onclick = () => {
        closeModal();
        if (onConfirm) onConfirm();
      };
    }
  }

  // ---------- shared UI ----------

  function moduleStyle(module) {
    const m = MODULES[module];
    return `--accent:${m.accent};--accent-soft:${m.soft}`;
  }

  function pageHead(title, subtitle, actions = '') {
    return `
      <div class="page-head">
        <div>
          <div class="eyebrow">CET-4 PRACTICE LAB</div>
          <h1 class="page-title">${esc(title)}</h1>
          <p class="page-subtitle">${subtitle}</p>
        </div>
        ${actions ? `<div class="page-head-actions">${actions}</div>` : ''}
      </div>
    `;
  }

  function emptyState(title, text, action = '') {
    return `
      <div class="empty">
        <div class="empty-icon">${icon('spark')}</div>
        <h3>${esc(title)}</h3>
        <p>${esc(text)}</p>
        ${action}
      </div>
    `;
  }

  function groupProgress(module, group) {
    const qs = questionsFor(module, group);
    const done = qs.filter((q) => state.history[q.id]).length;
    const correct = qs.filter((q) => state.history[q.id] && state.history[q.id].correct).length;
    return { qs, done, correct, pct: qs.length ? Math.round((done / qs.length) * 100) : 0 };
  }

  function moduleCard(module, compact = false) {
    const m = MODULES[module];
    const s = moduleStats(module);
    return `
      <a class="module-card" href="#/practice/${module}" style="${moduleStyle(module)}">
        <div class="module-top">
          <span class="module-icon">${icon(m.icon)}</span>
          <span class="chip ${module === 'cloze' || module === 'translation' ? 'gold' : ''}">${s.total} ${module === 'writing' || module === 'translation' ? '题' : '题'}</span>
        </div>
        <h3>${m.label}</h3>
        <p>${m.blurb}</p>
        <div class="module-progress"><i style="width:${s.pct}%"></i></div>
        <div class="module-foot">
          <span class="mini-count">${s.done}/${s.total} 已完成</span>
          <span class="module-arrow">${icon('arrow-right')}</span>
        </div>
      </a>
    `;
  }

  // ---------- home ----------

  function renderHome() {
    const stats = getStats();
    const attempts = state.examAttempts.slice().reverse().slice(0, 3);
    const tasks = [
      { name: '完成 10 道专项题', meta: `今天已完成 ${todayCount()} 道`, done: todayCount() >= 10, href: '#/practice' },
      { name: '收藏 3 道值得复盘的题', meta: `已收藏 ${bookmarkQuestions().length} 道`, done: bookmarkQuestions().length >= 3, href: '#/bookmarks' },
      { name: '完成一次客观题模考', meta: `${state.examAttempts.length} 次模考记录`, done: state.examAttempts.length > 0, href: '#/exam' }
    ];
    const ringPct = stats.total ? Math.round((stats.attempted / stats.total) * 100) : 0;
    const wordOfDay = dailyWord();
    const vocab = vocabStats();

    view.innerHTML = `
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow">ORIGINAL QUESTION BANK · 2026</div>
          <h1>把四级，练成<br><em>肌肉记忆。</em></h1>
          <p>一套原创模块化题库，配专项练习、即时解析、错题本和计时模考。每天 20 分钟，把“看懂”变成“做对”。</p>
          <div class="hero-actions">
            <a class="btn btn-gold" href="${stats.attempted ? '#/practice' : '#/practice/listening'}">${icon('play')} ${stats.attempted ? '继续练习' : '开始第一题'}</a>
            <a class="btn btn-ghost" href="#/exam">${icon('clock')} 进入模考</a>
          </div>
        </div>
        <div class="hero-side">
          <div class="ring" style="--pct:${ringPct}">
            <div class="ring-inner"><strong>${ringPct}%</strong><span>题库进度</span></div>
          </div>
          <div class="hero-side-note"><strong>${stats.attempted}</strong> / ${stats.total} 题已作答 · 正确率 <strong>${stats.accuracy}%</strong></div>
        </div>
      </section>

      <section class="quick-stats">
        <div class="stat-card">
          <div class="stat-label">${icon('target')} 已作答</div>
          <strong>${stats.attempted}</strong>
          <small>共 ${stats.total} 道客观题</small>
        </div>
        <div class="stat-card">
          <div class="stat-label">${icon('check')} 正确率</div>
          <strong>${stats.accuracy}%</strong>
          <small>按题目当前状态计算</small>
        </div>
        <div class="stat-card">
          <div class="stat-label">${icon('rotate')} 待复盘</div>
          <strong>${stats.wrong}</strong>
          <small>错题自动进入错题本</small>
        </div>
        <div class="stat-card">
          <div class="stat-label">${icon('spark')} 连续学习</div>
          <strong>${streakCount()}<span style="font-size:12px;font-weight:600"> 天</span></strong>
          <small>${todayCount() ? `今天已练 ${todayCount()} 题` : '今天还没有开始'}</small>
        </div>
      </section>

      ${wordOfDay ? `
        <section class="vocab-strip">
          <div class="vocab-strip-kicker">${icon('book')} WORD OF THE DAY</div>
          <div class="vocab-strip-word"><strong>${esc(wordOfDay.word)}</strong><span>${esc(wordOfDay.pos)}</span><em>${esc(wordOfDay.meaning)}</em></div>
          <div class="vocab-strip-sentence">${highlightWord(wordOfDay.sentence, wordOfDay.word)}</div>
          <div class="vocab-strip-meta">
            <span class="chip">${esc(wordOfDay.collocation)}</span>
            <span class="small muted">已学 ${vocab.learned}/${vocab.total} · 掌握 ${vocab.known}</span>
            <button class="btn btn-ghost btn-sm" data-action="speak-word" data-word="${esc(wordOfDay.word)}">${icon('volume')} 发音</button>
            <a class="btn btn-soft btn-sm" href="#/vocab">进入词汇库 ${icon('arrow-right')}</a>
          </div>
        </section>
      ` : ''}

      <div class="section-head">
        <div><h2>按题型突破</h2><p>先做专项，再进模考；每道题都有定位依据和干扰项分析。</p></div>
        <a class="section-link" href="#/practice">全部模块 ${icon('arrow-right')}</a>
      </div>
      <section class="module-grid">
        ${['listening', 'cloze', 'matching', 'careful'].map((m) => moduleCard(m)).join('')}
      </section>

      <div class="dashboard-lower">
        <section class="panel">
          <div class="panel-head"><h3>今日小目标</h3><span>${formatDate(new Date())}</span></div>
          <div class="task-list">
            ${tasks.map((t) => `
              <a class="task-row ${t.done ? 'done' : ''}" href="${t.href}">
                <span class="task-check">${icon('check')}</span>
                <span class="task-copy"><span class="task-name">${esc(t.name)}</span><span class="task-meta">${esc(t.meta)}</span></span>
                <span class="task-link">${t.done ? '已完成' : '去完成'}</span>
              </a>
            `).join('')}
          </div>
        </section>

        <section class="panel">
          <div class="panel-head"><h3>最近模考</h3><a class="section-link" href="#/stats">全部记录</a></div>
          <div class="exam-mini-list">
            ${attempts.length ? attempts.map((a) => `
              <a class="exam-mini-row" href="#/exam/result/${a.id}">
                <span class="exam-mini-date">${formatDate(a.date)}<br>${new Date(a.date).getFullYear()}</span>
                <span class="exam-mini-main"><strong>客观题模考</strong><span>${a.byModule ? Object.keys(a.byModule).length : 0} 个模块 · ${Math.round((a.duration || 0) / 60000)} 分钟</span></span>
                <span class="exam-mini-score">${a.score}<small style="font-size:10px;color:var(--faint)">/82</small></span>
              </a>
            `).join('') : '<div class="empty-mini">还没有模考记录。准备好后，用 90 分钟检验一次。</div>'}
          </div>
        </section>
      </div>

      <div class="dashboard-lower" style="grid-template-columns:1fr 1fr 1fr">
        ${['writing', 'translation'].map((m) => `
          <section class="panel">
            <div class="panel-head"><h3>${MODULES[m].label}</h3><span class="chip ${m === 'translation' ? 'gold' : ''}">输出训练</span></div>
            <p class="small muted" style="margin:0 0 14px">${MODULES[m].blurb}</p>
            <a class="btn btn-ghost btn-sm" href="#/${m}">进入训练 ${icon('arrow-right')}</a>
          </section>
        `).join('')}
        <section class="quote-card">
          <div class="eyebrow">TODAY'S NOTE</div>
          <blockquote>“先看懂，<br>再做对。”</blockquote>
          <p>每道错题都值得一次慢速复盘：定位、同义替换、干扰项。</p>
        </section>
      </div>
    `;
    updateShell();
  }

  // ---------- practice hub ----------

  function renderPracticeHub() {
    view.innerHTML = `
      ${pageHead('专项练习', '按题型拆开练。每道题作答后立即看到答案、考点与解析；错题会自动进入错题本。', `<a class="btn btn-ghost" href="#/wrong">${icon('rotate')} 错题本</a>`)}
      <section class="practice-grid">
        ${['listening', 'cloze', 'matching', 'careful'].map((m) => {
          const s = moduleStats(m);
          return `
            <article class="practice-card" style="${moduleStyle(m)}">
              <span class="module-icon">${icon(MODULES[m].icon)}</span>
              <h3>${MODULES[m].label}</h3>
              <span class="en">${MODULES[m].en}</span>
              <p>${MODULES[m].blurb}</p>
              <div class="module-progress"><i style="width:${s.pct}%"></i></div>
              <div class="card-foot">
                <span>${s.done}/${s.total} 已完成 · 正确率 ${s.accuracy}%</span>
                <a class="btn btn-soft btn-sm" href="#/practice/${m}">${s.done ? '继续' : '开始'} ${icon('arrow-right')}</a>
              </div>
            </article>
          `;
        }).join('')}
        <article class="practice-card" style="${moduleStyle('writing')}">
          <span class="module-icon">${icon('pen')}</span>
          <h3>写作</h3>
          <span class="en">Writing</span>
          <p>应用文与议论文各一篇，附参考范文、亮点表达和 15 分制评分标准。</p>
          <div class="module-progress"><i style="width:${state.tasks.W1 && state.tasks.W2 ? 100 : state.tasks.W1 || state.tasks.W2 ? 50 : 0}%"></i></div>
          <div class="card-foot"><span>2 篇写作任务</span><a class="btn btn-soft btn-sm" href="#/writing">进入 ${icon('arrow-right')}</a></div>
        </article>
        <article class="practice-card" style="${moduleStyle('translation')}">
          <span class="module-icon">${icon('languages')}</span>
          <h3>翻译</h3>
          <span class="en">Translation</span>
          <p>文化、经济与科技主题，附参考译文、难点表达和评分标准。</p>
          <div class="module-progress"><i style="width:${state.tasks.T1 && state.tasks.T2 ? 100 : state.tasks.T1 || state.tasks.T2 ? 50 : 0}%"></i></div>
          <div class="card-foot"><span>2 段翻译任务</span><a class="btn btn-soft btn-sm" href="#/translation">进入 ${icon('arrow-right')}</a></div>
        </article>
      </section>
    `;
  }

  // ---------- vocabulary library ----------

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function vocabFiltered() {
    const query = ui.vocab.query.trim().toLowerCase();
    return VOCAB.filter((entry) => {
      if (ui.vocab.theme !== '全部' && entry.theme !== ui.vocab.theme) return false;
      const status = vocabStatus(entry.id);
      if (ui.vocab.status === 'new' && status !== 'new') return false;
      if (ui.vocab.status === 'learned' && status === 'new') return false;
      if (ui.vocab.status === 'tough' && !['fuzzy', 'difficult'].includes(status)) return false;
      if (ui.vocab.status === 'bookmarked' && !isVocabBookmarked(entry.id)) return false;
      if (!query) return true;
      return [entry.word, entry.meaning, entry.collocation, entry.sentence, entry.zh, entry.theme]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }

  function vocabStatusLabel(status) {
    return { known: '认识', fuzzy: '模糊', difficult: '不认识', new: '未学' }[status] || '未学';
  }

  function vocabCardHTML(entry) {
    const status = vocabStatus(entry.id);
    const exampleIndex = (ui.vocabExample[entry.id] || 0) % entry.examples.length;
    const example = entry.examples[exampleIndex];
    return `
      <article class="vocab-card" data-word-id="${entry.id}">
        <div class="vocab-card-top">
          <span class="vocab-theme">${esc(entry.theme)}</span>
          <button class="icon-btn vocab-bookmark ${isVocabBookmarked(entry.id) ? 'active' : ''}" data-action="vocab-bookmark" data-id="${entry.id}" title="${isVocabBookmarked(entry.id) ? '取消收藏' : '收藏'}">${icon('bookmark')}</button>
        </div>
        <div class="vocab-word-row">
          <h3>${esc(entry.word)}</h3>
          <span class="vocab-pos">${esc(entry.pos)}</span>
          <button class="icon-btn vocab-speak" data-action="speak-word" data-word="${esc(entry.word)}" title="发音">${icon('volume')}</button>
        </div>
        <p class="vocab-meaning">${esc(entry.meaning)}</p>
        <div class="vocab-collocation"><span>搭配</span><b>${esc(example.collocation)}</b>${entry.examples.length > 1 ? `<button class="vocab-example-btn" data-action="vocab-example" data-id="${entry.id}" title="换一句">${icon('refresh')}</button>` : ''}</div>
        <p class="vocab-sentence">${highlightWord(example.sentence, entry.word)}</p>
        <p class="vocab-zh">${esc(example.zh)}</p>
        <div class="vocab-card-foot">
          <span class="vocab-status-label ${status}">${vocabStatusLabel(status)}</span>
          <div class="vocab-rates">
            <button class="rate-btn known ${status === 'known' ? 'active' : ''}" data-action="vocab-status" data-id="${entry.id}" data-status="known" title="认识">${icon('check')}</button>
            <button class="rate-btn fuzzy ${status === 'fuzzy' ? 'active' : ''}" data-action="vocab-status" data-id="${entry.id}" data-status="fuzzy" title="模糊">?</button>
            <button class="rate-btn difficult ${status === 'difficult' ? 'active' : ''}" data-action="vocab-status" data-id="${entry.id}" data-status="difficult" title="不认识">${icon('x')}</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderVocab() {
    if (!VOCAB.length) {
      view.innerHTML = pageHead('四级词汇', '词汇数据没有加载。') + emptyState('词汇库为空', '请确认 vocab.js 与 index.html 在同一目录。');
      return;
    }
    const stats = vocabStats();
    const filtered = vocabFiltered();
    const pageSize = 12;
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    ui.vocab.page = Math.min(Math.max(1, ui.vocab.page), pages);
    const pageItems = filtered.slice((ui.vocab.page - 1) * pageSize, ui.vocab.page * pageSize);
    const statusOptions = [
      ['all', '全部'],
      ['new', '未学'],
      ['learned', '已学'],
      ['tough', '待复习'],
      ['bookmarked', '已收藏']
    ];

    view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="eyebrow">CET-4 VOCABULARY · 400 WORDS · 900 EXAMPLES</div>
          <h1 class="page-title">四级词汇</h1>
          <p class="page-subtitle">400 个高频核心词，每个词两组搭配、两句四级语境例句。用闪卡过一遍，再用测验检查记忆。</p>
        </div>
        <div class="page-head-actions">
          <button class="btn btn-ghost" data-action="start-quiz">${icon('list')} 词汇测验</button>
          <button class="btn btn-primary" data-action="start-flash">${icon('play')} 开始闪卡</button>
        </div>
      </div>

      <section class="vocab-summary">
        <div class="vocab-summary-card"><span>总词数</span><strong>${stats.total}</strong><small>12 个主题 · 900 句例句</small></div>
        <div class="vocab-summary-card"><span>已学</span><strong>${stats.learned}</strong><small>${stats.pct}% 词库进度</small></div>
        <div class="vocab-summary-card"><span>掌握</span><strong>${stats.known}</strong><small>看到能反应出释义</small></div>
        <div class="vocab-summary-card"><span>待复习</span><strong>${stats.review}</strong><small>模糊 ${stats.fuzzy} · 不认识 ${stats.difficult}</small></div>
      </section>

      <section class="vocab-tools">
        <a class="vocab-tool" href="#/vocab/collocations">
          <span class="vocab-tool-icon gold">${icon('layers')}</span>
          <span class="vocab-tool-copy"><strong>高频固定搭配</strong><em>100 个 · 按结构分类</em><small>动词 + 介词 / be + 形容词 / 介词短语</small></span>
          <span class="vocab-tool-arrow">${icon('arrow-right')}</span>
        </a>
        <a class="vocab-tool" href="#/vocab/phrasal">
          <span class="vocab-tool-icon teal">${icon('play')}</span>
          <span class="vocab-tool-copy"><strong>短语动词</strong><em>80 个 · 阅读高频</em><small>break down / carry out / turn out…</small></span>
          <span class="vocab-tool-arrow">${icon('arrow-right')}</span>
        </a>
        <a class="vocab-tool" href="#/vocab/confusable">
          <span class="vocab-tool-icon purple">${icon('target')}</span>
          <span class="vocab-tool-copy"><strong>易混词辨析</strong><em>40 组 · 一次分清</em><small>affect / effect · adapt / adopt…</small></span>
          <span class="vocab-tool-arrow">${icon('arrow-right')}</span>
        </a>
      </section>

      <section class="vocab-toolbar card">
        <div class="vocab-search">${icon('target')}<input id="vocab-search" type="search" value="${esc(ui.vocab.query)}" placeholder="搜索单词、释义、搭配或例句..." autocomplete="off"></div>
        <select id="vocab-theme" class="vocab-select" aria-label="按主题筛选">
          ${vocabThemeList().map((theme) => `<option value="${esc(theme)}" ${theme === ui.vocab.theme ? 'selected' : ''}>${theme === '全部' ? '全部主题' : theme}</option>`).join('')}
        </select>
        <div class="segmented vocab-status-tabs">
          ${statusOptions.map(([key, label]) => `<button class="${ui.vocab.status === key ? 'active' : ''}" data-action="vocab-status-filter" data-status="${key}">${label}</button>`).join('')}
        </div>
        <button class="icon-btn" data-action="vocab-reset" title="重置筛选">${icon('refresh')}</button>
      </section>

      <div class="vocab-list-head">
        <span>${filtered.length} 个词</span>
        <span>第 ${ui.vocab.page} / ${pages} 页</span>
      </div>
      ${pageItems.length ? `<section class="vocab-grid">${pageItems.map(vocabCardHTML).join('')}</section>` : emptyState('没有找到匹配的词', '试试清空搜索词或切换主题/状态筛选。')}
      ${pages > 1 ? `
        <div class="vocab-pagination">
          <button class="btn btn-ghost btn-sm" data-action="vocab-page" data-page="${ui.vocab.page - 1}" ${ui.vocab.page <= 1 ? 'disabled' : ''}>${icon('arrow-left')} 上一页</button>
          <span>${ui.vocab.page} / ${pages}</span>
          <button class="btn btn-ghost btn-sm" data-action="vocab-page" data-page="${ui.vocab.page + 1}" ${ui.vocab.page >= pages ? 'disabled' : ''}>下一页 ${icon('arrow-right')}</button>
        </div>
      ` : ''}
    `;
  }

  function collocTypes() {
    return ['全部', ...Array.from(new Set(COLLOCATIONS.map((item) => item.type)))];
  }

  function collocFiltered() {
    const query = ui.colloc.query.trim().toLowerCase();
    return COLLOCATIONS.filter((item) => {
      if (ui.colloc.type !== '全部' && item.type !== ui.colloc.type) return false;
      if (!query) return true;
      return [item.phrase, item.type, item.meaning, item.example, item.zh].join(' ').toLowerCase().includes(query);
    });
  }

  function renderCollocations() {
    if (!COLLOCATIONS.length) {
      view.innerHTML = pageHead('高频固定搭配', '搭配数据没有加载。') + emptyState('搭配库为空', '请确认 collocations.js 与 index.html 在同一目录。');
      return;
    }
    const filtered = collocFiltered();
    const pageSize = 12;
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    ui.colloc.page = Math.min(Math.max(1, ui.colloc.page), pages);
    const items = filtered.slice((ui.colloc.page - 1) * pageSize, ui.colloc.page * pageSize);
    view.innerHTML = `
      <div class="page-head">
        <div><div class="eyebrow">CET-4 COLLOCATIONS · 100 PHRASES</div><h1 class="page-title">高频固定搭配</h1><p class="page-subtitle">阅读里认得出、写作里用得上。先看搭配和释义，再读例句体会用法。</p></div>
        <div class="page-head-actions"><a class="btn btn-ghost" href="#/vocab">${icon('arrow-left')} 返回词汇</a><button class="btn btn-primary" data-action="start-colloc-flash">${icon('play')} 搭配闪卡</button></div>
      </div>
      <div class="colloc-summary">
        <div><strong>${COLLOCATIONS.length}</strong><span>个固定搭配</span></div>
        <div><strong>${collocTypes().length - 1}</strong><span>种结构类型</span></div>
        <div><strong>${COLLOCATIONS.length}</strong><span>句原创例句</span></div>
      </div>
      <section class="vocab-toolbar card">
        <div class="vocab-search">${icon('target')}<input id="colloc-search" type="search" value="${esc(ui.colloc.query)}" placeholder="搜索搭配、释义或例句..." autocomplete="off"></div>
        <select id="colloc-type" class="vocab-select" aria-label="按搭配类型筛选">
          ${collocTypes().map((type) => `<option value="${esc(type)}" ${type === ui.colloc.type ? 'selected' : ''}>${type === '全部' ? '全部类型' : type}</option>`).join('')}
        </select>
        <button class="icon-btn" data-action="colloc-reset" title="重置筛选">${icon('refresh')}</button>
      </section>
      <div class="vocab-list-head"><span>${filtered.length} 个搭配</span><span>第 ${ui.colloc.page} / ${pages} 页</span></div>
      ${items.length ? `<section class="colloc-grid">${items.map((item) => `
        <article class="colloc-card">
          <div class="colloc-card-top"><span class="chip">${esc(item.type)}</span><span class="colloc-num">${item.id.replace('c', '')}</span></div>
          <h3>${esc(item.phrase)}</h3>
          <p class="colloc-meaning">${esc(item.meaning)}</p>
          <p class="colloc-example">${esc(item.example)}</p>
          <p class="colloc-zh">${esc(item.zh)}</p>
        </article>
      `).join('')}</section>` : emptyState('没有找到匹配的搭配', '试试清空搜索词或切换类型。')}
      ${pages > 1 ? `<div class="vocab-pagination"><button class="btn btn-ghost btn-sm" data-action="colloc-page" data-page="${ui.colloc.page - 1}" ${ui.colloc.page <= 1 ? 'disabled' : ''}>${icon('arrow-left')} 上一页</button><span>${ui.colloc.page} / ${pages}</span><button class="btn btn-ghost btn-sm" data-action="colloc-page" data-page="${ui.colloc.page + 1}" ${ui.colloc.page >= pages ? 'disabled' : ''}>下一页 ${icon('arrow-right')}</button></div>` : ''}
    `;
  }

  function phrasalTypes() {
    return ['全部', ...Array.from(new Set(PHRASAL.map((item) => item.type)))];
  }

  function phrasalFiltered() {
    const query = ui.phrasal.query.trim().toLowerCase();
    return PHRASAL.filter((item) => {
      if (ui.phrasal.type !== '全部' && item.type !== ui.phrasal.type) return false;
      if (!query) return true;
      return [item.phrase, item.meaning, item.example, item.zh, item.type].join(' ').toLowerCase().includes(query);
    });
  }

  function renderPhrasal() {
    const filtered = phrasalFiltered();
    const pageSize = 12;
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    ui.phrasal.page = Math.min(Math.max(1, ui.phrasal.page), pages);
    const items = filtered.slice((ui.phrasal.page - 1) * pageSize, ui.phrasal.page * pageSize);
    view.innerHTML = `
      <div class="page-head">
        <div><div class="eyebrow">CET-4 PHRASAL VERBS · 80 ITEMS</div><h1 class="page-title">短语动词</h1><p class="page-subtitle">阅读中常被“动词 + 副词/介词”卡住。按类型刷一遍，再回到文章里认它们。</p></div>
        <div class="page-head-actions"><a class="btn btn-ghost" href="#/vocab">${icon('arrow-left')} 返回词汇</a><a class="btn btn-ghost" href="#/vocab/collocations">${icon('layers')} 固定搭配</a></div>
      </div>
      <div class="colloc-summary">
        <div><strong>${PHRASAL.length}</strong><span>个短语动词</span></div>
        <div><strong>${phrasalTypes().length - 1}</strong><span>种结构</span></div>
        <div><strong>${PHRASAL.length}</strong><span>句原创例句</span></div>
      </div>
      <section class="vocab-toolbar card">
        <div class="vocab-search">${icon('target')}<input id="phrasal-search" type="search" value="${esc(ui.phrasal.query)}" placeholder="搜索短语、释义或例句..." autocomplete="off"></div>
        <select id="phrasal-type" class="vocab-select" aria-label="按结构筛选">
          ${phrasalTypes().map((type) => `<option value="${esc(type)}" ${type === ui.phrasal.type ? 'selected' : ''}>${type === '全部' ? '全部结构' : type}</option>`).join('')}
        </select>
        <button class="icon-btn" data-action="phrasal-reset" title="重置筛选">${icon('refresh')}</button>
      </section>
      <div class="vocab-list-head"><span>${filtered.length} 个短语</span><span>第 ${ui.phrasal.page} / ${pages} 页</span></div>
      ${items.length ? `<section class="colloc-grid">${items.map((item) => `
        <article class="colloc-card phrasal-card">
          <div class="colloc-card-top"><span class="chip">${esc(item.type)}</span><span class="colloc-num">${item.id.replace('p', '')}</span></div>
          <h3>${esc(item.phrase)}</h3>
          <p class="colloc-meaning">${esc(item.meaning)}</p>
          <p class="colloc-example">${esc(item.example)}</p>
          <p class="colloc-zh">${esc(item.zh)}</p>
        </article>
      `).join('')}</section>` : emptyState('没有找到匹配的短语', '试试清空搜索词或切换结构。')}
      ${pages > 1 ? `<div class="vocab-pagination"><button class="btn btn-ghost btn-sm" data-action="phrasal-page" data-page="${ui.phrasal.page - 1}" ${ui.phrasal.page <= 1 ? 'disabled' : ''}>${icon('arrow-left')} 上一页</button><span>${ui.phrasal.page} / ${pages}</span><button class="btn btn-ghost btn-sm" data-action="phrasal-page" data-page="${ui.phrasal.page + 1}" ${ui.phrasal.page >= pages ? 'disabled' : ''}>下一页 ${icon('arrow-right')}</button></div>` : ''}
    `;
  }

  function confusableFiltered() {
    const query = ui.confusable.query.trim().toLowerCase();
    return CONFUSABLES.filter((item) => !query || [item.a.word, item.b.word, item.a.meaning, item.b.meaning, item.difference, item.tip].join(' ').toLowerCase().includes(query));
  }

  function renderConfusables() {
    const filtered = confusableFiltered();
    const pageSize = 8;
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    ui.confusable.page = Math.min(Math.max(1, ui.confusable.page), pages);
    const items = filtered.slice((ui.confusable.page - 1) * pageSize, ui.confusable.page * pageSize);
    view.innerHTML = `
      <div class="page-head">
        <div><div class="eyebrow">CET-4 CONFUSABLES · 40 PAIRS</div><h1 class="page-title">易混词辨析</h1><p class="page-subtitle">长得像、意思近，考试里最容易混。每组给出区别、例句和记忆提示。</p></div>
        <div class="page-head-actions"><a class="btn btn-ghost" href="#/vocab">${icon('arrow-left')} 返回词汇</a><a class="btn btn-ghost" href="#/vocab/phrasal">${icon('play')} 短语动词</a></div>
      </div>
      <section class="vocab-toolbar card">
        <div class="vocab-search">${icon('target')}<input id="confusable-search" type="search" value="${esc(ui.confusable.query)}" placeholder="搜索单词或区别，如 affect / effect..." autocomplete="off"></div>
        <button class="icon-btn" data-action="confusable-reset" title="重置搜索">${icon('refresh')}</button>
      </section>
      <div class="vocab-list-head"><span>${filtered.length} 组词</span><span>第 ${ui.confusable.page} / ${pages} 页</span></div>
      ${items.length ? `<section class="confuse-grid">${items.map((item) => `
        <article class="confuse-card">
          <div class="confuse-pair">
            <div class="confuse-side"><span class="confuse-tag">A</span><strong>${esc(item.a.word)}</strong><em>${esc(item.a.pos)} · ${esc(item.a.meaning)}</em><p>${esc(item.a.example)}</p><small>${esc(item.a.zh)}</small></div>
            <div class="confuse-vs">VS</div>
            <div class="confuse-side"><span class="confuse-tag">B</span><strong>${esc(item.b.word)}</strong><em>${esc(item.b.pos)} · ${esc(item.b.meaning)}</em><p>${esc(item.b.example)}</p><small>${esc(item.b.zh)}</small></div>
          </div>
          <div class="confuse-difference"><b>区别</b>${esc(item.difference)}</div>
          <div class="confuse-tip"><b>记忆</b>${esc(item.tip)}</div>
        </article>
      `).join('')}</section>` : emptyState('没有找到匹配的词组', '试试输入其中一个单词，或清空搜索。')}
      ${pages > 1 ? `<div class="vocab-pagination"><button class="btn btn-ghost btn-sm" data-action="confusable-page" data-page="${ui.confusable.page - 1}" ${ui.confusable.page <= 1 ? 'disabled' : ''}>${icon('arrow-left')} 上一页</button><span>${ui.confusable.page} / ${pages}</span><button class="btn btn-ghost btn-sm" data-action="confusable-page" data-page="${ui.confusable.page + 1}" ${ui.confusable.page >= pages ? 'disabled' : ''}>下一页 ${icon('arrow-right')}</button></div>` : ''}
    `;
  }

  function initCollocFlash() {
    ui.cflash = { queue: shuffle(COLLOCATIONS).map((item) => item.id), index: 0, revealed: false };
  }

  function renderCollocFlash() {
    if (!COLLOCATIONS.length) return renderCollocations();
    if (!ui.cflash) initCollocFlash();
    const f = ui.cflash;
    if (f.index >= f.queue.length) {
      view.innerHTML = `<div class="page-head"><div><div class="eyebrow">COLLOCATIONS · FLASHCARDS</div><h1 class="page-title">搭配闪卡完成</h1><p class="page-subtitle">100 个搭配过完一轮。可以回到列表，按类型再刷一遍。</p></div><div class="page-head-actions"><a class="btn btn-ghost" href="#/vocab/collocations">${icon('arrow-left')} 返回搭配</a></div></div>
        <section class="flash-finish card"><div class="flash-finish-ring"><strong>100</strong><span>搭配</span></div><div class="flash-finish-copy"><h2>这一轮完成了。</h2><p>把不熟悉的搭配抄进写作素材本，下次写作主动用一次。</p><div class="result-actions"><button class="btn btn-primary" data-action="colloc-flash-restart">${icon('refresh')} 再来一轮</button><a class="btn btn-ghost" href="#/vocab/collocations">回到搭配列表</a></div></div></section>`;
      return;
    }
    const item = COLLOCATIONS.find((x) => x.id === f.queue[f.index]);
    view.innerHTML = `
      <div class="page-head" style="margin-bottom:14px"><div><div class="eyebrow">COLLOCATIONS · FLASHCARDS</div><h1 class="page-title" style="font-size:25px">搭配闪卡</h1><p class="page-subtitle">先看搭配，想它的意思和用法；再翻面看例句。</p></div><div class="page-head-actions"><a class="btn btn-ghost" href="#/vocab/collocations">${icon('arrow-left')} 返回搭配</a></div></div>
      <div class="flash-progress"><span>${f.index + 1} / ${f.queue.length}</span><div class="progress-track"><i style="width:${(f.index / f.queue.length) * 100}%"></i></div></div>
      <section class="flash-card colloc-flash-card ${f.revealed ? 'revealed' : ''}">
        <div class="flash-card-top"><span class="chip">${esc(item.type)}</span><span class="small muted">固定搭配</span></div>
        <div class="colloc-flash-phrase">${esc(item.phrase)}</div>
        ${f.revealed ? `<div class="flash-answer"><div class="flash-meaning">${esc(item.meaning)}</div><p class="flash-sentence">${esc(item.example)}</p><p class="flash-zh">${esc(item.zh)}</p></div><div class="flash-actions"><button class="btn flash-rate difficult" data-action="colloc-prev">${icon('arrow-left')} 上一个</button><button class="btn flash-rate known" data-action="colloc-next">下一个 ${icon('arrow-right')}</button></div>` : `<button class="btn btn-primary flash-reveal" data-action="colloc-reveal">显示答案 ${icon('eye')}</button><p class="flash-hint">先在心里造一个句子，再翻面。</p>`}
      </section>
    `;
  }

  function initFlash() {
    let pool = VOCAB.filter((entry) => ['new', 'fuzzy', 'difficult'].includes(vocabStatus(entry.id)));
    if (!pool.length) pool = VOCAB.slice();
    const queue = shuffle(pool).map((entry) => entry.id);
    ui.flash = { queue, index: 0, revealed: false, exampleIndex: 0, ratings: { known: 0, fuzzy: 0, difficult: 0 } };
  }

  function renderFlashcards() {
    if (!ui.flash) initFlash();
    const f = ui.flash;
    if (f.index >= f.queue.length) {
      const total = f.ratings.known + f.ratings.fuzzy + f.ratings.difficult;
      view.innerHTML = `
        <div class="page-head" style="margin-bottom:18px">
          <div><div class="eyebrow">VOCABULARY · FLASHCARDS</div><h1 class="page-title">这一轮完成</h1><p class="page-subtitle">把“模糊”和“不认识”的词再刷一轮，比从头背更有效。</p></div>
          <div class="page-head-actions"><a class="btn btn-ghost" href="#/vocab">${icon('arrow-left')} 返回词库</a></div>
        </div>
        <section class="flash-finish card">
          <div class="flash-finish-ring"><strong>${f.ratings.known}</strong><span>认识</span></div>
          <div class="flash-finish-copy">
            <h2>${total ? '记忆有了新进度。' : '这一轮没有评分。'}</h2>
            <p>本组共 ${total} 个词：认识 ${f.ratings.known} · 模糊 ${f.ratings.fuzzy} · 不认识 ${f.ratings.difficult}。</p>
            <div class="result-actions">
              <button class="btn btn-primary" data-action="flash-restart">${icon('refresh')} 再来一轮</button>
              <a class="btn btn-ghost" href="#/vocab">回到词库</a>
              <button class="btn btn-ghost" data-action="start-quiz">${icon('list')} 做词汇测验</button>
            </div>
          </div>
        </section>
      `;
      return;
    }
    const entry = vocabById.get(f.queue[f.index]);
    const exampleIndex = (f.exampleIndex || 0) % entry.examples.length;
    const example = entry.examples[exampleIndex];
    const progress = Math.round((f.index / f.queue.length) * 100);
    view.innerHTML = `
      <div class="page-head" style="margin-bottom:14px">
        <div><div class="eyebrow">VOCABULARY · FLASHCARDS</div><h1 class="page-title" style="font-size:25px">闪卡记忆</h1><p class="page-subtitle">先想释义和搭配，再点开答案。空格显示答案，1 / 2 / 3 评分。</p></div>
        <div class="page-head-actions"><a class="btn btn-ghost" href="#/vocab">${icon('arrow-left')} 返回词库</a></div>
      </div>
      <div class="flash-progress"><span>${f.index + 1} / ${f.queue.length}</span><div class="progress-track"><i style="width:${progress}%"></i></div></div>
      <section class="flash-card ${f.revealed ? 'revealed' : ''}">
        <div class="flash-card-top"><span class="chip">${esc(entry.theme)}</span><span class="small muted">${esc(entry.pos)}</span></div>
        <div class="flash-word">${esc(entry.word)}</div>
        <button class="btn btn-ghost btn-sm" data-action="speak-word" data-word="${esc(entry.word)}">${icon('volume')} 发音</button>
        ${f.revealed ? `
          <div class="flash-answer">
            <div class="flash-meaning">${esc(entry.meaning)}</div>
            <div class="flash-collocation"><span>搭配</span><b>${esc(example.collocation)}</b>${entry.examples.length > 1 ? `<button class="vocab-example-btn" data-action="flash-example" title="换一句">${icon('refresh')}</button>` : ''}</div>
            <p class="flash-sentence">${highlightWord(example.sentence, entry.word)}</p>
            <p class="flash-zh">${esc(example.zh)}</p>
          </div>
          <div class="flash-actions">
            <button class="btn flash-rate difficult" data-action="flash-rate" data-status="difficult">${icon('x')} 不认识 <kbd>3</kbd></button>
            <button class="btn flash-rate fuzzy" data-action="flash-rate" data-status="fuzzy">? 模糊 <kbd>2</kbd></button>
            <button class="btn flash-rate known" data-action="flash-rate" data-status="known">${icon('check')} 认识 <kbd>1</kbd></button>
          </div>
        ` : `
          <button class="btn btn-primary flash-reveal" data-action="flash-reveal">显示答案 ${icon('eye')}</button>
          <p class="flash-hint">先在心里说出中文意思和一个搭配。</p>
        `}
      </section>
    `;
  }

  function rateFlash(status) {
    if (!ui.flash || !ui.flash.revealed) return;
    const entry = vocabById.get(ui.flash.queue[ui.flash.index]);
    if (!entry) return;
    setVocabStatus(entry.id, status);
    ui.flash.ratings[status] += 1;
    ui.flash.index += 1;
    ui.flash.revealed = false;
    ui.flash.exampleIndex = 0;
    renderFlashcards();
  }

  function initVocabQuiz() {
    const selected = shuffle(VOCAB).slice(0, 10);
    const items = selected.map((entry) => {
      const distractors = shuffle(VOCAB.filter((word) => word.id !== entry.id)).slice(0, 3);
      const options = shuffle([entry, ...distractors]).map((word, index) => ({
        key: 'ABCD'[index],
        text: word.meaning,
        correct: word.id === entry.id
      }));
      return { entry, options, selected: null, submitted: false };
    });
    ui.quiz = { items, index: 0, score: 0, finished: false, logged: false };
  }

  function renderVocabQuiz() {
    if (!ui.quiz) initVocabQuiz();
    const q = ui.quiz;
    if (q.finished) {
      const pct = Math.round((q.score / q.items.length) * 100);
      view.innerHTML = `
        <div class="page-head" style="margin-bottom:18px">
          <div><div class="eyebrow">VOCABULARY · QUIZ</div><h1 class="page-title">词汇测验</h1><p class="page-subtitle">10 个词，选出最接近的释义。答错会自动进入“待复习”。</p></div>
          <div class="page-head-actions"><a class="btn btn-ghost" href="#/vocab">${icon('arrow-left')} 返回词库</a></div>
        </div>
        <section class="flash-finish card">
          <div class="flash-finish-ring"><strong>${q.score}<small style="font-size:15px">/10</small></strong><span>正确 ${pct}%</span></div>
          <div class="flash-finish-copy">
            <h2>${pct >= 80 ? '词汇记忆很稳。' : pct >= 60 ? '基础不错，再巩固一轮。' : '把错词加入待复习，再刷一遍。'}</h2>
            <p>错词已经自动标记为“不认识”，可以在词汇库的“待复习”中集中处理。</p>
            <div class="result-actions">
              <button class="btn btn-primary" data-action="quiz-restart">${icon('refresh')} 再来一组</button>
              <button class="btn btn-ghost" data-action="start-flash">${icon('play')} 去闪卡</button>
              <a class="btn btn-ghost" href="#/vocab">回到词库</a>
            </div>
          </div>
        </section>
      `;
      return;
    }
    const item = q.items[q.index];
    const correctKey = item.options.find((o) => o.correct)?.key;
    view.innerHTML = `
      <div class="page-head" style="margin-bottom:14px">
        <div><div class="eyebrow">VOCABULARY · QUIZ</div><h1 class="page-title" style="font-size:25px">词汇测验</h1><p class="page-subtitle">选择最接近的释义。答完一题会显示例句和搭配。</p></div>
        <div class="page-head-actions"><a class="btn btn-ghost" href="#/vocab">${icon('arrow-left')} 返回词库</a></div>
      </div>
      <div class="flash-progress"><span>${q.index + 1} / ${q.items.length}</span><div class="progress-track"><i style="width:${(q.index / q.items.length) * 100}%"></i></div><b>${q.score} 分</b></div>
      <section class="quiz-card">
        <div class="quiz-word-row"><span class="chip">${esc(item.entry.theme)}</span><button class="icon-btn" data-action="speak-word" data-word="${esc(item.entry.word)}">${icon('volume')}</button></div>
        <div class="quiz-word">${esc(item.entry.word)}</div>
        <div class="quiz-pos">${esc(item.entry.pos)} · 选择最接近的释义</div>
        <div class="quiz-options">
          ${item.options.map((opt) => {
            const cls = item.submitted && opt.correct ? 'correct' : item.submitted && item.selected === opt.key ? 'wrong' : item.selected === opt.key ? 'selected' : '';
            return `<button class="option ${cls}" data-action="quiz-answer" data-key="${opt.key}" ${item.submitted ? 'disabled' : ''}><span class="option-letter">${opt.key}</span><span class="option-text">${esc(opt.text)}</span></button>`;
          }).join('')}
        </div>
        ${item.submitted ? `
          <div class="explain ${item.selected === correctKey ? 'correct' : 'wrong'}">
            <div class="explain-head">${icon(item.selected === correctKey ? 'check' : 'x')} <strong>${item.selected === correctKey ? '回答正确' : `正确答案是 ${correctKey}`}</strong></div>
            <div class="answer-line"><b>${esc(item.entry.collocation)}</b></div>
            <p>${highlightWord(item.entry.sentence, item.entry.word)}<br><span class="muted">${esc(item.entry.zh)}</span></p>
          </div>
          <div class="question-actions" style="border-top:0">
            <span class="q-progress">${q.index + 1} / ${q.items.length}</span>
            <button class="btn btn-primary" data-action="quiz-next">${q.index >= q.items.length - 1 ? '查看结果' : '下一题'} ${icon('arrow-right')}</button>
          </div>
        ` : ''}
      </section>
    `;
  }

  function answerVocabQuiz(key) {
    if (!ui.quiz || ui.quiz.finished) return;
    const item = ui.quiz.items[ui.quiz.index];
    if (item.submitted) return;
    item.selected = key;
    item.submitted = true;
    const correct = item.options.find((o) => o.correct)?.key;
    if (key === correct) {
      ui.quiz.score += 1;
    } else {
      setVocabStatus(item.entry.id, 'difficult');
    }
    renderVocabQuiz();
  }

  function nextVocabQuiz() {
    const q = ui.quiz;
    if (!q) return;
    q.index += 1;
    if (q.index >= q.items.length) {
      q.finished = true;
      if (!q.logged) {
        q.logged = true;
        state.vocab.quizHistory = [{ date: new Date().toISOString(), score: q.score, total: q.items.length }, ...state.vocab.quizHistory].slice(0, 30);
        saveState();
      }
    }
    renderVocabQuiz();
  }

  // ---------- module group list ----------

  function renderModule(module) {
    if (!MODULES[module] || !['listening', 'cloze', 'matching', 'careful'].includes(module)) {
      renderNotFound();
      return;
    }
    const m = MODULES[module];
    const groups = groupsForModule(module);
    const s = moduleStats(module);
    view.innerHTML = `
      <div class="page-head">
        <div>
          <div class="eyebrow">${m.en.toUpperCase()}</div>
          <h1 class="page-title">${m.label}</h1>
          <p class="page-subtitle">${m.blurb} 共 ${s.total} 题，已完成 ${s.done} 题。</p>
        </div>
        <div class="page-head-actions">
          <a class="btn btn-ghost" href="#/practice">${icon('arrow-left')} 返回专项</a>
        </div>
      </div>
      <div class="group-list">
        ${groups.map((group, index) => {
          const p = groupProgress(module, group);
          return `
            <a class="group-row" href="#/practice/${module}/${group.id}" style="${moduleStyle(module)}">
              <span class="group-number">${String(index + 1).padStart(2, '0')}</span>
              <span class="group-main">
                <h3>${esc(group.title)}</h3>
                <p>${module === 'listening' ? '听力材料 · 先听/朗读，再作答' : module === 'cloze' ? '10 个空 · 15 个备选词' : module === 'matching' ? '10 个陈述 · A—G 段匹配' : '5 道选择题 · 阅读原文后作答'}</p>
                <span class="group-meta">
                  <span>${p.qs.length} 题</span>
                  <span>${p.done}/${p.qs.length} 已完成</span>
                  <span>正确 ${p.correct}</span>
                </span>
              </span>
              <span class="group-status" aria-label="完成进度">
                ${p.qs.slice(0, 10).map((q) => `<i class="dot ${state.history[q.id] ? (state.history[q.id].correct ? 'done' : 'wrong') : ''}"></i>`).join('')}
              </span>
              <span class="btn btn-soft btn-sm">${p.done ? '继续' : '开始'} ${icon('arrow-right')}</span>
            </a>
          `;
        }).join('')}
      </div>
    `;
  }

  // ---------- MCQ practice ----------

  let ui = {
    practice: null,
    cloze: null,
    matching: null,
    listFilter: 'all',
    timer: null,
    vocab: { query: '', theme: '全部', status: 'all', page: 1 },
    vocabExample: {},
    flash: null,
    quiz: null,
    colloc: { query: '', type: '全部', page: 1 },
    cflash: null,
    phrasal: { query: '', type: '全部', page: 1 },
    confusable: { query: '', page: 1 }
  };

  function renderPracticeGroup(module, groupId) {
    const group = groupFor(module, groupId);
    if (!group) {
      renderNotFound();
      return;
    }
    stopTaskTimer();
    if (module === 'cloze') return renderClozePractice(group);
    if (module === 'matching') return renderMatchingPractice(group);
    return renderMcqPractice(module, group);
  }

  function initPractice(module, groupId) {
    const key = `${module}/${groupId}`;
    if (!ui.practice || ui.practice.key !== key) {
      ui.practice = { key, index: 0, selected: null, submitted: false };
    }
    return ui.practice;
  }

  function renderMcqPractice(module, group) {
    const p = initPractice(module, group.id);
    const qs = questionsFor(module, group);
    const q = qs[p.index];
    if (!q) {
      p.index = 0;
      return renderMcqPractice(module, group);
    }
    const m = MODULES[module];
    const isListening = module === 'listening';
    const passageCard = isListening
      ? `<aside class="passage-card">
          <div class="passage-label"><span class="chip">${icon('volume')} 听力材料</span><span class="small muted">${esc(group.title)}</span></div>
          <div class="tts-panel">
            <div class="tts-orb">${icon('volume')}</div>
            <div class="tts-copy">
              <strong>浏览器语音朗读</strong>
              <p>没有音频文件时，用系统语音把原文读一遍。建议先不看原文。</p>
            </div>
            <div class="tts-actions">
              <button class="btn btn-primary btn-sm" data-action="speak" data-group="${group.id}">${icon('play')} 朗读</button>
              <button class="btn btn-ghost btn-sm" data-action="stop-speak">停止</button>
            </div>
          </div>
          <details class="model-answer transcript-details">
            <summary>${icon('eye')} 查看听力原文</summary>
            <div class="answer-body passage-transcript">${nl2p(group.transcript)}</div>
          </details>
        </aside>`
      : `<aside class="passage-card">
          <div class="passage-label"><span class="chip">${icon('eye')} 阅读原文</span><span class="small muted">${esc(group.title)}</span></div>
          <h2>${esc(group.title)}</h2>
          <div class="passage-body">${nl2p(group.passage)}</div>
        </aside>`;

    view.innerHTML = `
      <div class="page-head" style="margin-bottom:18px">
        <div>
          <div class="eyebrow">${m.en.toUpperCase()} · PRACTICE</div>
          <h1 class="page-title" style="font-size:26px">${esc(group.title)}</h1>
          <p class="page-subtitle">${isListening ? '先朗读或听材料，再作答。答完可以对照原文复盘。' : '先读原文，再逐题作答；解析会标出定位依据。'}</p>
        </div>
        <div class="page-head-actions">
          <a class="btn btn-ghost" href="#/practice/${module}">${icon('arrow-left')} 返回列表</a>
          <button class="btn btn-ghost" data-action="bookmark" data-qid="${q.id}">${icon('bookmark')} ${isBookmarked(q.id) ? '已收藏' : '收藏'}</button>
        </div>
      </div>
      <div class="practice-layout ${isListening ? 'listening-layout' : ''}">
        ${passageCard}
        <section class="question-card">
          ${renderQuestionCard(q, {
            selected: p.selected,
            submitted: p.submitted,
            index: p.index,
            total: qs.length,
            module,
            showActions: true
          })}
        </section>
      </div>
    `;
  }

  function renderQuestionCard(q, opts) {
    const { selected, submitted, index, total, module, showActions } = opts;
    const isMcq = Array.isArray(q.options) && q.options.length > 0;
    const correct = q.answer;
    const selectedCorrect = submitted && selected === correct;
    const options = isMcq ? q.options.map((opt) => {
      const isSelected = selected === opt.key;
      const isCorrect = submitted && opt.key === correct;
      const isWrong = submitted && isSelected && !isCorrect;
      return `
        <button class="option ${isSelected && !submitted ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}"
          data-action="select-option" data-key="${opt.key}" ${submitted ? 'disabled' : ''}>
          <span class="option-letter">${opt.key}</span>
          <span class="option-text">${esc(opt.text)}</span>
        </button>
      `;
    }).join('') : '';

    const explanation = submitted ? `
      <div class="explain ${selectedCorrect ? 'correct' : 'wrong'}">
        <div class="explain-head">${icon(selectedCorrect ? 'check' : 'x')} <strong>${selectedCorrect ? '回答正确' : '再复盘一步'}</strong></div>
        <div class="answer-line">正确答案：<b>${esc(correct)}${isMcq ? `. ${esc(q.options.find((o) => o.key === correct)?.text || '')}` : ''}</b>${selected ? ` · 你的答案：${esc(selected)}` : ''}</div>
        <p>${esc(q.explanation)}</p>
        <div class="skill-line"><span class="chip">${esc(q.skill || '综合理解')}</span><span class="chip muted">第 ${q.number} 题</span></div>
      </div>
    ` : '';

    return `
      <div class="question-top">
        <span class="question-index">QUESTION ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
        <span class="chip">${esc(q.skill || '选择题')}</span>
      </div>
      <h2 class="q-stem">${esc(q.stem)}</h2>
      ${isMcq ? `<div class="options" data-qbox="${q.id}">${options}</div>` : ''}
      ${explanation}
      ${showActions ? `
        <div class="question-actions">
          <div class="question-nav">
            <button class="btn btn-ghost btn-sm" data-action="prev-question" ${index === 0 ? 'disabled' : ''}>${icon('arrow-left')} 上一题</button>
            <button class="btn btn-ghost btn-sm" data-action="next-question" ${index >= total - 1 ? 'disabled' : ''}>下一题 ${icon('arrow-right')}</button>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
            <span class="q-progress">${index + 1} / ${total}</span>
            ${submitted
              ? `<button class="btn btn-primary btn-sm" data-action="next-question" ${index >= total - 1 ? 'disabled' : ''}>继续 ${icon('arrow-right')}</button>`
              : `<button class="btn btn-primary btn-sm" id="submit-answer" data-action="submit-answer" ${selected ? '' : 'disabled'}>提交答案</button>`}
          </div>
        </div>
      ` : ''}
    `;
  }

  function currentPracticeQuestion() {
    if (!ui.practice) return null;
    const [module, groupId] = ui.practice.key.split('/');
    const group = groupFor(module, groupId);
    if (!group) return null;
    return questionsFor(module, group)[ui.practice.index] || null;
  }

  function submitPracticeAnswer() {
    const q = currentPracticeQuestion();
    const p = ui.practice;
    if (!q || !p || !p.selected || p.submitted) return;
    const ok = recordAnswer(q, p.selected);
    p.submitted = true;
    renderRoute(false);
    if (ok) toast('答对了，继续保持');
  }

  function movePractice(delta) {
    const p = ui.practice;
    if (!p) return;
    const [module, groupId] = p.key.split('/');
    const group = groupFor(module, groupId);
    const qs = questionsFor(module, group);
    const next = p.index + delta;
    if (next < 0 || next >= qs.length) return;
    p.index = next;
    p.selected = null;
    p.submitted = false;
    renderRoute(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- cloze practice ----------

  function initCloze(group) {
    const key = `cloze/${group.id}`;
    if (!ui.cloze || ui.cloze.key !== key) {
      ui.cloze = { key, answers: {}, submitted: false };
    }
    return ui.cloze;
  }

  function renderClozePassage(group, answers, submitted, editable = true) {
    const parts = String(group.passage).split(/\n{2,}/);
    return parts.map((para) => {
      const tokens = para.split(/(\{\{\d+\}\})/g);
      return `<p>${tokens.map((token) => {
        const match = token.match(/^\{\{(\d+)\}\}$/);
        if (!match) return esc(token);
        const number = match[1];
        const value = answers[number] || '';
        const correct = submitted && value === group.answers[number] ? 'is-correct' : '';
        const wrong = submitted && value !== group.answers[number] ? 'is-wrong' : '';
        return `<span class="blank-no">${number}</span><select class="blank-select ${correct} ${wrong}" data-blank="${number}" ${submitted || !editable ? 'disabled' : ''}>
          <option value="">选择</option>
          ${group.options.map((o) => `<option value="${o.key}" ${value === o.key ? 'selected' : ''}>${o.key}. ${esc(o.word)}</option>`).join('')}
        </select>`;
      }).join('')}</p>`;
    }).join('');
  }

  function renderClozePractice(group) {
    const c = initCloze(group);
    const qs = questionsFor('cloze', group);
    const score = qs.filter((q) => c.submitted && c.answers[q.number] === q.answer).length;
    const answeredCount = qs.filter((q) => c.answers[q.number]).length;

    view.innerHTML = `
      <div class="page-head" style="margin-bottom:18px">
        <div>
          <div class="eyebrow">BANKED CLOZE · PRACTICE</div>
          <h1 class="page-title" style="font-size:26px">${esc(group.title)}</h1>
          <p class="page-subtitle">从 15 个备选词中为每个空选一个词。每个词只能使用一次。</p>
        </div>
        <div class="page-head-actions">
          <a class="btn btn-ghost" href="#/practice/cloze">${icon('arrow-left')} 返回列表</a>
        </div>
      </div>
      <div class="cloze-card">
        <div class="cloze-passage">${renderClozePassage(group, c.answers, c.submitted)}</div>
        <div class="word-bank">
          <div class="word-bank-head"><strong>备选词</strong><span>${answeredCount} / 10 已选择</span></div>
          <div class="word-chips">
            ${group.options.map((o) => `<div class="word-chip"><b>${o.key}</b><span>${esc(o.word)}</span></div>`).join('')}
          </div>
        </div>
        ${c.submitted ? `
          <div class="panel">
            <div class="panel-head"><h3>本组得分</h3><span class="chip ${score === 10 ? 'green' : 'gold'}">${score} / 10</span></div>
            <div class="cloze-explain">
              ${qs.map((q) => `
                <div class="cloze-explain-row">
                  <strong>${q.number} ${q.answer}</strong>
                  <span>${esc(q.group.options.find((o) => o.key === q.answer)?.word || '')} · ${esc(q.explanation)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        <div class="question-actions" style="border-top:0;padding-top:0">
          <div class="question-nav">
            <button class="btn btn-ghost btn-sm" data-action="reset-cloze">${icon('refresh')} 重做</button>
            <a class="btn btn-ghost btn-sm" href="#/practice/cloze">${icon('arrow-left')} 返回列表</a>
          </div>
          <button class="btn btn-primary" data-action="submit-cloze" ${c.submitted || answeredCount < 10 ? 'disabled' : ''}>${c.submitted ? '已提交' : `提交答案${answeredCount ? `（${answeredCount}/10）` : ''}`}</button>
        </div>
      </div>
    `;
  }

  function submitCloze() {
    if (!ui.cloze || ui.cloze.submitted) return;
    const [module, groupId] = ui.cloze.key.split('/');
    const group = groupFor(module, groupId);
    const qs = questionsFor('cloze', group);
    qs.forEach((q) => recordAnswer(q, ui.cloze.answers[q.number] || ''));
    ui.cloze.submitted = true;
    renderRoute(false);
    const score = qs.filter((q) => ui.cloze.answers[q.number] === q.answer).length;
    toast(score === 10 ? '全对，词义和搭配都很稳。' : `本组答对 ${score} 题，逐空看一遍解析。`);
  }

  // ---------- matching practice ----------

  function initMatching(group) {
    const key = `matching/${group.id}`;
    if (!ui.matching || ui.matching.key !== key) {
      ui.matching = { key, answers: {}, submitted: false };
    }
    return ui.matching;
  }

  function renderMatchingPractice(group) {
    const m = initMatching(group);
    const qs = questionsFor('matching', group);
    const answered = qs.filter((q) => m.answers[q.number]).length;
    const score = qs.filter((q) => m.submitted && m.answers[q.number] === q.answer).length;

    view.innerHTML = `
      <div class="page-head" style="margin-bottom:18px">
        <div>
          <div class="eyebrow">MATCHING · PRACTICE</div>
          <h1 class="page-title" style="font-size:26px">${esc(group.title)}</h1>
          <p class="page-subtitle">阅读 A—G 段，把 10 个陈述匹配到对应段落。一个段落可以使用多次。</p>
        </div>
        <div class="page-head-actions">
          <a class="btn btn-ghost" href="#/practice/matching">${icon('arrow-left')} 返回列表</a>
        </div>
      </div>
      <div class="matching-layout">
        <div class="matching-passage">
          ${group.paragraphs.map((p) => `
            <div class="match-paragraph">
              <span class="match-letter">${p.letter}</span>
              <p>${esc(p.text)}</p>
            </div>
          `).join('')}
        </div>
        <div class="panel">
          <div class="panel-head"><h3>匹配陈述</h3><span class="chip">${answered} / 10 已选择</span></div>
          <div class="match-statements">
            ${qs.map((q) => {
              const value = m.answers[q.number] || '';
              const cls = m.submitted ? (value === q.answer ? 'is-correct' : 'is-wrong') : '';
              return `
                <div class="match-row ${cls}">
                  <span class="match-num">${q.number}</span>
                  <span class="match-text">${esc(q.text)}</span>
                  <select class="match-select" data-match="${q.number}" ${m.submitted ? 'disabled' : ''}>
                    <option value="">段</option>
                    ${group.paragraphs.map((p) => `<option value="${p.letter}" ${value === p.letter ? 'selected' : ''}>${p.letter}</option>`).join('')}
                  </select>
                </div>
              `;
            }).join('')}
          </div>
          ${m.submitted ? `
            <div class="explain ${score === 10 ? 'correct' : 'wrong'}" style="margin-top:14px">
              <div class="explain-head">${icon(score === 10 ? 'check' : 'x')} <strong>本组得分 ${score} / 10</strong></div>
              <p>${qs.map((q) => `<b>${q.number} → ${q.answer}</b> ${esc(q.explanation)}`).join('<br><br>')}</p>
            </div>
          ` : ''}
          <div class="question-actions" style="border-top:0;padding-top:0">
            <button class="btn btn-ghost btn-sm" data-action="reset-matching">${icon('refresh')} 重做</button>
            <button class="btn btn-primary" data-action="submit-matching" ${m.submitted || answered < 10 ? 'disabled' : ''}>${m.submitted ? '已提交' : '提交匹配'}</button>
          </div>
        </div>
      </div>
    `;
  }

  function submitMatching() {
    if (!ui.matching || ui.matching.submitted) return;
    const [module, groupId] = ui.matching.key.split('/');
    const group = groupFor(module, groupId);
    const qs = questionsFor('matching', group);
    qs.forEach((q) => recordAnswer(q, ui.matching.answers[q.number] || ''));
    ui.matching.submitted = true;
    renderRoute(false);
    const score = qs.filter((q) => ui.matching.answers[q.number] === q.answer).length;
    toast(score === 10 ? '全部匹配正确。' : `本组答对 ${score} 题，回到原文看同义替换。`);
  }

  // ---------- writing / translation ----------

  function stopTaskTimer() {
    if (ui.timer && ui.timer.interval) clearInterval(ui.timer.interval);
    ui.timer = null;
  }

  function startTaskTimer(minutes) {
    stopTaskTimer();
    const end = Date.now() + minutes * 60 * 1000;
    ui.timer = { end, interval: setInterval(updateTaskTimer, 500) };
    updateTaskTimer();
    toast(`计时开始：${minutes} 分钟`);
  }

  function updateTaskTimer() {
    const el = document.getElementById('task-timer');
    if (!el || !ui.timer) return;
    const left = ui.timer.end - Date.now();
    el.textContent = formatClock(Math.max(0, left));
    el.classList.toggle('warning', left < 5 * 60 * 1000);
    if (left <= 0) {
      stopTaskTimer();
      el.textContent = '00:00';
      toast('时间到。先停笔，检查是否完整回应了题目。', 'error');
    }
  }

  function renderWritingList() {
    view.innerHTML = `
      ${pageHead('写作训练', '两篇任务，覆盖建议书与议论文。先限时写，再看范文与评分标准；范文放在答案区，不干扰动笔。', `<a class="btn btn-ghost" href="#/practice">${icon('arrow-left')} 返回专项</a>`)}
      <div class="group-list">
        ${BANK.writing.map((task, i) => `
          <a class="group-row" href="#/writing/${task.id}" style="${moduleStyle('writing')}">
            <span class="group-number">${String(i + 1).padStart(2, '0')}</span>
            <span class="group-main">
              <h3>${esc(task.title)}</h3>
              <p>${esc(task.skill)}</p>
              <span class="group-meta"><span>建议 ${task.time} 分钟</span><span>120—180 词</span><span>${state.tasks[task.id] ? '已完成' : '未完成'}</span></span>
            </span>
            <span class="btn btn-soft btn-sm">${state.tasks[task.id] ? '再看一遍' : '开始写作'} ${icon('arrow-right')}</span>
          </a>
        `).join('')}
      </div>
    `;
  }

  function renderWritingTask(id) {
    const task = BANK.writing.find((w) => w.id === id);
    if (!task) return renderNotFound();
    stopTaskTimer();
    const draft = state.drafts[task.id] || '';
    const words = countWords(draft);
    view.innerHTML = `
      <div class="page-head" style="margin-bottom:18px">
        <div>
          <div class="eyebrow">WRITING · TIMED PRACTICE</div>
          <h1 class="page-title" style="font-size:26px">${esc(task.title)}</h1>
          <p class="page-subtitle">建议 ${task.time} 分钟，120—180 词。先列提纲，再动笔；写完后对照范文与评分标准自评。</p>
        </div>
        <div class="page-head-actions"><a class="btn btn-ghost" href="#/writing">${icon('arrow-left')} 返回写作</a></div>
      </div>
      <div class="task-layout">
        <section class="prompt-card">
          <span class="chip">${icon('pen')} 写作任务</span>
          <h2>${esc(task.title)}</h2>
          <div class="prompt-text">${nl2p(task.directions)}</div>
          <div class="prompt-meta"><span class="chip muted">建议 ${task.time} 分钟</span><span class="chip muted">120—180 词</span><span class="chip">${esc(task.skill)}</span></div>
          <details class="model-answer">
            <summary>${icon('eye')} 查看参考范文、点评与评分标准</summary>
            <div class="answer-body">
              ${task.sampleTitle ? `<strong>${esc(task.sampleTitle)}</strong>` : ''}
              ${nl2p(task.sample)}
            </div>
            <div class="notes-box">${esc(task.notes)}</div>
            <div style="margin-top:14px">
              <strong class="small">亮点表达</strong>
              <ul class="small muted" style="margin:8px 0 0;padding-left:18px;line-height:1.8">
                ${task.expressions.map((e) => `<li>${esc(e)}</li>`).join('')}
              </ul>
            </div>
            ${rubricTable('writing')}
          </details>
        </section>
        <section class="editor-card">
          <div class="editor-head">
            <strong>我的作文</strong>
            <div class="editor-tools">
              <span class="timer-chip" id="task-timer">${ui.timer ? formatClock(ui.timer.end - Date.now()) : '30:00'}</span>
              <button class="btn btn-ghost btn-sm" data-action="start-timer" data-minutes="${task.time}">${icon('play')} 计时</button>
            </div>
          </div>
          <textarea class="essay-area" id="essay-area" data-task="${task.id}" placeholder="Start with a clear opening. Then develop two concrete points and close with a short conclusion...">${esc(draft)}</textarea>
          <div class="editor-foot">
            <span class="word-count ${words > 180 ? 'over' : ''}" id="word-count">已写 <strong>${words}</strong> 词 · 目标 120—180</span>
            <button class="btn btn-ghost btn-sm" data-action="save-draft" data-task="${task.id}">${icon('check')} 保存草稿</button>
          </div>
          <div class="editor-actions">
            <button class="btn btn-soft btn-sm" data-action="mark-done" data-task="${task.id}">${state.tasks[task.id] ? '已完成' : '标记完成'}</button>
          </div>
          <div class="notes-box" style="margin-top:14px">写作提示：用 3—4 分钟列提纲，至少留 2 分钟检查主谓一致、时态和拼写。不要只追求“高级词”，准确与自然优先。</div>
        </section>
      </div>
    `;
  }

  function rubricTable(type) {
    const rows = BANK.rubrics[type] || [];
    if (!rows.length) return '';
    return `
      <table class="rubric-table">
        <thead><tr><th>分数档</th><th>评分描述</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${esc(r.band)}</td><td>${esc(r.desc)}</td></tr>`).join('')}</tbody>
      </table>
    `;
  }

  function renderTranslationList() {
    view.innerHTML = `
      ${pageHead('翻译训练', '两段汉译英，主题覆盖文化与社会经济。先通读、标信息点，再落笔；对照参考译文检查表达。', `<a class="btn btn-ghost" href="#/practice">${icon('arrow-left')} 返回专项</a>`)}
      <div class="group-list">
        ${BANK.translation.map((task, i) => `
          <a class="group-row" href="#/translation/${task.id}" style="${moduleStyle('translation')}">
            <span class="group-number">${String(i + 1).padStart(2, '0')}</span>
            <span class="group-main">
              <h3>${esc(task.title)}</h3>
              <p>${esc(task.skill)}</p>
              <span class="group-meta"><span>建议 ${task.time} 分钟</span><span>汉译英</span><span>${state.tasks[task.id] ? '已完成' : '未完成'}</span></span>
            </span>
            <span class="btn btn-soft btn-sm">${state.tasks[task.id] ? '再看一遍' : '开始翻译'} ${icon('arrow-right')}</span>
          </a>
        `).join('')}
      </div>
    `;
  }

  function renderTranslationTask(id) {
    const task = BANK.translation.find((t) => t.id === id);
    if (!task) return renderNotFound();
    stopTaskTimer();
    const draft = state.drafts[task.id] || '';
    const words = countWords(draft);
    view.innerHTML = `
      <div class="page-head" style="margin-bottom:18px">
        <div>
          <div class="eyebrow">TRANSLATION · TIMED PRACTICE</div>
          <h1 class="page-title" style="font-size:26px">${esc(task.title)}</h1>
          <p class="page-subtitle">建议 ${task.time} 分钟。先标出时间、主体、原因、措施、结果等信息点，再写完整句。</p>
        </div>
        <div class="page-head-actions"><a class="btn btn-ghost" href="#/translation">${icon('arrow-left')} 返回翻译</a></div>
      </div>
      <div class="task-layout">
        <section class="prompt-card">
          <span class="chip gold">${icon('languages')} 翻译任务</span>
          <h2>${esc(task.title)}</h2>
          <div class="prompt-text zh">${nl2p(task.prompt)}</div>
          <div class="prompt-meta"><span class="chip muted">建议 ${task.time} 分钟</span><span class="chip">${esc(task.skill)}</span></div>
          <details class="model-answer">
            <summary>${icon('eye')} 查看参考译文、难点表达与评分标准</summary>
            <div class="answer-body">${nl2p(task.sample)}</div>
            <div class="notes-box">${esc(task.notes)}</div>
            ${task.expressions.length ? `
              <table class="expression-table">
                <tbody>${task.expressions.map((e) => `<tr><td>${esc(e.zh)}</td><td>${esc(e.en)}</td><td>${esc(e.note)}</td></tr>`).join('')}</tbody>
              </table>
            ` : ''}
            ${rubricTable('translation')}
          </details>
        </section>
        <section class="editor-card">
          <div class="editor-head">
            <strong>我的译文</strong>
            <div class="editor-tools">
              <span class="timer-chip" id="task-timer">${ui.timer ? formatClock(ui.timer.end - Date.now()) : '30:00'}</span>
              <button class="btn btn-ghost btn-sm" data-action="start-timer" data-minutes="${task.time}">${icon('play')} 计时</button>
            </div>
          </div>
          <textarea class="essay-area" id="essay-area" data-task="${task.id}" placeholder="Write a coherent English translation. Keep the information points complete and the sentences readable...">${esc(draft)}</textarea>
          <div class="editor-foot">
            <span class="word-count" id="word-count">已写 <strong>${words}</strong> 词</span>
            <button class="btn btn-ghost btn-sm" data-action="save-draft" data-task="${task.id}">${icon('check')} 保存草稿</button>
          </div>
          <div class="editor-actions">
            <button class="btn btn-soft btn-sm" data-action="mark-done" data-task="${task.id}">${state.tasks[task.id] ? '已完成' : '标记完成'}</button>
          </div>
          <div class="notes-box" style="margin-top:14px">翻译提示：遇到不会的词，用解释性表达保证意思完整；不要逐字硬译，也不要漏掉句间的因果或并列关系。</div>
        </section>
      </div>
    `;
  }

  // ---------- listening speech ----------

  function speakText(text, rate = 0.9) {
    if (!('speechSynthesis' in window)) {
      toast('当前浏览器不支持语音合成，请直接阅读听力原文。', 'error');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text).replace(/\*\*/g, ''));
    utterance.lang = 'en-US';
    utterance.rate = rate;
    utterance.pitch = 1;
    const voices = window.speechSynthesis.getVoices();
    const english = voices.find((v) => /en[-_](US|GB)/i.test(v.lang)) || voices.find((v) => /^en/i.test(v.lang));
    if (english) utterance.voice = english;
    window.speechSynthesis.speak(utterance);
    toast('开始朗读。建议先不看原文。');
  }

  function stopSpeaking() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function speakGroup(groupId, rate = 0.9) {
    const group = BANK.listening.find((g) => g.id === groupId);
    if (group) speakText(group.transcript, rate);
  }

  // ---------- exam ----------

  let exam = null;
  let examInterval = null;
  const EXAM_MINUTES = 90;

  function buildExamGroups() {
    const groups = [];
    BANK.listening.forEach((g) => groups.push({ kind: 'listening', group: g, qs: questionsFor('listening', g), module: 'listening' }));
    BANK.cloze.forEach((g) => groups.push({ kind: 'cloze', group: g, qs: questionsFor('cloze', g), module: 'cloze' }));
    BANK.matching.forEach((g) => groups.push({ kind: 'matching', group: g, qs: questionsFor('matching', g), module: 'matching' }));
    BANK.careful.forEach((g) => groups.push({ kind: 'careful', group: g, qs: questionsFor('careful', g), module: 'careful' }));
    return groups;
  }

  function createExam() {
    exam = {
      id: `E${Date.now()}`,
      startedAt: Date.now(),
      endsAt: Date.now() + EXAM_MINUTES * 60 * 1000,
      answers: {},
      groupIndex: 0
    };
    document.body.classList.add('exam-active');
    startExamTimer();
  }

  function startExam() {
    if (exam) {
      location.hash = '#/exam/run';
      return;
    }
    createExam();
    location.hash = '#/exam/run';
  }

  function startExamTimer() {
    clearInterval(examInterval);
    examInterval = setInterval(() => {
      if (!exam) {
        clearInterval(examInterval);
        return;
      }
      const left = exam.endsAt - Date.now();
      const el = document.getElementById('exam-timer');
      if (el) {
        el.innerHTML = `${icon('timer')}<span>${formatClock(left)}</span>`;
        el.classList.toggle('warning', left < 5 * 60 * 1000);
      }
      if (left <= 0) {
        clearInterval(examInterval);
        finishExam(true);
      }
    }, 500);
  }

  function stopExamTimer() {
    clearInterval(examInterval);
    examInterval = null;
  }

  function renderExamSetup() {
    document.body.classList.remove('exam-active');
    stopExamTimer();
    exam = null;
    view.innerHTML = `
      <section class="exam-hero">
        <div>
          <div class="eyebrow">TIMED MOCK EXAM</div>
          <h1>90 分钟，<br>检验真实手感。</h1>
          <p>覆盖听力、选词填空、长篇阅读与仔细阅读，共 82 道客观题。提交后按模块给出得分与逐题解析；写作与翻译可在专项训练中单独完成。</p>
        </div>
        <div class="exam-hero-side">
          <div class="exam-rule">${icon('clock')} 90 分钟倒计时</div>
          <div class="exam-rule">${icon('layers')} 14 组材料 · 82 题</div>
          <div class="exam-rule">${icon('chart')} 交卷后自动评分</div>
        </div>
      </section>
      <div class="exam-config">
        <div class="config-card"><span class="big-num">82</span><strong style="margin-top:8px">道客观题</strong><p>听力 22 + 选词 20 + 匹配 20 + 仔细阅读 20。</p></div>
        <div class="config-card"><span class="big-num">90</span><strong style="margin-top:8px">分钟</strong><p>建议按 25 / 20 / 15 / 30 分钟分配四个部分。</p></div>
        <div class="config-card"><span class="big-num">14</span><strong style="margin-top:8px">组材料</strong><p>按材料翻页，右侧答题卡显示每组完成度。</p></div>
      </div>
      <div class="panel" style="margin-top:16px">
        <div class="panel-head"><h3>开考之前</h3><span class="chip gold">客观题模考</span></div>
        <p class="small muted" style="line-height:1.8;margin:0 0 16px">这是模块化题库，不是官方整卷。计时开始后不要查词典、不要回看答案；写作和翻译不计入本次自动评分，可在交卷后单独训练。中途刷新页面会丢失本次作答。</p>
        <button class="btn btn-primary" data-action="start-exam">${icon('play')} 开始 90 分钟模考</button>
      </div>
    `;
  }

  function ensureExam() {
    if (!exam) createExam();
    document.body.classList.add('exam-active');
    startExamTimer();
    renderExamRun();
  }

  function renderExamRun() {
    if (!exam) {
      createExam();
    }
    document.body.classList.add('exam-active');
    const groups = buildExamGroups();
    const current = groups[exam.groupIndex] || groups[0];
    const answered = examAnswered();
    view.innerHTML = `
      <div class="exam-shell">
        <div class="exam-topbar">
          <div class="exam-brand"><span class="brand-mark">C4</span><span>客观题模考</span></div>
          <span class="exam-progress-text" id="exam-progress-text">已答 ${answered} / 82</span>
          <div class="exam-timer" id="exam-timer">${icon('timer')}<span>${formatClock(exam.endsAt - Date.now())}</span></div>
          <button class="exam-quit" data-action="exam-quit">退出考试</button>
        </div>
        <div class="exam-wrap">
          <div class="exam-layout">
            <main class="exam-main" id="exam-main">
              ${renderExamGroup(current, groups, exam.groupIndex)}
            </main>
            <aside class="exam-aside">
              <div class="exam-palette">
                <div class="exam-palette-head"><strong>答题卡</strong><span>${groups.length} 组材料</span></div>
                <div class="palette-grid">
                  ${groups.map((g, i) => `<button class="palette-btn" data-action="exam-goto" data-index="${i}" title="${esc(g.group.title)}">${String(i + 1).padStart(2, '0')}</button>`).join('')}
                </div>
                <p class="exam-palette-note">数字为材料组。答完一组后，右侧会有完成标记；不需要按题号顺序作答。</p>
              </div>
              <div class="panel" style="padding:15px">
                <div class="small muted">当前部分</div>
                <strong style="display:block;margin-top:3px">${esc(MODULES[current.module].label)}</strong>
                <div class="small muted" style="margin-top:3px">${esc(current.group.title)}</div>
              </div>
            </aside>
          </div>
        </div>
        <div class="exam-submitbar">
          <span class="exam-submit-copy">已答 ${answered} / 82 · 剩余 ${formatClock(exam.endsAt - Date.now())}</span>
          <button class="btn btn-ghost btn-sm" data-action="exam-prev" ${exam.groupIndex === 0 ? 'disabled' : ''}>${icon('arrow-left')} 上一组</button>
          ${exam.groupIndex >= groups.length - 1
            ? `<button class="btn btn-gold btn-sm" data-action="exam-submit">${icon('check')} 提交试卷</button>`
            : `<button class="btn btn-primary btn-sm" data-action="exam-next">下一组 ${icon('arrow-right')}</button>`}
        </div>
      </div>
    `;
    updateExamProgress();
  }

  function renderExamGroup(current, groups, index) {
    const g = current;
    const label = g.kind === 'listening' ? 'LISTENING'
      : g.kind === 'cloze' ? 'BANKED CLOZE'
        : g.kind === 'matching' ? 'MATCHING'
          : 'CAREFUL READING';
    const sectionNames = { listening: '听力理解', cloze: '选词填空', matching: '长篇阅读', careful: '仔细阅读' };
    let body = '';
    if (g.kind === 'listening') {
      body = `
        <div class="tts-panel exam-tts">
          <div class="tts-orb">${icon('volume')}</div>
          <div class="tts-copy"><strong>听力材料 · ${esc(g.group.title)}</strong><p>点击朗读，材料只读一遍；原文在交卷后可查看。</p></div>
          <div class="tts-actions"><button class="btn btn-primary btn-sm" data-action="exam-speak" data-group="${g.group.id}">${icon('play')} 播放</button><button class="btn btn-ghost btn-sm" data-action="stop-speak">停止</button></div>
        </div>
        <div class="exam-q-list">${g.qs.map((q) => renderExamQuestion(q)).join('')}</div>
      `;
    } else if (g.kind === 'careful') {
      body = `
        <div class="exam-passage-split">
          <div class="exam-passage">${nl2p(g.group.passage)}</div>
          <div class="exam-q-list">${g.qs.map((q) => renderExamQuestion(q)).join('')}</div>
        </div>
      `;
    } else if (g.kind === 'cloze') {
      body = renderExamCloze(g.group);
    } else {
      body = renderExamMatching(g.group);
    }
    return `
      <section class="exam-group-card">
        <div class="exam-group-kicker"><span>${label}</span><span class="chip">${index + 1} / ${groups.length}</span></div>
        <h2>${esc(g.group.title)}</h2>
        <p class="exam-group-sub">${g.kind === 'listening' ? '先听材料，再完成下面的选择题。' : g.kind === 'cloze' ? '从 15 个备选词中为 10 个空选择答案。' : g.kind === 'matching' ? '把 10 个陈述匹配到 A—G 段。' : '阅读原文，完成 5 道选择题。'}</p>
        ${body}
      </section>
      <div class="exam-nav">
        <button class="btn btn-ghost" data-action="exam-prev" ${index === 0 ? 'disabled' : ''}>${icon('arrow-left')} 上一组</button>
        <span class="small muted">${sectionNames[g.module]} · ${g.qs.length} 题</span>
        <button class="btn btn-primary" data-action="exam-next" ${index >= groups.length - 1 ? 'disabled' : ''}>下一组 ${icon('arrow-right')}</button>
      </div>
    `;
  }

  function renderExamQuestion(q) {
    const selected = exam.answers[q.id];
    return `
      <div class="exam-question" data-exam-question="${q.id}">
        <div class="exam-q-head"><span class="exam-q-num">${q.number}</span><p class="exam-q-stem">${esc(q.stem)}</p></div>
        <div class="exam-q-options" data-exam-qbox="${q.id}">
          ${q.options.map((opt) => `
            <button class="option ${selected === opt.key ? 'selected' : ''}" data-action="exam-select" data-qid="${q.id}" data-key="${opt.key}">
              <span class="option-letter">${opt.key}</span><span class="option-text">${esc(opt.text)}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderExamCloze(group) {
    const answers = exam.answers;
    const parts = String(group.passage).split(/\n{2,}/);
    const passage = parts.map((para) => {
      const tokens = para.split(/(\{\{\d+\}\})/g);
      return `<p>${tokens.map((token) => {
        const m = token.match(/^\{\{(\d+)\}\}$/);
        if (!m) return esc(token);
        const n = m[1];
        const value = answers[`${group.id}-B${n}`] || '';
        return `<span class="blank-no">${n}</span><select class="blank-select" data-exam-blank="${n}" data-qid="${group.id}-B${n}">
          <option value="">选择</option>
          ${group.options.map((o) => `<option value="${o.key}" ${value === o.key ? 'selected' : ''}>${o.key}. ${esc(o.word)}</option>`).join('')}
        </select>`;
      }).join('')}</p>`;
    }).join('');
    return `
      <div class="cloze-passage" style="padding:0;border:0;background:transparent">${passage}</div>
      <div class="word-bank" style="margin-top:8px">
        <div class="word-bank-head"><strong>备选词</strong><span>15 选 10 · 不可重复</span></div>
        <div class="word-chips">${group.options.map((o) => `<div class="word-chip"><b>${o.key}</b><span>${esc(o.word)}</span></div>`).join('')}</div>
      </div>
    `;
  }

  function renderExamMatching(group) {
    return `
      <div class="matching-passage" style="padding:0;border:0;background:transparent">
        ${group.paragraphs.map((p) => `<div class="match-paragraph"><span class="match-letter">${p.letter}</span><p>${esc(p.text)}</p></div>`).join('')}
      </div>
      <div class="match-statements" style="margin-top:10px">
        ${group.statements.map((s) => {
          const qid = s.id;
          const value = exam.answers[qid] || '';
          return `<div class="match-row"><span class="match-num">${s.number}</span><span class="match-text">${esc(s.text)}</span><select class="match-select" data-exam-match="${s.number}" data-qid="${qid}">
            <option value="">段</option>
            ${group.paragraphs.map((p) => `<option value="${p.letter}" ${value === p.letter ? 'selected' : ''}>${p.letter}</option>`).join('')}
          </select></div>`;
        }).join('')}
      </div>
    `;
  }

  function examAnswered() {
    if (!exam) return 0;
    return Object.keys(exam.answers).filter((k) => exam.answers[k]).length;
  }

  function groupAnsweredCount(group) {
    return group.qs.filter((q) => exam.answers[q.id]).length;
  }

  function updateExamProgress() {
    if (!exam) return;
    const count = examAnswered();
    const label = document.getElementById('exam-progress-text');
    if (label) label.textContent = `已答 ${count} / 82`;
    const sub = document.querySelector('.exam-submit-copy');
    if (sub) sub.textContent = `已答 ${count} / 82 · 剩余 ${formatClock(exam.endsAt - Date.now())}`;
    const groups = buildExamGroups();
    $$('.palette-btn').forEach((btn, i) => {
      const g = groups[i];
      if (!g) return;
      const answered = groupAnsweredCount(g);
      btn.classList.toggle('current', i === exam.groupIndex);
      btn.classList.toggle('full', answered === g.qs.length);
      btn.classList.toggle('partial', answered > 0 && answered < g.qs.length);
      btn.title = `${g.group.title} · ${answered}/${g.qs.length}`;
    });
  }

  function selectExamOption(qid, key) {
    if (!exam) return;
    exam.answers[qid] = key;
    const box = document.querySelector(`[data-exam-qbox="${qid}"]`);
    if (box) {
      $$('.option', box).forEach((opt) => opt.classList.toggle('selected', opt.dataset.key === key));
    }
    updateExamProgress();
  }

  function goExamGroup(index) {
    if (!exam) return;
    const groups = buildExamGroups();
    if (index < 0 || index >= groups.length) return;
    exam.groupIndex = index;
    renderExamRun();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function askSubmitExam() {
    if (!exam) return;
    const answered = examAnswered();
    confirmModal({
      title: '提交试卷？',
      body: `你已作答 <strong>${answered}</strong> / 82 题。提交后不能再修改答案，系统会立即按模块评分。`,
      confirmText: '提交并评分',
      onConfirm: () => finishExam(false)
    });
  }

  function finishExam(auto = false) {
    if (!exam) return;
    stopExamTimer();
    stopSpeaking();
    const answers = { ...exam.answers };
    const byModule = {};
    let score = 0;
    allQuestions.forEach((q) => {
      if (!byModule[q.module]) byModule[q.module] = { total: 0, correct: 0, answered: 0 };
      byModule[q.module].total += 1;
      const answer = answers[q.id];
      if (answer) byModule[q.module].answered += 1;
      if (answer === q.answer) {
        byModule[q.module].correct += 1;
        score += 1;
      }
    });
    const attempt = {
      id: exam.id,
      date: new Date().toISOString(),
      score,
      total: allQuestions.length,
      byModule,
      answers,
      duration: Date.now() - exam.startedAt,
      auto
    };
    state.examAttempts = [attempt, ...state.examAttempts].slice(0, 50);
    saveState();
    exam = null;
    document.body.classList.remove('exam-active');
    location.hash = `#/exam/result/${attempt.id}`;
    if (auto) toast('时间到，已自动交卷。', 'error');
  }

  function renderExamResult(attemptId) {
    document.body.classList.remove('exam-active');
    stopExamTimer();
    const attempt = state.examAttempts.find((a) => a.id === attemptId);
    if (!attempt) {
      renderNotFound();
      return;
    }
    const pct = Math.round((attempt.score / attempt.total) * 100);
    view.innerHTML = `
      <div class="page-head" style="margin-bottom:18px">
        <div>
          <div class="eyebrow">MOCK EXAM · RESULT</div>
          <h1 class="page-title">模考结果</h1>
          <p class="page-subtitle">${formatDateTime(attempt.date)} · 用时 ${Math.max(1, Math.round(attempt.duration / 60000))} 分钟 · 客观题自动评分</p>
        </div>
        <div class="page-head-actions"><a class="btn btn-ghost" href="#/exam">${icon('clock')} 再考一次</a><a class="btn btn-primary" href="#/home">${icon('home')} 回首页</a></div>
      </div>
      <section class="result-hero">
        <div class="result-ring" style="--pct:${pct}"><div class="result-ring-inner"><strong>${attempt.score}</strong><span>共 ${attempt.total} 题</span></div></div>
        <div class="result-copy">
          <h1>${pct >= 80 ? '手感很稳。' : pct >= 60 ? '基础在线，继续收紧。' : '先复盘，再刷一轮。'}</h1>
          <p>客观题正确率 ${pct}%。听力和阅读分别看一遍，再回到错题本重做错题。</p>
          <div class="result-actions">
            <button class="btn btn-primary btn-sm" data-action="scroll-review">${icon('list')} 查看逐题解析</button>
            <button class="btn btn-ghost btn-sm" data-action="retake-exam">${icon('refresh')} 重新模考</button>
            <a class="btn btn-ghost btn-sm" href="#/wrong">${icon('rotate')} 去错题本</a>
          </div>
          <div class="result-section-bars">
            ${Object.keys(attempt.byModule).map((m) => {
              const b = attempt.byModule[m];
              const p = b.total ? Math.round((b.correct / b.total) * 100) : 0;
              return `<div class="result-bar-row"><span>${MODULES[m].label}</span><span class="bar"><i style="width:${p}%;background:${MODULES[m].accent}"></i></span><b>${b.correct}/${b.total}</b></div>`;
            }).join('')}
          </div>
        </div>
      </section>
      <div id="exam-review" style="margin-top:20px">
        <div class="section-head" style="margin-top:12px"><div><h2>逐题解析</h2><p>按材料组复盘，先看定位依据，再看干扰项。</p></div></div>
        ${buildExamGroups().map((g) => renderExamReviewGroup(g, attempt)).join('')}
      </div>
    `;
  }

  function renderExamReviewGroup(g, attempt) {
    const qs = g.qs;
    const correct = qs.filter((q) => attempt.answers[q.id] === q.answer).length;
    let context = '';
    if (g.kind === 'listening') {
      context = `<details class="model-answer"><summary>${icon('eye')} 查看听力原文</summary><div class="answer-body passage-transcript">${nl2p(g.group.transcript)}</div></details>`;
    } else if (g.kind === 'careful') {
      context = `<details class="model-answer"><summary>${icon('eye')} 查看阅读原文</summary><div class="answer-body">${nl2p(g.group.passage)}</div></details>`;
    } else if (g.kind === 'cloze') {
      context = `<details class="model-answer"><summary>${icon('eye')} 查看选词填空原文</summary><div class="answer-body">${nl2p(g.group.passage.replace(/\{\{(\d+)\}\}/g, '[$1]'))}</div></details>`;
    } else {
      context = `<details class="model-answer"><summary>${icon('eye')} 查看匹配段落</summary><div class="answer-body">${g.group.paragraphs.map((p) => `<p><b>${p.letter}.</b> ${esc(p.text)}</p>`).join('')}</div></details>`;
    }
    return `
      <section class="review-group">
        <div class="panel-head"><h3>${esc(g.group.title)}</h3><span class="chip ${correct === qs.length ? 'green' : ''}">${correct} / ${qs.length}</span></div>
        ${context}
        ${qs.map((q) => {
          const user = attempt.answers[q.id] || '未作答';
          const ok = user === q.answer;
          return `
            <div class="review-q">
              <div class="review-q-head"><strong>${q.number}</strong><p>${esc(q.stem)}</p></div>
              <div class="review-answer">你的答案：<b class="${ok ? 'correct' : 'wrong'}">${esc(answerLabel(q, user))}</b> · 正确答案：<b class="correct">${esc(answerLabel(q, q.answer))}</b></div>
              <div class="review-exp">${esc(q.explanation)}</div>
            </div>
          `;
        }).join('')}
      </section>
    `;
  }

  function answerLabel(q, key) {
    if (!key || key === '未作答') return '未作答';
    if (q.module === 'cloze') {
      const word = q.group.options.find((o) => o.key === key);
      return word ? `${key}. ${word.word}` : key;
    }
    if (q.module === 'matching') return `段落 ${key}`;
    if (Array.isArray(q.options)) {
      const opt = q.options.find((o) => o.key === key);
      return opt ? `${key}. ${opt.text}` : key;
    }
    return key;
  }

  // ---------- wrong / bookmarks ----------

  function renderReviewList(kind) {
    const isWrong = kind === 'wrong';
    const source = isWrong ? wrongQuestions() : bookmarkQuestions();
    const filtered = ui.listFilter === 'all' ? source : source.filter((q) => q.module === ui.listFilter);
    const sorted = filtered.slice().sort((a, b) => {
      if (isWrong) return (state.history[b.id]?.lastAt || 0) - (state.history[a.id]?.lastAt || 0);
      return state.bookmarks.indexOf(a.id) - state.bookmarks.indexOf(b.id);
    });
    const filters = [['all', '全部'], ...Object.keys(MODULES).filter((m) => ['listening', 'cloze', 'matching', 'careful'].includes(m)).map((m) => [m, MODULES[m].label])];
    view.innerHTML = `
      ${pageHead(isWrong ? '错题本' : '收藏夹', isWrong ? '按最近一次作答自动收集。重做正确后会自动移出；也可以按题型筛选，集中复盘。' : '你手动保存的题目。适合考前回看定位依据和干扰项。', `<a class="btn btn-ghost" href="#/practice">${icon('layers')} 去练习</a>`)}
      <div class="list-toolbar">
        <div class="segmented">${filters.map(([key, label]) => `<button class="${ui.listFilter === key ? 'active' : ''}" data-action="filter-list" data-filter="${key}">${label}</button>`).join('')}</div>
        <span class="list-count">${sorted.length} 题</span>
      </div>
      ${sorted.length ? `<div class="review-list">${sorted.map((q) => reviewItemHTML(q, isWrong)).join('')}</div>` : emptyState(
        isWrong ? (source.length ? '该题型暂无错题' : '错题本是空的') : '还没有收藏',
        isWrong ? (source.length ? '换一个题型筛选，或继续做几道题。' : '做几道专项题，答错的题会自动出现在这里。') : '在练习页点击“收藏”，把值得回看的题留下来。',
        `<a class="btn btn-primary btn-sm" href="#/practice">开始练习</a>`
      )}
    `;
  }

  function reviewItemHTML(q, isWrong) {
    const h = state.history[q.id];
    const meta = isWrong
      ? `上次 ${h?.lastAnswer ? answerLabel(q, h.lastAnswer) : '未作答'} · 正确 ${answerLabel(q, q.answer)}`
      : `考点：${q.skill || '综合理解'}`;
    const action = q.module === 'cloze' || q.module === 'matching'
      ? `<button class="btn btn-ghost btn-sm" data-action="open-group" data-module="${q.module}" data-group="${q.groupId}">回原文</button>`
      : `<button class="btn btn-soft btn-sm" data-action="review-q" data-qid="${q.id}">重做</button>`;
    const bookmarkAction = isWrong
      ? `<button class="btn btn-ghost btn-sm" data-action="bookmark-list" data-qid="${q.id}" title="${isBookmarked(q.id) ? '取消收藏' : '收藏'}">${icon('bookmark')}</button>`
      : `<button class="btn btn-ghost btn-sm" data-action="remove-bookmark" data-qid="${q.id}" title="移出收藏">${icon('trash')}</button>`;
    return `
      <div class="review-item">
        <span class="q-type">${MODULES[q.module].label}<br>Q${q.number}</span>
        <div class="review-item-main">
          <h3>${esc(q.module === 'cloze' ? `第 ${q.number} 空` : q.stem)}</h3>
          <p>${esc(meta)}</p>
        </div>
        <div class="review-item-actions">
          ${action}
          ${bookmarkAction}
        </div>
      </div>
    `;
  }

  function openQuestionModal(qid) {
    const q = qById(qid);
    if (!q || !Array.isArray(q.options)) return;
    showModal(`<div id="modal-question">${modalQuestionHTML(q)}</div>`);
  }

  function modalQuestionHTML(q, selected = null, submitted = false) {
    const ok = submitted && selected === q.answer;
    return `
      <div class="question-top"><span class="question-index">Q${q.number} · ${MODULES[q.module].label}</span><span class="chip">${esc(q.skill)}</span></div>
      <h2 style="margin:0 0 14px;font-size:18px;line-height:1.5">${esc(q.stem)}</h2>
      <div class="options">
        ${q.options.map((opt) => {
          const cls = submitted && opt.key === q.answer ? 'correct' : submitted && selected === opt.key ? 'wrong' : selected === opt.key ? 'selected' : '';
          return `<button class="option ${cls}" data-action="modal-answer" data-qid="${q.id}" data-key="${opt.key}" ${submitted ? 'disabled' : ''}><span class="option-letter">${opt.key}</span><span class="option-text">${esc(opt.text)}</span></button>`;
        }).join('')}
      </div>
      ${submitted ? `<div class="explain ${ok ? 'correct' : 'wrong'}"><div class="explain-head">${icon(ok ? 'check' : 'x')} <strong>${ok ? '回答正确' : '正确答案是 ' + q.answer}</strong></div><p>${esc(q.explanation)}</p></div>` : ''}
      <div class="modal-actions"><button class="btn btn-ghost" data-action="close-modal">关闭</button></div>
    `;
  }

  function answerModalQuestion(qid, key) {
    const q = qById(qid);
    if (!q) return;
    recordAnswer(q, key);
    const box = document.getElementById('modal-question');
    if (box) box.innerHTML = modalQuestionHTML(q, key, true);
  }

  // ---------- stats ----------

  function renderStats() {
    const stats = getStats();
    const last28 = [];
    for (let i = 27; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      last28.push({ key, count: state.activity[key] || 0 });
    }
    const maxActivity = Math.max(1, ...last28.map((d) => d.count));
    view.innerHTML = `
      ${pageHead('学习数据', '只看真实进度：做了多少、对了多少、错在哪里。数据保存在本机浏览器。', `<button class="btn btn-ghost" data-action="export-data">${icon('download')} 导出数据</button>`)}
      <div class="stats-grid">
        <div class="big-stat"><span>累计作答</span><strong>${stats.attempts}</strong><small>${stats.attempted} 道不同题目</small></div>
        <div class="big-stat"><span>整体正确率</span><strong>${stats.accuracy}%</strong><small>${stats.correct} 道当前正确</small></div>
        <div class="big-stat"><span>待复盘</span><strong>${stats.wrong}</strong><small>错题本中的题目</small></div>
        <div class="big-stat"><span>连续学习</span><strong>${streakCount()}</strong><small>天</small></div>
      </div>
      <div class="analytics-grid">
        <section class="panel">
          <div class="panel-head"><h3>分模块正确率</h3><span class="small muted">最近一次作答</span></div>
          <div class="bar-list">
            ${['listening', 'cloze', 'matching', 'careful'].map((m) => {
              const s = moduleStats(m);
              return `<div class="bar-item"><span>${MODULES[m].label}</span><span class="bar"><i class="${m === 'cloze' ? 'gold' : ''}" style="width:${s.accuracy}%"></i></span><b>${s.accuracy}%</b></div>`;
            }).join('')}
          </div>
          <div class="notes-box" style="margin-top:18px">正确率按每种题型的最近一次作答计算；多次重做同一题会更新状态，但不会虚增“完成题目”数量。</div>
        </section>
        <section class="panel">
          <div class="panel-head"><h3>近 28 天</h3><span class="small muted">颜色越深，练得越多</span></div>
          <div class="heatmap">
            ${last28.map((d) => {
              const level = d.count === 0 ? 0 : d.count <= 3 ? 1 : d.count <= 8 ? 2 : d.count <= 15 ? 3 : 4;
              return `<div class="heat-cell" data-level="${level}" title="${d.key} · ${d.count} 题"></div>`;
            }).join('')}
          </div>
          <div class="heat-legend"><span>少</span><i></i><i></i><i></i><i></i><span>多</span></div>
          <div class="notes-box" style="margin-top:18px">今天：${todayCount()} 题 · 连续 ${streakCount()} 天。保持小步，不追求一次刷完。</div>
        </section>
      </div>
      <section class="panel" style="margin-top:16px">
        <div class="panel-head"><h3>词汇进度</h3><span class="small muted">${vocabStats().learned} / ${vocabStats().total} 个词</span></div>
        <div class="bar-list" style="margin-top:4px">
          <div class="bar-item"><span>掌握</span><span class="bar"><i style="width:${vocabStats().total ? Math.round((vocabStats().known / vocabStats().total) * 100) : 0}%"></i></span><b>${vocabStats().known}</b></div>
          <div class="bar-item"><span>待复习</span><span class="bar"><i class="gold" style="width:${vocabStats().total ? Math.round((vocabStats().review / vocabStats().total) * 100) : 0}%"></i></span><b>${vocabStats().review}</b></div>
        </div>
        <div class="result-actions"><a class="btn btn-ghost btn-sm" href="#/vocab">${icon('book')} 进入词汇库</a><button class="btn btn-ghost btn-sm" data-action="start-quiz">${icon('list')} 词汇测验</button></div>
      </section>
      <section class="panel" style="margin-top:16px">
        <div class="panel-head"><h3>模考记录</h3><span class="small muted">最近 ${Math.min(6, state.examAttempts.length)} 次</span></div>
        ${state.examAttempts.length ? `
          <table class="rubric-table">
            <thead><tr><th>日期</th><th>得分</th><th>用时</th><th>结果</th></tr></thead>
            <tbody>${state.examAttempts.slice(0, 6).map((a) => `<tr><td>${formatDateTime(a.date)}</td><td>${a.score} / ${a.total}</td><td>${Math.max(1, Math.round(a.duration / 60000))} 分钟</td><td><a class="section-link" href="#/exam/result/${a.id}">查看解析</a></td></tr>`).join('')}</tbody>
          </table>
        ` : '<div class="empty-mini">还没有模考记录。</div>'}
      </section>
    `;
  }

  // ---------- settings ----------

  function renderSettings() {
    const standalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    view.innerHTML = `
      ${pageHead('设置与备份', '题库离线运行，学习记录默认保存在当前浏览器。换设备前建议先导出数据。')}
      <div class="settings-grid">
        <section class="settings-card">
          <h2>学习记录</h2>
          <p>导出为 JSON 文件，可在另一台电脑或另一个浏览器导入。</p>
          <div class="setting-row">
            <div class="setting-copy"><strong>导出学习数据</strong><span>包含答题记录、错题、收藏、草稿与模考成绩</span></div>
            <button class="btn btn-ghost btn-sm" data-action="export-data">${icon('download')} 导出</button>
          </div>
          <div class="setting-row">
            <div class="setting-copy"><strong>导入学习数据</strong><span>导入前会覆盖当前记录，建议先导出备份</span></div>
            <button class="btn btn-ghost btn-sm" data-action="import-data">${icon('upload')} 选择文件</button>
            <input id="import-file" type="file" accept=".json,application/json" hidden>
          </div>
          <div class="setting-row">
            <div class="setting-copy"><strong>本地存储状态</strong><span>${storageWorks ? '正常，刷新页面不会丢失进度' : '不可用，进度只在当前页面有效'}</span></div>
            <span class="chip ${storageWorks ? 'green' : 'red'}">${storageWorks ? '已启用' : '受限'}</span>
          </div>
        </section>
        <section class="settings-card">
          <h2>外观</h2>
          <p>在明亮纸感和深色夜读之间切换，选择适合当前光线的界面。</p>
          <div class="setting-row">
            <div class="setting-copy"><strong>主题</strong><span>当前：${document.documentElement.dataset.theme === 'dark' ? '深色' : '浅色'}</span></div>
            <div class="segmented"><button data-action="set-theme" data-theme="light" class="${document.documentElement.dataset.theme !== 'dark' ? 'active' : ''}">浅色</button><button data-action="set-theme" data-theme="dark" class="${document.documentElement.dataset.theme === 'dark' ? 'active' : ''}">深色</button></div>
          </div>
          <div class="setting-row">
            <div class="setting-copy"><strong>界面缩放</strong><span>使用浏览器 Ctrl+ / Ctrl- 调整</span></div>
            <span class="chip muted">跟随浏览器</span>
          </div>
          <div class="setting-row">
            <div class="setting-copy"><strong>iPhone 主屏幕</strong><span>${standalone ? '当前已作为独立应用运行' : 'Safari 打开后点“分享”→“添加到主屏幕”'}</span></div>
            <span class="chip ${standalone ? 'green' : 'gold'}">${standalone ? '已安装' : '可安装'}</span>
          </div>
        </section>
        <section class="settings-card">
          <h2>关于题库</h2>
          <p>${esc(BANK.meta.title)} · v${esc(BANK.meta.version)}</p>
          <div class="about-list">
            <div><b>内容：</b>2 篇写作、6 篇听力、2 篇选词填空、2 篇长篇阅读、4 篇仔细阅读、2 段翻译。</div>
            <div><b>结构：</b>82 道客观题，答案、解析与听力原文均内置。</div>
            <div><b>词汇：</b>400 个四级高频核心词、900 句搭配例句，另附 100 个固定搭配、80 个短语动词和 40 组易混词。</div>
            <div><b>说明：</b>本应用使用原创模拟题库；历年真题原文与音频通常受版权保护，未内置。后续可在明确授权后扩展真题包。</div>
            <div><b>技术：</b>本地 HTML/CSS/JavaScript；可安装为 PWA，首次加载后可离线使用。</div>
          </div>
          <div class="setting-row" style="margin-top:10px">
            <div class="setting-copy"><strong>打印版题库</strong><span>同一套题的 Word 文档，适合打印或批注</span></div>
            <a class="btn btn-ghost btn-sm" href="打印版题库.docx" download>${icon('download')} 下载 DOCX</a>
          </div>
        </section>
        <section class="settings-card danger-zone">
          <h2>重置数据</h2>
          <p>删除当前浏览器内的全部答题记录、错题、收藏、草稿和模考成绩。此操作不可撤销。</p>
          <button class="btn btn-danger btn-sm" data-action="reset-data">${icon('trash')} 清空全部学习记录</button>
        </section>
      </div>
    `;
  }

  function exportData() {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cet4-lab-backup-${todayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('学习数据已导出');
  }

  async function importData(file) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !parsed.history || !Array.isArray(parsed.bookmarks)) {
        throw new Error('文件格式不正确');
      }
      confirmModal({
        title: '导入学习数据？',
        body: '导入会覆盖当前浏览器中的学习记录。若当前记录重要，请先取消并导出备份。',
        confirmText: '覆盖并导入',
        onConfirm: () => {
          const base = defaultState();
          state = {
            ...base,
            ...parsed,
            history: parsed.history || {},
            bookmarks: parsed.bookmarks || [],
            examAttempts: parsed.examAttempts || [],
            drafts: parsed.drafts || {},
            tasks: parsed.tasks || {},
            activity: parsed.activity || {},
            vocab: {
              status: parsed.vocab?.status || {},
              bookmarks: parsed.vocab?.bookmarks || [],
              quizHistory: parsed.vocab?.quizHistory || []
            },
            settings: { ...base.settings, ...(parsed.settings || {}) }
          };
          saveState();
          applyTheme(state.settings.theme || 'light');
          updateShell();
          renderRoute();
          toast('学习数据导入成功');
        }
      });
    } catch (error) {
      toast(`导入失败：${error.message}`, 'error');
    }
  }

  function resetAllData() {
    confirmModal({
      title: '清空全部学习记录？',
      body: '答题记录、错题本、收藏、草稿和模考成绩都会删除，且无法恢复。建议先导出备份。',
      confirmText: '确认清空',
      danger: true,
      onConfirm: () => {
        state = defaultState();
        saveState();
        applyTheme('light');
        updateShell();
        renderRoute();
        toast('学习记录已清空');
      }
    });
  }

  // ---------- router ----------

  function renderNotFound() {
    view.innerHTML = emptyState('页面不存在', '这个链接可能已经失效，回到首页继续学习吧。', `<a class="btn btn-primary btn-sm" href="#/home">回首页</a>`);
  }

  function parseRoute() {
    return (location.hash.replace(/^#\/?/, '') || 'home').split('/').filter(Boolean);
  }

  function renderRoute(scroll = true) {
    const parts = parseRoute();
    const root = parts[0] || 'home';
    const route = parts.join('/');
    closeNav();
    closeModal();
    if (root !== 'exam') {
      stopExamTimer();
      document.body.classList.remove('exam-active');
      exam = null;
    }
    if (!(root === 'writing' || root === 'translation')) stopTaskTimer();
    stopSpeaking();
    setActiveNav(route);
    if (root === 'home') renderHome();
    else if (root === 'practice') {
      if (parts.length === 1) renderPracticeHub();
      else if (parts.length === 2) renderModule(parts[1]);
      else if (parts.length >= 3) renderPracticeGroup(parts[1], parts[2]);
      else renderPracticeHub();
    } else if (root === 'writing') {
      if (parts[1]) renderWritingTask(parts[1]);
      else renderWritingList();
    } else if (root === 'translation') {
      if (parts[1]) renderTranslationTask(parts[1]);
      else renderTranslationList();
    } else if (root === 'vocab') {
      if (parts[1] === 'flash') renderFlashcards();
      else if (parts[1] === 'quiz') renderVocabQuiz();
      else if (parts[1] === 'collocations' && parts[2] === 'flash') renderCollocFlash();
      else if (parts[1] === 'collocations') renderCollocations();
      else if (parts[1] === 'phrasal') renderPhrasal();
      else if (parts[1] === 'confusable') renderConfusables();
      else renderVocab();
    } else if (root === 'exam') {
      if (parts[1] === 'run') {
        ensureExam();
      } else if (parts[1] === 'result' && parts[2]) {
        renderExamResult(parts[2]);
      } else {
        renderExamSetup();
      }
    } else if (root === 'wrong') renderReviewList('wrong');
    else if (root === 'bookmarks') renderReviewList('bookmarks');
    else if (root === 'stats') renderStats();
    else if (root === 'settings') renderSettings();
    else renderNotFound();
    updateShell();
    if (scroll) window.scrollTo({ top: 0, behavior: 'auto' });
  }

  // ---------- events ----------

  view.addEventListener('click', (event) => {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;

    if (action === 'select-option') {
      if (!ui.practice || ui.practice.submitted) return;
      ui.practice.selected = actionEl.dataset.key;
      const box = actionEl.closest('[data-qbox]');
      if (box) $$('.option', box).forEach((o) => o.classList.toggle('selected', o === actionEl));
      const submit = document.getElementById('submit-answer');
      if (submit) submit.disabled = false;
      return;
    }

    if (action === 'submit-answer') return submitPracticeAnswer();
    if (action === 'prev-question') return movePractice(-1);
    if (action === 'next-question') return movePractice(1);
    if (action === 'bookmark') {
      const id = actionEl.dataset.qid;
      toggleBookmark(id);
      actionEl.innerHTML = `${icon('bookmark')} ${isBookmarked(id) ? '已收藏' : '收藏'}`;
      return;
    }
    if (action === 'speak') return speakGroup(actionEl.dataset.group || 'L1');
    if (action === 'speak-word') return speakText(actionEl.dataset.word || '', 0.8);
    if (action === 'stop-speak') { stopSpeaking(); return; }

    if (action === 'vocab-status') {
      setVocabStatus(actionEl.dataset.id, actionEl.dataset.status);
      renderRoute(false);
      return;
    }
    if (action === 'vocab-example') {
      const id = actionEl.dataset.id;
      const entry = vocabById.get(id);
      if (entry) ui.vocabExample[id] = ((ui.vocabExample[id] || 0) + 1) % entry.examples.length;
      renderRoute(false);
      return;
    }
    if (action === 'flash-example') {
      if (ui.flash) {
        const entry = vocabById.get(ui.flash.queue[ui.flash.index]);
        if (entry) ui.flash.exampleIndex = ((ui.flash.exampleIndex || 0) + 1) % entry.examples.length;
        renderFlashcards();
      }
      return;
    }
    if (action === 'start-colloc-flash') {
      ui.cflash = null;
      if (location.hash === '#/vocab/collocations/flash') renderCollocFlash();
      else location.hash = '#/vocab/collocations/flash';
      return;
    }
    if (action === 'colloc-reveal') {
      if (ui.cflash) {
        ui.cflash.revealed = true;
        renderCollocFlash();
      }
      return;
    }
    if (action === 'colloc-next') {
      if (ui.cflash) {
        ui.cflash.index += 1;
        ui.cflash.revealed = false;
        renderCollocFlash();
      }
      return;
    }
    if (action === 'colloc-prev') {
      if (ui.cflash) {
        ui.cflash.index = Math.max(0, ui.cflash.index - 1);
        ui.cflash.revealed = false;
        renderCollocFlash();
      }
      return;
    }
    if (action === 'colloc-flash-restart') {
      ui.cflash = null;
      renderCollocFlash();
      return;
    }
    if (action === 'colloc-page') {
      ui.colloc.page = Number(actionEl.dataset.page) || 1;
      renderCollocations();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (action === 'colloc-reset') {
      ui.colloc = { query: '', type: '全部', page: 1 };
      renderCollocations();
      return;
    }
    if (action === 'phrasal-page') {
      ui.phrasal.page = Number(actionEl.dataset.page) || 1;
      renderPhrasal();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (action === 'phrasal-reset') {
      ui.phrasal = { query: '', type: '全部', page: 1 };
      renderPhrasal();
      return;
    }
    if (action === 'confusable-page') {
      ui.confusable.page = Number(actionEl.dataset.page) || 1;
      renderConfusables();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (action === 'confusable-reset') {
      ui.confusable = { query: '', page: 1 };
      renderConfusables();
      return;
    }
    if (action === 'vocab-bookmark') {
      toggleVocabBookmark(actionEl.dataset.id);
      renderRoute(false);
      return;
    }
    if (action === 'vocab-status-filter') {
      ui.vocab.status = actionEl.dataset.status;
      ui.vocab.page = 1;
      renderRoute(false);
      return;
    }
    if (action === 'vocab-page') {
      ui.vocab.page = Number(actionEl.dataset.page) || 1;
      renderRoute(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (action === 'vocab-reset') {
      ui.vocab = { query: '', theme: '全部', status: 'all', page: 1 };
      renderRoute(false);
      return;
    }
    if (action === 'start-flash') {
      ui.flash = null;
      if (location.hash === '#/vocab/flash') renderRoute(false);
      else location.hash = '#/vocab/flash';
      return;
    }
    if (action === 'start-quiz') {
      ui.quiz = null;
      if (location.hash === '#/vocab/quiz') renderRoute(false);
      else location.hash = '#/vocab/quiz';
      return;
    }
    if (action === 'flash-reveal') {
      if (ui.flash && !ui.flash.revealed) {
        ui.flash.revealed = true;
        renderFlashcards();
      }
      return;
    }
    if (action === 'flash-rate') return rateFlash(actionEl.dataset.status);
    if (action === 'flash-restart') {
      ui.flash = null;
      renderRoute(false);
      return;
    }
    if (action === 'quiz-answer') return answerVocabQuiz(actionEl.dataset.key);
    if (action === 'quiz-next') return nextVocabQuiz();
    if (action === 'quiz-restart') {
      ui.quiz = null;
      renderRoute(false);
      return;
    }

    if (action === 'submit-cloze') return submitCloze();
    if (action === 'reset-cloze') {
      ui.cloze = null;
      renderRoute(false);
      return;
    }
    if (action === 'submit-matching') return submitMatching();
    if (action === 'reset-matching') {
      ui.matching = null;
      renderRoute(false);
      return;
    }

    if (action === 'start-timer') {
      startTaskTimer(Number(actionEl.dataset.minutes) || 30);
      return;
    }
    if (action === 'save-draft') {
      const el = document.getElementById('essay-area');
      const id = actionEl.dataset.task;
      if (el) state.drafts[id] = el.value;
      saveState();
      toast('草稿已保存');
      return;
    }
    if (action === 'mark-done') {
      const id = actionEl.dataset.task;
      state.tasks[id] = true;
      saveState();
      actionEl.textContent = '已完成';
      updateShell();
      toast('已标记完成');
      return;
    }

    if (action === 'start-exam') return startExam();
    if (action === 'exam-select') return selectExamOption(actionEl.dataset.qid, actionEl.dataset.key);
    if (action === 'exam-goto') return goExamGroup(Number(actionEl.dataset.index));
    if (action === 'exam-prev') return goExamGroup((exam?.groupIndex || 0) - 1);
    if (action === 'exam-next') {
      if (!exam) return;
      const groups = buildExamGroups();
      if (exam.groupIndex >= groups.length - 1) return askSubmitExam();
      return goExamGroup(exam.groupIndex + 1);
    }
    if (action === 'exam-submit') return askSubmitExam();
    if (action === 'exam-quit') {
      confirmModal({
        title: '退出本次模考？',
        body: '当前作答不会计入模考记录。已经写下的答案会丢失。',
        confirmText: '退出',
        danger: true,
        onConfirm: () => {
          stopExamTimer();
          exam = null;
          document.body.classList.remove('exam-active');
          location.hash = '#/exam';
        }
      });
      return;
    }
    if (action === 'exam-speak') return speakGroup(actionEl.dataset.group || 'L1');
    if (action === 'scroll-review') {
      const el = document.getElementById('exam-review');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (action === 'retake-exam') return startExam();

    if (action === 'filter-list') {
      ui.listFilter = actionEl.dataset.filter;
      renderRoute(false);
      return;
    }
    if (action === 'review-q') return openQuestionModal(actionEl.dataset.qid);
    if (action === 'bookmark-list') {
      toggleBookmark(actionEl.dataset.qid);
      renderRoute(false);
      return;
    }
    if (action === 'open-group') {
      location.hash = `#/practice/${actionEl.dataset.module}/${actionEl.dataset.group}`;
      return;
    }
    if (action === 'remove-bookmark') {
      const id = actionEl.dataset.qid;
      if (isBookmarked(id)) toggleBookmark(id);
      renderRoute(false);
      return;
    }
    if (action === 'modal-answer') return answerModalQuestion(actionEl.dataset.qid, actionEl.dataset.key);
    if (action === 'close-modal') { closeModal(); if (parseRoute()[0] === 'wrong' || parseRoute()[0] === 'bookmarks') renderRoute(false); return; }

    if (action === 'export-data') return exportData();
    if (action === 'import-data') {
      const input = document.getElementById('import-file');
      if (input) input.click();
      return;
    }
    if (action === 'reset-data') return resetAllData();
    if (action === 'set-theme') {
      const theme = actionEl.dataset.theme;
      state.settings.theme = theme;
      applyTheme(theme);
      saveState();
      renderRoute(false);
      return;
    }
  });

  view.addEventListener('change', (event) => {
    const el = event.target;
    if (el.id === 'vocab-theme') {
      ui.vocab.theme = el.value;
      ui.vocab.page = 1;
      renderRoute(false);
      return;
    }
    if (el.id === 'colloc-type') {
      ui.colloc.type = el.value;
      ui.colloc.page = 1;
      renderCollocations();
      return;
    }
    if (el.id === 'phrasal-type') {
      ui.phrasal.type = el.value;
      ui.phrasal.page = 1;
      renderPhrasal();
      return;
    }
    if (el.matches('[data-blank]')) {
      if (!ui.cloze) return;
      const number = el.dataset.blank;
      ui.cloze.answers[number] = el.value;
      const count = Object.values(ui.cloze.answers).filter(Boolean).length;
      const head = document.querySelector('.word-bank-head span');
      if (head) head.textContent = `${count} / 10 已选择`;
      const btn = document.querySelector('[data-action="submit-cloze"]');
      if (btn) {
        btn.disabled = count < 10;
        btn.textContent = count ? `提交答案（${count}/10）` : '提交答案';
      }
      return;
    }
    if (el.matches('[data-match]')) {
      if (!ui.matching) return;
      const number = el.dataset.match;
      ui.matching.answers[number] = el.value;
      const count = Object.values(ui.matching.answers).filter(Boolean).length;
      const chip = document.querySelector('.panel-head .chip');
      if (chip) chip.textContent = `${count} / 10 已选择`;
      const btn = document.querySelector('[data-action="submit-matching"]');
      if (btn) btn.disabled = count < 10;
      return;
    }
    if (el.matches('[data-exam-blank]')) {
      if (!exam) return;
      exam.answers[el.dataset.qid] = el.value;
      updateExamProgress();
      return;
    }
    if (el.matches('[data-exam-match]')) {
      if (!exam) return;
      exam.answers[el.dataset.qid] = el.value;
      updateExamProgress();
      return;
    }
    if (el.id === 'import-file' && el.files && el.files[0]) {
      importData(el.files[0]);
      el.value = '';
    }
  });

  let draftTimer = null;
  view.addEventListener('input', (event) => {
    const el = event.target;
    if (el.id === 'vocab-search') {
      ui.vocab.query = el.value;
      ui.vocab.page = 1;
      renderVocab();
      const next = document.getElementById('vocab-search');
      if (next) {
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      }
      return;
    }
    if (el.id === 'colloc-search') {
      ui.colloc.query = el.value;
      ui.colloc.page = 1;
      renderCollocations();
      const next = document.getElementById('colloc-search');
      if (next) {
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      }
      return;
    }
    if (el.id === 'phrasal-search') {
      ui.phrasal.query = el.value;
      ui.phrasal.page = 1;
      renderPhrasal();
      const next = document.getElementById('phrasal-search');
      if (next) {
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      }
      return;
    }
    if (el.id === 'confusable-search') {
      ui.confusable.query = el.value;
      ui.confusable.page = 1;
      renderConfusables();
      const next = document.getElementById('confusable-search');
      if (next) {
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      }
      return;
    }
    if (el.id !== 'essay-area') return;
    const id = el.dataset.task;
    const words = countWords(el.value);
    const counter = document.getElementById('word-count');
    if (counter) {
      counter.classList.toggle('over', words > 180);
      counter.innerHTML = `已写 <strong>${words}</strong> 词${id.startsWith('W') ? ' · 目标 120—180' : ''}`;
    }
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      state.drafts[id] = el.value;
      saveState();
    }, 350);
  });

  modalRoot.addEventListener('click', (event) => {
    if (event.target === modalRoot) {
      closeModal();
      if (parseRoute()[0] === 'wrong' || parseRoute()[0] === 'bookmarks') renderRoute(false);
      return;
    }
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    if (actionEl.dataset.action === 'close-modal') {
      closeModal();
      if (parseRoute()[0] === 'wrong' || parseRoute()[0] === 'bookmarks') renderRoute(false);
    }
    if (actionEl.dataset.action === 'modal-answer') {
      answerModalQuestion(actionEl.dataset.qid, actionEl.dataset.key);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (modalRoot.classList.contains('open')) {
        closeModal();
        if (parseRoute()[0] === 'wrong' || parseRoute()[0] === 'bookmarks') renderRoute(false);
      } else closeNav();
      return;
    }
    const route = parseRoute();
    const active = document.activeElement;
    const typing = active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName);
    if (!typing && !modalRoot.classList.contains('open') && route[0] === 'vocab' && route[1] === 'flash' && ui.flash) {
      if (event.code === 'Space') {
        event.preventDefault();
        if (!ui.flash.revealed) {
          ui.flash.revealed = true;
          renderFlashcards();
        }
      } else if (ui.flash.revealed && ['1', '2', '3'].includes(event.key)) {
        event.preventDefault();
        rateFlash({ '1': 'known', '2': 'fuzzy', '3': 'difficult' }[event.key]);
      }
    }
  });

  window.addEventListener('hashchange', () => renderRoute());
  window.addEventListener('beforeunload', (event) => {
    if (exam) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  document.getElementById('mobile-menu')?.addEventListener('click', () => document.body.classList.add('nav-open'));
  document.getElementById('mobile-close')?.addEventListener('click', closeNav);
  document.body.addEventListener('click', (event) => {
    if (!document.body.classList.contains('nav-open')) return;
    if (event.target.closest('.sidebar') || event.target.closest('#mobile-menu')) return;
    closeNav();
  });
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    state.settings.theme = theme;
    applyTheme(theme);
    saveState();
    if (parseRoute()[0] === 'settings') renderRoute(false);
  });
  document.getElementById('avatar-btn')?.addEventListener('click', () => { location.hash = '#/stats'; });

  // ---------- init ----------

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Offline installation is unavailable, but the app still works online.
      });
    });
  }

  if (!location.hash) {
    location.replace('#/home');
  }
  applyTheme(state.settings.theme || 'light');
  renderRoute();
  updateShell();
  if (!storageWorks) {
    setTimeout(() => toast('本地存储不可用，学习进度可能无法保存。', 'error'), 800);
  }
})();
