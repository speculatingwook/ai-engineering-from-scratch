# 사이트 전체 한국어 i18n — 설계 문서

- **작성일**: 2026-06-03
- **상태**: 승인됨 (접근법 A, 섹션 1·2 명시 승인, 나머지 위임)
- **대상 디렉터리**: `site/` (정적 HTML/JS, 빌드 도구 없음)

## 1. 목표

`aiengineeringfromscratch.com` 정적 사이트 전체를 한국어로 볼 수 있게 한다.
현재는 레슨 본문(`docs/ko.md`)만 번역돼 있고, 사이트 "껍데기"(랜딩 카피, 사이드바·
Contents 메타데이터, UI 라벨, 용어집)는 전부 영어다. 모든 페이지에 `한`/`EN` 언어
토글을 두고, 토글 시 페이지 전체가 한국어로 전환되게 한다.

### 비목표 (Non-goals)
- 레슨 본문 자체의 재번역 (이미 `ko.md` 존재).
- `myths.md` 번역 (사이트에 렌더되지 않음 — build.js는 `terms.md`만 파싱).
- URL 라우팅 변경(별도 `/ko` 경로 없음). 언어는 클라이언트 상태로만 관리.

## 2. 핵심 원칙

- **번역은 거의 다 이미 존재한다.** README.ko.md + 473개 `docs/ko.md`에서 자동
  추출한다. 새로 만드는 번역은 **용어집(terms.ko.md, 83개)** 뿐이다.
- **단일 진실 원천**: build.js가 data.js를 소유한다. 한국어 메타데이터도 build.js가
  같은 파이프라인에서 굽는다(런타임 JSON 별도 관리 금지).
- **영어 폴백이 공짜**: 한국어 필드가 비면 자동으로 영어를 쓴다. 미번역 레슨/누락이
  생겨도 깨지지 않는다.

## 3. 접근법 (확정: A)

빌드 타임에 한국어 필드를 data.js에 함께 굽고(build.js), 런타임에 작은 i18n
레이어(i18n.js)가 언어 상태에 따라 DOM 라벨을 교체하고 데이터 기반 섹션을 재렌더한다.

- 대안 B(한국어 페이지 파일 분리) — HTML 이중 관리·드리프트 위험으로 기각.
- 대안 C(런타임 JSON fetch) — 평행 자료구조 동기화·네트워크 의존으로 기각.

## 4. 컴포넌트 설계

### 4.1 데이터 레이어 — `site/build.js` 확장 → `site/data.js`

영어 필드 옆에 한국어 필드를 추가 생성한다. 한국어 필드는 값이 있을 때만 출력
(비면 생략 → 런타임 폴백).

| 대상 | 영어 필드(현행) | 추가 한국어 필드 | 한국어 출처 |
|---|---|---|---|
| 레슨 | `name` | `nameKo` | 각 `docs/ko.md`의 H1 제목(`# ...`) |
| 레슨 | `summary` | `summaryKo` | `docs/ko.md` 첫 `>` 블록인용문 |
| 레슨 | `keywords` | `keywordsKo` | `docs/ko.md`의 `### H3` 제목들 ` · ` 결합 |
| 페이즈 | `name`/`desc` | `nameKo`/`descKo` | build.js 내 20개 항목 매핑 테이블(README.ko.md 기준) |
| 용어 | `term`/`def` | `termKo`/`defKo` | 신규 `glossary/terms.ko.md` |

- 기존 `extractLessonMeta(relPath)`는 `docs/en.md`를 읽는다. 이를 일반화하거나
  복제하여 `docs/ko.md`도 한 번 더 읽어 `summaryKo`/`keywordsKo`를 만든다.
  레슨 `nameKo`는 ko.md의 H1(`# 한글 (English)`)에서 추출한다.
- 페이즈 한글명은 README.ko.md에 파싱하기 좋은 표가 없으므로 build.js 상단에
  `{ 0: {name:'설정과 도구', desc:'...'}, ... }` 형태 20개 매핑 테이블로 둔다.
- 용어집은 기존 `terms.md` 파서를 그대로 재사용해 `terms.ko.md`를 파싱하고, 영어
  용어와 키(앵커/제목)로 매칭하여 `termKo`/`defKo`를 붙인다.

### 4.2 런타임 레이어 — `site/i18n.js` (신규)

모든 페이지가 공유하는 작은 스크립트. 전역 `window.AIFSi18n`을 노출한다.

```js
window.AIFSi18n = {
  getLang(),          // 'en' | 'ko'  ← siteLang(localStorage) → ?lang= → 'en'
  setLang(lang),      // 저장 + <html lang> 갱신 + 'aifs:langchange' 이벤트 발생
  t(key),             // UI 라벨 조회, 없으면 key 그대로 반환
  pick(obj, field),   // ko면 obj[field+'Ko'] ?? obj[field], 아니면 obj[field]
}
```

- `UI = { en: {...}, ko: {...} }` 하드코딩 라벨 테이블 포함. 키 예: `loading`,
  `learningObjectives`, `quizPre`, `quizMid`, `quizPost`, `quiz`, `phase`,
  검색 placeholder, catalog/prereqs/glossary 헤더 등.
- **언어 상태 단일 키 `siteLang`로 통일.** 첫 로드 시 기존 `lessonLang` 값이 있고
  `siteLang`가 없으면 `lessonLang` → `siteLang` 1회 마이그레이션(기존 선택 유지).
- `setLang`이 `aifs:langchange` CustomEvent를 발생시키고, 각 페이지의 재렌더
  함수가 이를 구독해 갱신한다.
- `?lang=ko|en` 쿼리는 1회 override로 동작(현 lesson.html 동작과 동일).

### 4.3 토글 UI

- **index / catalog / prereqs / glossary**: 각 페이지 헤더의 `#themeToggle` 버튼
  **바로 앞에** `한` 토글 버튼(`id="langToggle"`, class `theme-toggle`)을 추가.
  lesson.html의 마크업을 그대로 따른다.
- 4개 페이지의 `<script>` 블록에 `data.js` 다음으로 `i18n.js`를 로드.
- **lesson.html**: 이미 `#langToggle` 존재. 핸들러를 `AIFSi18n.setLang`/`siteLang`
  공용 경로로 변경해 다른 페이지와 상태를 공유(현재는 `lessonLang` 단독 사용).
- 버튼 라벨/aria는 현재 언어에 따라 갱신(`한` ↔ `EN`).

### 4.4 페이지별 연동

- **index.html (랜딩 카피)**: 번역 대상 텍스트 노드에 `data-i18n="key"`를 부여하고
  i18n.js의 `UI.ko`에 README.ko.md 문구를 매핑. 로드/언어변경 시 `[data-i18n]`
  요소의 텍스트를 `t(key)`로 교체. (히어로 제목·소개 3문단·통계 라벨·CTA·푸터)
- **app.js (Contents 그리드 / 통계)**: 페이즈·레슨 렌더 시 `name`/`summary` 대신
  `AIFSi18n.pick(p,'name')` 등을 사용. `aifs:langchange` 구독해 재렌더.
- **lesson.html (사이드바·UI 라벨)**: 사이드바 `"Phase NN · <name>"`을 `pick`으로,
  `"Loading lesson…"`·`"Learning Objectives"`·퀴즈 라벨 등을 `t()`로 교체.
- **catalog.html / prereqs.html**: 헤더·라벨을 `t()`로, 데이터 목록을 `pick()`으로.
- **glossary.html**: 용어 목록 렌더를 `pick(term,'term')`/`pick(term,'def')`로,
  검색 placeholder·헤더를 `t()`로.

### 4.5 용어집 번역 — `glossary/terms.ko.md` (신규)

- `terms.md`(83개 용어, `### 용어` + 본문 구조)를 동일 포맷으로 한국어 번역.
- 번역 컨벤션(메모리 `ko-translation-convention`)을 따른다: 기술 용어는
  `한글(English)` 병기, 톤·구조 일관.
- build.js가 `terms.md`와 `terms.ko.md`를 제목/순서로 매칭해 `termKo`/`defKo` 생성.

## 5. 데이터 흐름

1. (빌드) `node site/build.js` → README.md/README.ko.md + en.md/ko.md +
   terms.md/terms.ko.md 파싱 → 영어+한국어 필드가 든 `data.js` 생성.
2. (런타임) 페이지 로드 → `i18n.js`가 `getLang()` 결정 → `<html lang>` 설정 →
   `[data-i18n]` 라벨 적용 → 데이터 섹션이 `pick()`으로 언어별 렌더.
3. (토글) `한`/`EN` 클릭 → `setLang()` → 저장 + `aifs:langchange` → 라벨 재적용 +
   데이터 섹션 재렌더. 페이지 이동해도 `siteLang` 유지.

## 6. 폴백 & 엣지 케이스

- 한국어 필드 누락(미번역 레슨/용어) → `pick()`이 영어로 폴백.
- `localStorage` 비활성 → 메모리 기본값 `en`, 토글은 세션 한정 동작.
- 기존 `lessonLang` 사용자 → `siteLang`로 1회 마이그레이션.
- 캐시 무효화: 변경된 정적 파일의 `?v=` 쿼리 갱신(현행 관례 유지).

## 7. 검증

- `node site/build.js` 재실행 → data.js에 `nameKo`/`summaryKo`/`keywordsKo`/
  `descKo`/`termKo`/`defKo`가 채워졌는지 spot-check.
- 로컬 정적 서버(`python3 -m http.server`)로 5개 페이지 각각 한↔영 토글 확인:
  - index 랜딩 카피·Contents 그리드 / lesson 사이드바·본문·UI 라벨·퀴즈 /
    catalog / prereqs / glossary 용어 목록.
- 언어 선택이 페이지 이동 후에도 유지되는지(`siteLang`) 확인.
- 미번역 항목이 영어로 폴백되는지(깨짐 없음) 확인.

## 8. 변경 파일 요약

- 수정: `site/build.js`, `site/data.js`(생성물), `site/app.js`, `site/index.html`,
  `site/catalog.html`, `site/prereqs.html`, `site/glossary.html`, `site/lesson.html`
- 신규: `site/i18n.js`, `glossary/terms.ko.md`
