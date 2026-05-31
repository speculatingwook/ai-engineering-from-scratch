# MCP 리소스와 프롬프트 — 도구를 넘어선 컨텍스트 노출

> 도구(tool)가 MCP 관심의 90퍼센트를 가져간다. 나머지 두 서버 프리미티브(primitive)는 다른 문제를 푼다. 리소스(resource)는 읽기용 데이터를 노출하고, 프롬프트(prompt)는 재사용 가능한 템플릿을 슬래시 커맨드(slash-command)로 노출한다. 많은 서버는 읽기를 도구로 감싸는 대신 리소스를 써야 하고, 워크플로를 클라이언트 프롬프트에 하드코딩하는 대신 프롬프트를 써야 한다. 이 레슨은 그 결정 규칙을 명명하고 `resources/*`와 `prompts/*` 메시지를 따라간다.

**Type:** Build
**Languages:** Python (stdlib, resource + prompt handler)
**Prerequisites:** Phase 13 · 07 (MCP server)
**Time:** ~45분

## 학습 목표 (Learning Objectives)

- 주어진 도메인에서 어떤 기능을 도구, 리소스, 또는 프롬프트로 노출할지 결정하기.
- `resources/list`, `resources/read`, `resources/subscribe`를 구현하고 `notifications/resources/updated`를 처리하기.
- 인자 템플릿을 갖춘 `prompts/list`와 `prompts/get`을 구현하기.
- 호스트(host)가 프롬프트를 슬래시 커맨드로 노출할 때와 컨텍스트를 자동 주입할 때를 구분하기.

## 문제 (The Problem)

노트 앱을 위한 순진한 MCP 서버는 모든 것을 도구로 노출한다. `notes_read`, `notes_list`, `notes_search`. 이는 모든 데이터 접근을 모델 주도(model-driven) 도구 호출로 감싼다. 그 결과:

- 모델은 컨텍스트의 이득을 볼 수 있는 모든 질의마다 `notes_read`를 호출할지 결정해야 한다.
- 읽기 전용 콘텐츠는 구독(subscribe)하거나 호스트의 사이드 패널로 스트리밍할 수 없다.
- 클라이언트 UI(Claude Desktop의 리소스 첨부 패널, Cursor의 "Include file" 선택기)가 데이터를 노출할 수 없다.

올바른 분할은 이렇다. 데이터는 리소스로, 변경하거나 계산하는 동작은 도구로, 재사용 가능한 다단계 워크플로는 프롬프트로 노출한다. 각 프리미티브는 자신만의 UX 어포던스(affordance)와 접근 패턴을 가진다.

## 개념 (The Concept)

### 도구 vs 리소스 vs 프롬프트 — 결정 규칙

| 기능 | 프리미티브 |
|------------|-----------|
| 사용자가 데이터를 검색·필터링·변환하길 원함 | 도구 |
| 사용자가 호스트에 이 데이터를 컨텍스트로 포함시키길 원함 | 리소스 |
| 사용자가 다시 실행할 수 있는 템플릿화된 워크플로를 원함 | 프롬프트 |

지침: 관련된 모든 질의마다 호출하는 것이 모델에게 이득이면, 그것은 도구다. 대화에 첨부하는 것이 사용자에게 이득이면, 그것은 리소스다. 사용자가 재사용하고 싶은 단위가 다단계 워크플로 전체라면, 그것은 프롬프트다.

### 리소스

`resources/list`는 `{resources: [{uri, name, mimeType, description?}]}`를 반환한다. `resources/read`는 `{uri}`를 받아 `{contents: [{uri, mimeType, text | blob}]}`를 반환한다.

URI는 주소를 지정할 수 있는 무엇이든 될 수 있다:

- `file:///Users/alice/notes/mcp.md`
- `postgres://my-db/query/SELECT ...`
- `notes://note-14` (커스텀 스킴)
- `memory://session-2026-04-22/recent` (서버별)

`contents[]`는 텍스트와 바이너리를 모두 지원한다. 바이너리는 `mimeType`과 함께 base64로 인코딩된 문자열로 `blob`을 사용한다.

### 리소스 구독

capabilities에서 `{resources: {subscribe: true}}`를 선언한다. 클라이언트가 `resources/subscribe {uri}`를 호출한다. 서버는 리소스가 변경되면 `notifications/resources/updated {uri}`를 보낸다. 클라이언트는 다시 읽는다.

사용 사례: 리소스가 디스크 상의 파일인 노트 서버. 파일 워처(file watcher)가 업데이트 알림을 트리거하고, 호스트 외부에서 편집되면 Claude Desktop이 해당 파일을 다시 컨텍스트로 끌어온다.

### 리소스 템플릿 (2025-11-25 추가)

`resourceTemplates`는 매개변수화된 URI 패턴을 노출할 수 있게 한다. `id`를 완성(completion) 대상으로 하는 `notes://{id}`처럼. 클라이언트는 리소스 선택기에서 id를 자동 완성할 수 있다.

### 프롬프트

`prompts/list`는 `{prompts: [{name, description, arguments?}]}`를 반환한다. `prompts/get`은 `{name, arguments}`를 받아 `{description, messages: [{role, content}]}`를 반환한다.

프롬프트는 호스트가 자신의 모델에 공급하는 메시지 목록으로 채워지는 템플릿이다. 예를 들어 `code_review` 프롬프트는 `file_path` 인자를 받아 세 개의 메시지 시퀀스를 반환한다. 시스템 메시지, 파일 본문이 담긴 사용자 메시지, 그리고 추론 템플릿이 담긴 어시스턴트(assistant) 시작 메시지.

### 호스트와 프롬프트

Claude Desktop, VS Code, Cursor는 채팅 UI에서 프롬프트를 슬래시 커맨드로 노출한다. 사용자는 `/code_review`를 입력하고 폼에서 인자를 고른다. 서버의 프롬프트는 "사용자 단축키"와 "모델에 보내는 전체 프롬프트" 사이의 계약이다.

아직 모든 클라이언트가 프롬프트를 지원하지는 않는다. 기능 협상(capability negotiation)을 확인하라. 프롬프트 기능을 선언했지만 클라이언트가 프롬프트를 지원하지 않으면 슬래시 커맨드가 그냥 보이지 않는다.

### "list changed" 알림

리소스와 프롬프트 둘 다 집합이 변경되면 `notifications/list_changed`를 내보낸다. 방금 새 노트 20개를 가져온 노트 서버는 `notifications/resources/list_changed`를 내보내고, 클라이언트는 `resources/list`를 다시 호출해 추가분을 받아온다.

### 콘텐츠 타입 규약

텍스트: `mimeType: "text/plain"`, `text/markdown`, `application/json`.
바이너리: `image/png`, `application/pdf`, 그리고 `blob` 필드.
MCP 앱(Lesson 14): `ui://` URI 내의 `text/html;profile=mcp-app`.

### 동적 리소스

리소스 URI가 정적 파일에 대응할 필요는 없다. `notes://recent`는 매번 읽을 때마다 최신 다섯 개 노트를 반환할 수 있다. `db://query/users/active`는 매개변수화된 질의를 실행할 수 있다. 서버는 콘텐츠를 동적으로 계산할 자유가 있다.

규칙: 클라이언트가 URI로 캐시할 수 있으려면 URI가 안정적이어야 한다. 계산이 일회성이라면, 클라이언트 캐시가 오래되지 않도록 URI에 타임스탬프나 논스(nonce)를 포함해야 한다.

### 구독 vs 폴링

구독 가능한 클라이언트는 `notifications/resources/updated`를 통해 서버 푸시를 받는다. 구독 이전 클라이언트나 이를 지원하지 않는 호스트는 다시 읽어 폴링(poll)한다. 둘 다 사양을 준수한다. 서버의 기능 선언이 클라이언트에게 어느 것을 지원하는지 알려준다.

구독의 비용: 서버에서의 세션별 상태(누가 무엇을 구독하는지). 구독된 집합을 유한하게 유지하라. 연결이 끊긴 클라이언트는 타임아웃되어야 한다.

### 프롬프트 vs 시스템 프롬프트

MCP의 프롬프트는 시스템 프롬프트가 아니다. 호스트의 시스템 프롬프트(자신의 운영 지침)와 MCP 프롬프트(사용자가 호출하는 서버 제공 템플릿)는 나란히 존재한다. 잘 동작하는 클라이언트는 서버 프롬프트가 자신의 시스템 프롬프트를 덮어쓰도록 절대 허용하지 않는다. 둘을 계층화한다.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 Lesson 07의 노트 서버를 다음으로 확장한다:

- `resources/subscribe`를 지원하는 노트별 리소스(`notes://note-1` 등).
- 세 개의 메시지 템플릿으로 렌더링되는 `review_note` 프롬프트.
- 노트가 수정되면 `notifications/resources/updated`를 내보내는 파일 워처 시뮬레이션.
- 항상 최신 다섯 개 노트를 반환하는 `notes://recent` 동적 리소스.

전체 흐름을 보려면 데모를 실행한다.

## 산출물 (Ship It)

이 레슨은 `outputs/skill-primitive-splitter.md`를 만든다. 제안된 MCP 서버가 주어지면, 이 스킬은 각 기능을 근거와 함께 도구 / 리소스 / 프롬프트로 분류한다.

## 연습 문제 (Exercises)

1. `code/main.py`를 실행한다. 초기 리소스 목록을 관찰한 뒤, 노트 편집을 트리거하고 `notifications/resources/updated` 이벤트가 발생하는지 확인한다.

2. `resources/list_changed` 이미터(emitter)를 추가한다. 새 노트가 생성되면 클라이언트가 다시 발견하도록 알림을 보낸다.

3. GitHub MCP 서버를 위한 세 개의 프롬프트를 설계한다: `summarize_pr`, `triage_issue`, `release_notes`. 각각 인자 스키마를 갖춘다. 프롬프트 본문은 추가 편집 없이 실행 가능해야 한다.

4. Lesson 07 서버의 기존 도구 하나를 가져와 그것이 도구로 남아야 할지, 아니면 리소스와 도구 쌍으로 분할되어야 할지 분류한다. 한 문장으로 정당화한다.

5. 사양의 `server/resources`와 `server/prompts` 섹션을 읽는다. `resources/read`에서 거의 채워지지 않지만 사양이 지원하는 필드 하나를 식별한다. 힌트: 리소스 콘텐츠의 `_meta`를 보라.

## 핵심 용어 (Key Terms)

| 용어 | 흔히 말하는 것 | 실제 의미 |
|------|----------------|------------------------|
| 리소스(Resource) | "노출된 데이터" | 호스트가 읽을 수 있는 URI 주소 지정 가능 콘텐츠 |
| 리소스 URI | "데이터 포인터" | 스킴 접두사가 붙은 식별자(`file://`, `notes://` 등) |
| `resources/subscribe` | "변경 감시" | 특정 URI에 대한 클라이언트 옵트인 서버 푸시 업데이트 |
| `notifications/resources/updated` | "리소스 변경됨" | 구독한 리소스에 새 콘텐츠가 있다는 클라이언트 신호 |
| 리소스 템플릿 | "매개변수화된 URI" | 호스트 선택기를 위한 완성 힌트가 있는 URI 패턴 |
| 프롬프트(Prompt) | "슬래시 커맨드 템플릿" | 인자 슬롯이 있는 이름 붙은 다중 메시지 템플릿 |
| 프롬프트 인자 | "템플릿 입력" | 렌더링 전에 호스트가 수집하는 타입 지정 매개변수 |
| `prompts/get` | "템플릿 렌더링" | 서버가 채워진 메시지 목록을 반환 |
| 콘텐츠 블록 | "타입 지정 청크" | `{type: text \| image \| resource \| ui_resource}` |
| 슬래시 커맨드 UX | "사용자 단축키" | 호스트가 프롬프트를 `/`로 시작하는 커맨드로 노출 |

## 더 읽을거리 (Further Reading)

- [MCP — Concepts: Resources](https://modelcontextprotocol.io/docs/concepts/resources) — 리소스 URI, 구독, 템플릿
- [MCP — Concepts: Prompts](https://modelcontextprotocol.io/docs/concepts/prompts) — 프롬프트 템플릿과 슬래시 커맨드 통합
- [MCP — Server resources spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/resources) — 전체 `resources/*` 메시지 레퍼런스
- [MCP — Server prompts spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/prompts) — 전체 `prompts/*` 메시지 레퍼런스
- [MCP — Protocol info site: resources](https://modelcontextprotocol.info/docs/concepts/resources/) — 공식 문서를 확장한 커뮤니티 가이드
