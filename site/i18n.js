/**
 * AIFS site-wide i18n. Single shared language state in localStorage('siteLang').
 * UI labels live in the UI table; data-driven content uses pick() against the
 * *Ko fields baked into data.js by build.js. Missing Korean → English fallback.
 */
(function () {
  var STORAGE_KEY = 'siteLang';
  var LEGACY_KEY = 'lessonLang'; // lesson.html's old per-page key

  // One-time migration: if a user already chose a lesson language, honor it.
  try {
    if (!localStorage.getItem(STORAGE_KEY)) {
      var legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy === 'ko' || legacy === 'en') localStorage.setItem(STORAGE_KEY, legacy);
    }
  } catch (e) { /* localStorage disabled */ }

  var UI = {
    en: {
      'lang.toggle': '한', 'lang.toggleTitle': '한국어로 보기', 'lang.toggleAria': '한국어로 전환',
      'loading': 'Loading lesson…',
      'learningObjectives': 'Learning Objectives',
      'quiz.pre': 'Pre-Lesson Check', 'quiz.mid': 'Mid-Lesson Check',
      'quiz.post': 'Post-Lesson Quiz', 'quiz.all': 'Quiz',
      'phase': 'Phase',
      'search.placeholder': 'Search…',
      'nav.contents': 'Contents',
      'home.stat.phases': 'Phases'
    },
    ko: {
      'lang.toggle': 'EN', 'lang.toggleTitle': 'View in English', 'lang.toggleAria': '영어로 전환',
      'loading': '레슨 불러오는 중…',
      'learningObjectives': '학습 목표',
      'quiz.pre': '사전 점검', 'quiz.mid': '중간 점검',
      'quiz.post': '사후 퀴즈', 'quiz.all': '퀴즈',
      'phase': '페이즈',
      'search.placeholder': '검색…',
      'nav.contents': '목차',
      'home.stat.phases': '페이즈'
    }
  };

  function getLang() {
    try {
      var params = new URLSearchParams(window.location.search);
      var q = params.get('lang');
      if (q === 'ko' || q === 'en') { localStorage.setItem(STORAGE_KEY, q); return q; }
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'ko' || stored === 'en') return stored;
    } catch (e) { /* ignore */ }
    return 'en';
  }

  function setLang(lang) {
    if (lang !== 'ko' && lang !== 'en') return;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
    document.documentElement.setAttribute('lang', lang);
    window.dispatchEvent(new CustomEvent('aifs:langchange', { detail: { lang: lang } }));
  }

  function t(key) {
    var lang = getLang();
    return (UI[lang] && UI[lang][key]) || (UI.en && UI.en[key]) || key;
  }

  // pick(obj, 'name') → obj.nameKo when ko and present, else obj.name
  function pick(obj, field) {
    if (!obj) return '';
    if (getLang() === 'ko') {
      var ko = obj[field + 'Ko'];
      if (ko != null && ko !== '') return ko;
    }
    return obj[field] != null ? obj[field] : '';
  }

  // Apply [data-i18n] label text on the current page.
  function applyLabels(root) {
    var scope = root || document;
    var nodes = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }
  }

  window.AIFSi18n = {
    getLang: getLang, setLang: setLang, t: t, pick: pick, applyLabels: applyLabels
  };

  // Set <html lang> as early as possible.
  try { document.documentElement.setAttribute('lang', getLang()); } catch (e) { /* ignore */ }
})();
