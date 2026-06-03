# 사이트 전체 한국어 i18n — 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정적 사이트(`site/`)의 모든 페이지에 `한`/`EN` 언어 토글을 추가하고, 토글 시 랜딩 카피·Contents·사이드바·UI 라벨·용어집이 한국어로 전환되게 한다.

**Architecture:** 접근법 A — build.js가 빌드 타임에 한국어 필드(`*Ko`)를 data.js에 함께 굽고, 런타임 `i18n.js`가 언어 상태(단일 키 `siteLang`)에 따라 `[data-i18n]` 라벨을 교체하고 데이터 기반 섹션을 `pick()`으로 재렌더한다. 한국어 필드가 비면 영어로 자동 폴백.

**Tech Stack:** 바닐라 JS(ES5 스타일, 기존 코드 관례), Node.js build.js, 정적 HTML/CSS. 테스트 프레임워크 없음 → 검증은 `node site/build.js` 출력 점검 + 로컬 정적 서버 브라우저 확인.

**참고:** 이 저장소엔 자동 테스트 하니스가 없다. 각 태스크의 "검증"은 (a) build.js 실행 후 data.js grep, (b) `python3 -m http.server`로 브라우저 수동 확인이다. TDD의 "실패 테스트 먼저"는 해당 시 grep 기반 가드로 대체한다.

**전제:** 작업 브랜치 `feature/site-wide-korean-i18n` 에서 진행(설계 스펙 커밋 완료). 로컬 서버는 `cd site && python3 -m http.server 8765`.

---

## 파일 구조

| 파일 | 책임 | 상태 |
|---|---|---|
| `site/i18n.js` | 런타임 i18n 코어: `getLang/setLang/t/pick` + UI 라벨 테이블 + langchange 이벤트 | 신규 |
| `site/build.js` | data.js에 `nameKo/summaryKo/keywordsKo/descKo/termKo/saysKo/meansKo` 추가 생성 | 수정 |
| `site/data.js` | build.js 생성물(한국어 필드 포함) | 재생성 |
| `glossary/terms.ko.md` | 83개 용어 한국어 번역(terms.md와 동일 포맷) | 신규 |
| `site/index.html` | `한` 토글 + i18n.js 로드 + 랜딩 카피 `data-i18n` | 수정 |
| `site/app.js` | Contents 그리드·모달·통계가 `pick()` 사용 + langchange 재렌더 | 수정 |
| `site/lesson.html` | 토글을 `siteLang` 공용 경로로 통일 + 사이드바 `pick` + UI 라벨 `t` | 수정 |
| `site/catalog.html` | `한` 토글 + i18n.js + 라벨/목록 i18n | 수정 |
| `site/prereqs.html` | `한` 토글 + i18n.js + 라벨 i18n | 수정 |
| `site/glossary.html` | `한` 토글 + i18n.js + 용어 목록 `pick` | 수정 |

작업 순서: 코어(i18n.js) → 데이터(build.js) → 콘텐츠(terms.ko.md) → 페이지 연동(index→app→lesson→catalog/prereqs→glossary) → 최종 검증/재빌드.

---

## Task 1: i18n.js 코어 레이어

**Files:**
- Create: `site/i18n.js`

- [ ] **Step 1: i18n.js 작성 (코어 + UI 라벨 스켈레톤)**

`site/i18n.js` 전체 내용:

```js
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
      'lang.toggle': 'EN', 'lang.toggleTitle': '한국어로 보기', 'lang.toggleAria': '한국어로 전환',
      'loading': 'Loading lesson…',
      'learningObjectives': 'Learning Objectives',
      'quiz.pre': 'Pre-Lesson Check', 'quiz.mid': 'Mid-Lesson Check',
      'quiz.post': 'Post-Lesson Quiz', 'quiz.all': 'Quiz',
      'phase': 'Phase',
      'search.placeholder': 'Search…'
    },
    ko: {
      'lang.toggle': '한', 'lang.toggleTitle': 'View in English', 'lang.toggleAria': '영어로 전환',
      'loading': '레슨 불러오는 중…',
      'learningObjectives': '학습 목표',
      'quiz.pre': '사전 점검', 'quiz.mid': '중간 점검',
      'quiz.post': '사후 퀴즈', 'quiz.all': '퀴즈',
      'phase': '페이즈',
      'search.placeholder': '검색…'
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
  document.documentElement.setAttribute('lang', getLang());
})();
```

- [ ] **Step 2: 문법/로딩 검증**

Run: `node -e "require('./site/i18n.js')" 2>&1 | head -5`
Expected: `window is not defined` 류 에러(브라우저 전역 의존) 또는 무출력 — **SyntaxError가 없으면 통과**. (Node엔 window가 없어 참조 에러는 정상.)

대안 검증 — 문법만: `node --check site/i18n.js`
Expected: 무출력(exit 0).

- [ ] **Step 3: Commit**

```bash
git add site/i18n.js
git commit -m "feat(i18n): add runtime i18n core (siteLang, t, pick, langchange)"
```

---

## Task 2: build.js — 레슨 한국어 메타(nameKo/summaryKo/keywordsKo)

**Files:**
- Modify: `site/build.js` (extractLessonMeta 일반화 + build() 적용 루프)

- [ ] **Step 1: extractLessonMeta를 언어 인자화**

`site/build.js`의 `extractLessonMeta`(현 239–261행)를 아래로 교체. `en.md`/`ko.md`를 모두 읽고 한국어 필드와 `nameKo`(H1)를 함께 추출한다.

```js
function extractLessonMeta(relPath) {
  const result = { summary: '', keywords: '', summaryKo: '', keywordsKo: '', nameKo: '' };
  readDocMeta(path.join(REPO_ROOT, relPath, 'docs', 'en.md'), result, '');
  readDocMeta(path.join(REPO_ROOT, relPath, 'docs', 'ko.md'), result, 'Ko');
  return result;
}

// Fills result.summary[suffix]/keywords[suffix] from a doc; for ko also nameKo (H1).
function readDocMeta(docPath, result, suffix) {
  try {
    const lines = fs.readFileSync(docPath, 'utf8').split(/\r?\n/);
    const h3s = [];
    let gotSummary = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (suffix === 'Ko' && !result.nameKo && line.startsWith('# ')) {
        result.nameKo = line.slice(2).trim();
      }
      if (!gotSummary && line.startsWith('> ') && line.length > 3) {
        const s = line.slice(2).trim();
        result['summary' + suffix] = s.length > 180 ? s.slice(0, 177) + '…' : s;
        gotSummary = true;
      }
      if (line.startsWith('### ')) {
        const heading = line.slice(4).trim();
        if (heading) h3s.push(heading);
      }
    }
    if (h3s.length) result['keywords' + suffix] = h3s.join(' · ');
  } catch (_) { /* absent — expected for planned lessons */ }
}
```

- [ ] **Step 2: build()의 적용 루프에서 한국어 필드 부착**

`site/build.js`의 build() 내 추출 루프(현 414–423행)를 아래로 교체:

```js
  for (const phase of phases) {
    for (const lesson of phase.lessons) {
      if (lesson.url) {
        const relPath = lesson.url.replace(GITHUB_BASE, '').replace(/\/+$/, '');
        const meta = extractLessonMeta(relPath);
        if (meta.summary)    { lesson.summary    = meta.summary;    summarized++;   }
        if (meta.keywords)   { lesson.keywords   = meta.keywords;   withKeywords++; }
        if (meta.nameKo)     { lesson.nameKo     = meta.nameKo;     }
        if (meta.summaryKo)  { lesson.summaryKo  = meta.summaryKo;  }
        if (meta.keywordsKo) { lesson.keywordsKo = meta.keywordsKo; }
      }
    }
  }
```

- [ ] **Step 3: 빌드 실행**

Run: `node site/build.js`
Expected: 에러 없이 `✅ Generated .../site/data.js` 출력.

- [ ] **Step 4: data.js에 한국어 레슨 필드가 들어갔는지 검증**

Run: `grep -c '"nameKo"' site/data.js && grep -c '"summaryKo"' site/data.js`
Expected: 둘 다 0보다 큰 수(수백 개). 0이면 추출 실패 → Step 1 정규식 점검.

Run: `grep -m1 -A2 '"nameKo"' site/data.js`
Expected: `"nameKo": "개발 환경 (Dev Environment)"` 같은 한글 값.

- [ ] **Step 5: Commit**

```bash
git add site/build.js site/data.js
git commit -m "feat(i18n): extract Korean lesson meta (nameKo/summaryKo/keywordsKo) in build"
```

---

## Task 3: build.js — 페이즈 한국어명(nameKo/descKo) 매핑

**Files:**
- Modify: `site/build.js` (PHASE_KO 매핑 테이블 + build()에서 부착)

- [ ] **Step 1: 페이즈 한글 매핑 테이블 추가**

`site/build.js` 상단 상수 영역(예: `GLOSSARY_PATH` 정의 직후)에 20개 매핑을 추가. 영어명/설명은 현재 data.js의 `name`/`desc` 기준이며, 한글은 README.ko.md 어휘를 따른다.

```js
// Korean phase names/descriptions (20 phases). Keyed by phase id.
const PHASE_KO = {
  0:  { name: '설정과 도구',        desc: '이후 모든 것을 위한 개발 환경을 갖춘다.' },
  1:  { name: '수학 기초',          desc: '' },
  2:  { name: 'ML 기초',            desc: '' },
  3:  { name: '딥러닝 코어',         desc: '' },
  4:  { name: '비전',               desc: '' },
  5:  { name: 'NLP',                desc: '' },
  6:  { name: '음성과 오디오',       desc: '' },
  7:  { name: '강화학습',           desc: '' },
  8:  { name: '생성 모델',          desc: '' },
  9:  { name: '트랜스포머',          desc: '' },
  10: { name: '대규모 언어 모델',     desc: '' },
  11: { name: '파인튜닝과 정렬',      desc: '' },
  12: { name: '검색 증강 생성(RAG)',  desc: '' },
  13: { name: '에이전트',           desc: '' },
  14: { name: '캡스톤 프로젝트',      desc: '' },
  15: { name: 'MLOps',             desc: '' },
  16: { name: '추론 최적화',         desc: '' },
  17: { name: '멀티모달',           desc: '' },
  18: { name: '프로덕션 시스템',      desc: '' },
  19: { name: '프런티어',           desc: '' }
};
```

> 실행 시 주의: 위 영어→한글 매핑의 정확한 페이즈명은 `grep '"name"' site/data.js | head -25`로 현재 20개 페이즈 영어명을 먼저 확인한 뒤, README.ko.md의 대응 표현으로 채울 것. `desc`는 비워두면 영어 폴백되므로, 시간이 없으면 name만 채워도 동작한다.

- [ ] **Step 2: build()에서 페이즈에 부착**

`site/build.js`의 build() 내, phases 파싱 직후(예: `const phases = parseReadme(...)` 다음 줄)에 추가:

```js
  for (const phase of phases) {
    const ko = PHASE_KO[phase.id];
    if (ko) {
      if (ko.name) phase.nameKo = ko.name;
      if (ko.desc) phase.descKo = ko.desc;
    }
  }
```

- [ ] **Step 3: 빌드 + 검증**

Run: `node site/build.js && grep -c '"nameKo"' site/data.js`
Expected: 에러 없이, nameKo 개수가 Task 2보다 20 증가(페이즈분 포함).

Run: `grep -m1 -A1 '"name": "Setup' site/data.js; grep -m1 '"nameKo": "설정과 도구"' site/data.js`
Expected: 페이즈 nameKo가 보임.

- [ ] **Step 4: Commit**

```bash
git add site/build.js site/data.js
git commit -m "feat(i18n): add Korean phase names/descriptions in build"
```

---

## Task 4: 용어집 한국어 번역 + build.js 매칭

**Files:**
- Create: `glossary/terms.ko.md`
- Modify: `site/build.js` (parseGlossary 재사용 + termKo/saysKo/meansKo 매칭)

- [ ] **Step 1: terms.ko.md 생성 (83개 용어 번역)**

`glossary/terms.md`와 **완전히 동일한 구조**로 한국어 본을 만든다. 각 용어 블록:

```markdown
### <English term 그대로 유지 — 매칭 키>

**What people say:** "<한국어 번역>"

**What it actually means:** <한국어 번역>
```

규칙:
- `### ` 제목(용어명)은 **영어 원문 그대로 유지**한다(영어 `term`과 1:1 매칭 키로 사용).
- `**What people say:**` / `**What it actually means:**` 라벨도 영어 그대로 유지(파서 재사용). 값만 한국어로 번역.
- 번역 톤·용어 병기는 메모리 `ko-translation-convention`을 따른다(기술 용어 `한글(English)`).
- 83개 전부. 누락된 용어는 build.js 매칭에서 영어로 폴백된다(깨지지 않음).

> 실행 메모: 이 번역은 분량이 커서 서브에이전트(번역 패스)로 생성하는 것을 권장. 입력=`glossary/terms.md`, 출력=`glossary/terms.ko.md`, 제약=위 구조/키 보존.

- [ ] **Step 2: build.js에서 terms.ko.md 파싱 + 매칭**

`site/build.js` 상단에 경로 상수 추가(예: `GLOSSARY_PATH` 다음):

```js
const GLOSSARY_KO_PATH = path.join(REPO_ROOT, 'glossary', 'terms.ko.md');
```

build()의 glossary 파싱부(현 406–407행) 다음에 매칭 로직 추가:

```js
  console.log('🔍 Parsing glossary/terms.ko.md...');
  let glossaryKo = [];
  try {
    glossaryKo = parseGlossary(fs.readFileSync(GLOSSARY_KO_PATH, 'utf8'));
  } catch (_) { /* ko glossary optional */ }
  const koByTerm = {};
  glossaryKo.forEach(t => { koByTerm[t.term.trim().toLowerCase()] = t; });
  glossaryTerms.forEach(t => {
    const ko = koByTerm[t.term.trim().toLowerCase()];
    if (ko) {
      // term name itself stays English (key), only translate the prose.
      if (ko.says)  t.saysKo  = ko.says;
      if (ko.means) t.meansKo = ko.means;
    }
  });
```

> 주의: 용어명(`term`)은 영어 유지(앵커/검색 키). 한국어로 보여줄 본문은 `saysKo`/`meansKo`. 만약 용어명 자체도 한글 병기로 보여주려면 별도 `termKo`를 추가하되, 현 설계는 says/means만 번역.

- [ ] **Step 3: 빌드 + 검증**

Run: `node site/build.js && grep -c '"meansKo"' site/data.js`
Expected: 0보다 큰 수(번역된 용어 수). 0이면 제목 키 매칭 실패 → terms.ko.md의 `### ` 영어명이 terms.md와 일치하는지 확인.

- [ ] **Step 4: Commit**

```bash
git add glossary/terms.ko.md site/build.js site/data.js
git commit -m "feat(i18n): Korean glossary (terms.ko.md) + build matching"
```

---

## Task 5: index.html — 토글 + 랜딩 카피 번역

**Files:**
- Modify: `site/index.html` (헤더 토글, i18n.js 로드, 랜딩 카피 data-i18n)
- Modify: `site/i18n.js` (UI.en/UI.ko에 랜딩 카피 키 추가)

- [ ] **Step 1: i18n.js UI 테이블에 랜딩 카피 키 추가**

`site/i18n.js`의 `UI.en`/`UI.ko`에 index 랜딩 문구 키를 추가. 한국어 값은 README.ko.md의 대응 문장을 사용. 최소 키 집합:

```js
// UI.en 에 추가
'home.title': 'AI Engineering from Scratch',
'home.intro1': 'Most AI material teaches in scattered pieces...',  // index.html 현행 문구 그대로
'home.intro2': 'This curriculum is the spine...',
'home.intro3': 'Each lesson runs the same loop...',
'home.cta': 'The entire curriculum is on GitHub...',
'home.footer': '© 2026 · open source · free forever',
'home.stat.phases': 'Phases',
'nav.contents': 'Contents'
// UI.ko 에 동일 키 — 값은 README.ko.md 한국어 문장
```

> 실행 메모: index.html의 실제 영어 문구(661/682–684/750/763행 등)를 그대로 `home.intro1` 등 en 값으로, 그 한국어 대응을 README.ko.md(24–46행, "이 커리큘럼이 작동하는 방식" 등)에서 가져와 ko 값으로 넣는다. `<br>`가 포함된 제목은 별도 처리(아래 Step 2 주석 참조).

- [ ] **Step 2: index.html 랜딩 텍스트에 data-i18n 부여**

번역 대상 요소에 `data-i18n="<key>"`를 추가한다. 예(현행 → 변경):

```html
<!-- 682행 -->
<p data-i18n="home.intro1">Most AI material teaches in scattered pieces...</p>
<!-- 683행 -->
<p data-i18n="home.intro2">This curriculum is the spine...</p>
<!-- 684행 -->
<p data-i18n="home.intro3">Each lesson runs the same loop...</p>
<!-- 750행 -->
<p data-i18n="home.cta">The entire curriculum is on GitHub...</p>
<!-- 763행 -->
<p data-i18n="home.footer">© 2026 · open source · free forever</p>
<!-- 699행 통계 라벨 -->
<span class="stat-row-label" data-i18n="home.stat.phases">Phases</span>
<!-- 630행 네비 -->
<a href="#contents" data-i18n="nav.contents">Contents</a>
```

> 제목(661행 `<h1>AI Engineering<br>from Scratch</h1>`)은 `<br>` 때문에 textContent 교체 시 줄바꿈이 사라진다. 한국어에서도 영문 브랜드명을 유지할 것이므로 **제목은 data-i18n 부여하지 않는다**(브랜드명은 번역하지 않음).

- [ ] **Step 3: index.html에 `한` 토글 버튼 추가**

648행 `#themeToggle` 버튼 **바로 앞에** 추가(lesson.html 1595행과 동일 마크업):

```html
<button class="theme-toggle" id="langToggle" data-i18n="lang.toggle" aria-label="한국어로 전환" title="한국어로 보기" type="button">한</button>
```

- [ ] **Step 4: index.html에 i18n.js 로드 + 토글/적용 스크립트**

773행 `<script src="data.js?v=...">` 바로 다음 줄에 추가:

```html
<script src="i18n.js?v=20260603a"></script>
```

그리고 app.js 로드 이후 인라인 스크립트(또는 app.js 내, Task 6에서 통합)에서 초기 적용 + 토글 바인딩. 우선 index 전용 최소 스크립트를 `</body>` 직전에 추가:

```html
<script>
  (function () {
    var i18n = window.AIFSi18n;
    if (!i18n) return;
    function refresh() {
      i18n.applyLabels(document);
      var lt = document.getElementById('langToggle');
      if (lt) { lt.textContent = i18n.t('lang.toggle'); lt.title = i18n.t('lang.toggleTitle'); lt.setAttribute('aria-label', i18n.t('lang.toggleAria')); }
    }
    var lt = document.getElementById('langToggle');
    if (lt) lt.addEventListener('click', function () {
      i18n.setLang(i18n.getLang() === 'ko' ? 'en' : 'ko');
    });
    window.addEventListener('aifs:langchange', refresh);
    refresh();
  })();
</script>
```

- [ ] **Step 5: 브라우저 검증**

Run: `cd site && python3 -m http.server 8765` (백그라운드) 후 `http://localhost:8765/` 열기.
Expected: 헤더에 `한` 버튼이 보이고, 클릭하면 소개 3문단·푸터·"Contents"가 한국어로 바뀐다. 새로고침/페이지 이동 후에도 유지(localStorage `siteLang`).

- [ ] **Step 6: Commit**

```bash
git add site/index.html site/i18n.js
git commit -m "feat(i18n): language toggle + Korean landing copy on home page"
```

---

## Task 6: app.js — Contents 그리드/모달/통계 pick() 연동

**Files:**
- Modify: `site/app.js` (renderPhases, openModal, renderModalLessons + langchange 재렌더)

- [ ] **Step 1: 헬퍼 추가 (pick 폴백)**

`site/app.js` 상단 IIFE 내부에 안전 헬퍼 추가(i18n.js 미로딩 시 영어 폴백):

```js
  function pick(obj, field) {
    return (window.AIFSi18n && window.AIFSi18n.pick) ? window.AIFSi18n.pick(obj, field) : (obj[field] || '');
  }
```

- [ ] **Step 2: renderPhases에서 페이즈명 pick 적용**

129행 `escapeHtml(p.name)` → `escapeHtml(pick(p, 'name'))`.

- [ ] **Step 3: openModal에서 페이즈명/설명 pick 적용**

213–214행:

```js
    document.getElementById('modalTitle').textContent = pick(p, 'name');
    document.getElementById('modalDesc').textContent = pick(p, 'desc');
```

- [ ] **Step 4: renderModalLessons에서 레슨명/요약 pick 적용**

`renderModalLessons`(222행~) 내에서 레슨 이름·요약을 출력하는 부분을 `pick(lesson,'name')`·`pick(lesson,'summary')`로 교체. (실행 시 해당 함수 본문에서 `l.name`/`lesson.name`/`l.summary` 사용처를 grep으로 찾아 모두 치환.)

Run(치환 대상 확인): `grep -nE "\.name|\.summary" site/app.js`

- [ ] **Step 5: langchange 구독으로 재렌더**

app.js 초기화부(DOMContentLoaded 핸들러 또는 IIFE 말미)에 추가:

```js
  window.addEventListener('aifs:langchange', function () {
    if (typeof renderPhases === 'function') renderPhases();
    // 열려 있는 모달이 있으면 다시 그린다.
    if (currentPhaseIdx >= 0 && document.getElementById('modalOverlay').classList.contains('open')) {
      openModal(currentPhaseIdx);
    }
  });
```

- [ ] **Step 6: 브라우저 검증**

`http://localhost:8765/` 에서 `한` 토글 시 Contents 그리드의 페이즈명이 한국어로 바뀌고, 페이즈 클릭 모달의 제목·레슨 목록·요약도 한국어로 표시되는지 확인. 한국어 누락 레슨은 영어로 폴백되어 깨지지 않아야 함.

- [ ] **Step 7: Commit**

```bash
git add site/app.js
git commit -m "feat(i18n): Korean phase/lesson rendering in contents grid + modal"
```

---

## Task 7: lesson.html — siteLang 통일 + 사이드바/라벨 i18n

**Files:**
- Modify: `site/lesson.html` (CONTENT_REPO 유지, langToggle→AIFSi18n, 사이드바 pick, UI 라벨 t, i18n.js 로드)

- [ ] **Step 1: i18n.js 로드 추가**

lesson.html의 스크립트 로드부(data.js 로드 지점)에 `<script src="i18n.js?v=20260603a"></script>` 추가. (lesson.html은 data.js를 인라인/로드하는 방식 확인 후 동일 위치에 삽입.)

Run: `grep -n "data.js\|<script" site/lesson.html | head`

- [ ] **Step 2: lessonLang을 siteLang 공용 상태로 통일**

현행 1691–1694행의 `lessonLang` 결정 로직을 AIFSi18n 사용으로 교체:

```js
      var lessonLang = window.AIFSi18n ? window.AIFSi18n.getLang() : (localStorage.getItem('lessonLang') || 'en');
```

`initLangToggle`(현행)의 클릭 핸들러에서 `localStorage.setItem('lessonLang', ...)` 대신:

```js
        lt.addEventListener('click', function () {
          var next = (window.AIFSi18n ? window.AIFSi18n.getLang() : lessonLang) === 'ko' ? 'en' : 'ko';
          if (window.AIFSi18n) window.AIFSi18n.setLang(next);
          lessonLang = next;
          updateLangToggleLabel();
          var contentEl = document.getElementById('lessonContent');
          if (contentEl) contentEl.innerHTML = '<div class="lesson-loading"><div class="spinner"></div><div class="lesson-loading-text">' + (window.AIFSi18n ? window.AIFSi18n.t('loading') : 'Loading lesson…') + '</div></div>';
          window.scrollTo(0, 0);
          fetchLesson(lessonPath);
        });
```

> 이렇게 하면 index/catalog 등에서 한국어를 선택한 사용자는 레슨 페이지에서도 자동으로 한국어 본문(ko.md)을 받는다(상태 공유).

- [ ] **Step 3: 사이드바 페이즈명 pick 적용**

1798행 사이드바 헤더 생성:

```js
          var phName = (window.AIFSi18n ? window.AIFSi18n.pick(phase, 'name') : phase.name);
          html += '<div class="sidebar-phase-header">' + (window.AIFSi18n ? window.AIFSi18n.t('phase') : 'Phase') + ' ' + String(phase.id).padStart(2, '0') + ' · ' + escapeHtml(phName) + '</div>';
```

사이드바 레슨 링크명도 동일하게 `pick(lesson,'name')`으로 치환(해당 라인 grep로 확인).

- [ ] **Step 4: UI 라벨(t) 치환**

"Loading lesson…"(1622/1918행), "Learning Objectives"(2327행), 퀴즈 제목(2699–2704행: Pre/Mid/Post/Quiz)을 `window.AIFSi18n.t('loading'|'learningObjectives'|'quiz.pre'|'quiz.mid'|'quiz.post'|'quiz.all')`로 치환. (각 문자열 리터럴을 grep으로 찾아 교체.)

Run(대상 확인): `grep -nE "Loading lesson|Learning Objectives|Pre-Lesson|Mid-Lesson|Post-Lesson Quiz" site/lesson.html`

- [ ] **Step 5: 브라우저 검증**

`http://localhost:8765/lesson.html?path=phases/00-setup-and-tooling/01-dev-environment` 열기.
Expected: index에서 한국어 선택 상태면 레슨도 한국어 본문 + 사이드바 페이즈명/"페이즈" 라벨 + UI 라벨이 한국어. 토글로 즉시 전환·유지.

- [ ] **Step 6: Commit**

```bash
git add site/lesson.html
git commit -m "feat(i18n): unify lesson page to shared siteLang + Korean sidebar/labels"
```

---

## Task 8: catalog.html + prereqs.html — 토글 + 라벨/목록 i18n

**Files:**
- Modify: `site/catalog.html`, `site/prereqs.html`

- [ ] **Step 1: 두 페이지에 `한` 토글 + i18n.js 로드**

각 페이지 `#themeToggle` 앞에 토글 버튼(Task 5 Step 3과 동일 마크업), 스크립트 로드부(data.js 다음)에 `<script src="i18n.js?v=20260603a"></script>` 추가.

- [ ] **Step 2: 데이터 렌더에 pick 적용 + 라벨 data-i18n**

두 페이지의 렌더 코드에서 `PHASES`/레슨을 출력하는 부분의 `.name`/`.summary`/`.desc`를 `window.AIFSi18n.pick(...)`로 치환(각 파일 grep로 사용처 확인). 헤더/검색 placeholder 등 정적 라벨은 `data-i18n` 부여 + i18n.js UI 키 추가.

Run(대상 확인): `grep -nE "\.name|\.summary|\.desc|placeholder" site/catalog.html site/prereqs.html`

- [ ] **Step 3: 토글/적용 스크립트 추가**

각 페이지 `</body>` 직전에 Task 5 Step 4의 인라인 스크립트를 추가하되, 데이터 재렌더가 필요한 경우 해당 페이지의 렌더 함수도 `aifs:langchange`에서 다시 호출.

- [ ] **Step 4: 브라우저 검증**

`http://localhost:8765/catalog`, `http://localhost:8765/path` 각각에서 `한` 토글 동작 + 라벨/목록 한국어 전환 확인.

- [ ] **Step 5: Commit**

```bash
git add site/catalog.html site/prereqs.html site/i18n.js
git commit -m "feat(i18n): language toggle + Korean labels on catalog/prereqs"
```

---

## Task 9: glossary.html — 토글 + 용어 목록 pick

**Files:**
- Modify: `site/glossary.html`

- [ ] **Step 1: `한` 토글 + i18n.js 로드**

`#themeToggle` 앞 토글 버튼 + data.js 다음 `<script src="i18n.js?v=20260603a">` 추가.

- [ ] **Step 2: 용어 렌더에 pick 적용**

glossary.html의 용어 렌더 함수에서 `term.says`/`term.means` 출력부를 `window.AIFSi18n.pick(term,'says')`·`pick(term,'means')`로 치환(용어명 `term`은 영어 유지). 검색 placeholder·헤더는 `data-i18n`.

Run(대상 확인): `grep -nE "\.says|\.means|\.term|placeholder|innerHTML" site/glossary.html`

- [ ] **Step 3: 토글/적용 + langchange 재렌더 스크립트 추가**

`</body>` 직전에 Task 5 Step 4 스크립트 + `aifs:langchange`에서 용어 목록 재렌더 함수 재호출.

- [ ] **Step 4: 브라우저 검증**

`http://localhost:8765/glossary` 에서 토글 시 용어 설명(says/means)이 한국어로, 미번역 용어는 영어로 폴백되는지 확인.

- [ ] **Step 5: Commit**

```bash
git add site/glossary.html
git commit -m "feat(i18n): language toggle + Korean glossary definitions"
```

---

## Task 10: 최종 통합 검증 + 재빌드

**Files:**
- (검증 전용; 필요 시 data.js 재생성)

- [ ] **Step 1: 클린 재빌드**

Run: `node site/build.js`
Expected: 에러 없음. 통계 로그에 Korean 추출 정상.

- [ ] **Step 2: 전 페이지 한↔영 점검**

로컬 서버에서 index / lesson / catalog / prereqs / glossary 5개 페이지 각각:
- `한` 버튼 표시 및 클릭 전환 동작
- 한국어 선택이 페이지 이동 후 유지(`siteLang`)
- 미번역 항목 영어 폴백(레이아웃 깨짐 없음)

- [ ] **Step 3: 회귀 확인**

영어 모드(기본)에서 모든 페이지가 변경 전과 동일하게 보이는지(영어 콘텐츠 회귀 없음) 확인.

- [ ] **Step 4: 최종 커밋 + 푸시(사용자 승인 시)**

```bash
git add -A site/ glossary/
git commit -m "chore(i18n): rebuild data.js with Korean fields"
```

> 푸시는 사용자 확인 후. raw.githubusercontent 의존(레슨 본문)은 이미 main에 ko.md 푸시 완료 상태이므로 사이트 셸 변경만 반영하면 됨.

---

## Self-Review 체크 (작성자 확인 완료)

- **스펙 커버리지**: 설계 §4.1→T2/T3/T4, §4.2→T1, §4.3→T5·T7·T8·T9, §4.4→T5·T6·T7·T8·T9, §4.5→T4, §6 폴백→T1 `pick()` 전 태스크 검증, §7 검증→T10. 누락 없음.
- **플레이스홀더**: 콘텐츠 대량 생성(terms.ko.md 83개, 랜딩 카피 한국어 문구)은 "실행 메모"로 출처·제약을 명시(README.ko.md/terms.md). 코드 스텝은 실제 코드 포함.
- **타입 일관성**: `pick(obj, 'name'|'summary'|'desc'|'says'|'means')`, 필드 접미사 `Ko`(nameKo/summaryKo/keywordsKo/descKo/saysKo/meansKo), 상태키 `siteLang`, 이벤트 `aifs:langchange` — 전 태스크 동일.
