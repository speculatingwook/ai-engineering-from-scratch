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
      // header nav (shared across pages)
      'nav.contents': 'Contents', 'nav.catalog': 'Catalog',
      'nav.roadmap': 'Roadmap', 'nav.glossary': 'Glossary',
      // home / index landing copy
      'home.tagline': '473 lessons. 20 phases. Every algorithm built from raw math before a single framework gets imported.',
      'home.attribution': 'Maintained by Rohit Ghumare and contributors. Run on your own machine.',
      'home.btn.star': 'Star on GitHub', 'home.btn.follow': 'Follow @rohitg00',
      'home.preface.eyebrow': 'How this works',
      'home.intro1': "Most AI material teaches in scattered pieces. A paper here, a fine-tuning post there, a flashy agent demo somewhere else. The pieces rarely line up. You ship a chatbot but can't explain its loss curve. You hook a function to an agent but can't say what attention does inside the model that's calling it.",
      'home.intro2': "This curriculum is the spine. 20 phases, 473 lessons, four languages: Python, TypeScript, Rust, Julia. Linear algebra at one end, autonomous swarms at the other. Every algorithm gets built from raw math first. Backprop. Tokenizer. Attention. Agent loop. By the time PyTorch shows up, you already know what it's doing under the hood.",
      'home.intro3': 'Each lesson runs the same loop: read the problem, derive the math, write the code, run the test, keep the artifact. No five-minute videos, no copy-paste deploys, no hand-holding. Free, open source, and built to run on your own laptop.',
      'home.stat.title': 'Current Progress',
      'home.stat.finished': 'Finished Lessons', 'home.stat.phases': 'Phases',
      'home.stat.languages': 'Languages', 'home.stat.glossary': 'Glossary Terms',
      'home.toc.title': 'Curriculum · 20 phases · 473 lessons',
      'home.toc.subtitle': 'Tap a phase to expand its lessons. Each one ships when its math, code, and test are all written.',
      'home.legend.complete': 'Complete', 'home.legend.inprogress': 'In progress', 'home.legend.planned': 'Planned',
      'home.modal.footnote': 'Progress saved in browser only', 'home.modal.reset': 'Reset progress',
      'home.colophon.eyebrow': 'Colophon',
      'home.colophon.body': 'The entire curriculum is on GitHub. Clone it, fork it, learn at your own pace. No paywall, no signup. Every lesson has runnable code in Python, TypeScript, Rust, or Julia, depending on what fits the concept best.',
      'home.footer': '© 2026 · open source · free forever', 'home.footer.report': 'Report'
    },
    ko: {
      'lang.toggle': 'EN', 'lang.toggleTitle': 'View in English', 'lang.toggleAria': '영어로 전환',
      'loading': '레슨 불러오는 중…',
      'learningObjectives': '학습 목표',
      'quiz.pre': '사전 점검', 'quiz.mid': '중간 점검',
      'quiz.post': '사후 퀴즈', 'quiz.all': '퀴즈',
      'phase': '페이즈',
      'search.placeholder': '검색…',
      // header nav (shared across pages)
      'nav.contents': '목차', 'nav.catalog': '카탈로그',
      'nav.roadmap': '로드맵', 'nav.glossary': '용어집',
      // home / index landing copy
      'home.tagline': '473개 레슨. 20개 페이즈. 단 하나의 프레임워크를 들이기 전에, 모든 알고리즘을 날것의 수학에서부터 만든다.',
      'home.attribution': 'Rohit Ghumare와 기여자들이 관리한다. 당신의 컴퓨터에서 직접 실행하라.',
      'home.btn.star': 'GitHub에서 스타', 'home.btn.follow': '@rohitg00 팔로우',
      'home.preface.eyebrow': '이 커리큘럼이 작동하는 방식',
      'home.intro1': '대부분의 AI 자료는 흩어진 조각으로 가르친다. 여기에 논문 하나, 저기에 파인튜닝(fine-tuning) 글 하나, 또 다른 어딘가에 화려한 에이전트 데모 하나. 그 조각들은 좀처럼 들어맞지 않는다. 챗봇을 출시하지만 그 손실(loss) 곡선을 설명하지 못한다. 에이전트에 함수를 연결하지만, 그것을 호출하는 모델 내부에서 어텐션(attention)이 무엇을 하는지 말하지 못한다.',
      'home.intro2': '이 커리큘럼은 그 척추(spine)다. 20개 페이즈, 473개 레슨, 네 가지 언어: Python, TypeScript, Rust, Julia. 한쪽 끝에는 선형대수(linear algebra), 다른 쪽 끝에는 자율 군집(autonomous swarm). 모든 알고리즘은 먼저 날것의 수학에서부터 만들어진다. 역전파(backprop). 토크나이저(tokenizer). 어텐션. 에이전트 루프(agent loop). PyTorch가 등장할 즈음이면, 당신은 이미 그것이 내부에서 무엇을 하는지 알게 된다.',
      'home.intro3': '각 레슨은 동일한 루프를 따른다. 문제를 읽고, 수학을 유도하고, 코드를 작성하고, 테스트를 실행하고, 산출물을 보관한다. 5분짜리 영상도, 복사-붙여넣기 배포도, 떠먹여 주는 안내도 없다. 무료, 오픈 소스이며, 당신 자신의 노트북에서 실행되도록 만들어졌다.',
      'home.stat.title': '현재 진행 상황',
      'home.stat.finished': '완료한 레슨', 'home.stat.phases': '페이즈',
      'home.stat.languages': '언어', 'home.stat.glossary': '용어집 용어',
      'home.toc.title': '커리큘럼 · 20개 페이즈 · 473개 레슨',
      'home.toc.subtitle': '페이즈를 눌러 레슨을 펼쳐 보라. 각 레슨은 수학·코드·테스트가 모두 갖춰졌을 때 공개된다.',
      'home.legend.complete': '완료', 'home.legend.inprogress': '진행 중', 'home.legend.planned': '예정',
      'home.modal.footnote': '진행 상황은 브라우저에만 저장됩니다', 'home.modal.reset': '진행 상황 초기화',
      'home.colophon.eyebrow': '판권',
      'home.colophon.body': '커리큘럼 전체가 GitHub에 있다. 클론하고, 포크하고, 당신의 속도로 배워라. 유료 장벽도, 가입도 없다. 모든 레슨에는 개념에 가장 잘 맞는 언어—Python, TypeScript, Rust, Julia—로 된 실행 가능한 코드가 있다.',
      'home.footer': '© 2026 · 오픈 소스 · 영원히 무료', 'home.footer.report': '제보'
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
