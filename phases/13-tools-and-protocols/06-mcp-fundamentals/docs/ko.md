# MCP 기초 — 기본 요소, 생명 주기, JSON-RPC 베이스

> MCP 이전의 모든 통합은 일회성이었다. Model Context Protocol은 2024년 11월 Anthropic이 처음 출시했고 이제 Linux Foundation의 Agentic AI Foundation이 관리하며, 어떤 클라이언트든 어떤 서버와 대화할 수 있도록 탐색(discovery)과 호출을 표준화한다. 2025-11-25 명세는 여섯 가지 기본 요소(primitive)(서버 셋, 클라이언트 셋), 3단계 생명 주기(lifecycle), 그리고 JSON-RPC 2.0 와이어 형식(wire format)에 이름을 붙인다. 그것들을 배우면 이 phase의 나머지 MCP 챕터는 그냥 읽는 일이 된다.

**Type:** Learn
**Languages:** Python (stdlib, JSON-RPC parser)
**Prerequisites:** Phase 13 · 01 through 05 (the tool interface and function calling)
**Time:** ~45분

## 학습 목표 (Learning Objectives)

- 여섯 가지 MCP 기본 요소(서버의 tools, resources, prompts; 클라이언트의 roots, sampling, elicitation)를 모두 명명하고 각각 하나의 사용 사례를 들기.
- 3단계 생명 주기(initialize, operation, shutdown)를 따라가며 각 단계에서 누가 어떤 메시지를 보내는지 진술하기.
- JSON-RPC 2.0 요청, 응답, 알림(notification) 봉투(envelope)를 파싱하고 내보내기.
- `initialize`에서의 능력 협상(capability negotiation)이 무엇이며 그것 없이는 무엇이 깨지는지 설명하기.

## 문제 (The Problem)

MCP 이전에는 도구를 쓰는 모든 에이전트가 자신만의 프로토콜을 가졌다. Cursor는 MCP 형태이지만 호환되지 않는 도구 시스템을 가졌다. Claude Desktop은 다른 것을 갖고 출시되었다. VS Code의 Copilot 확장은 세 번째 것을 가졌다. "Postgres 쿼리" 도구를 만든 팀은 같은 도구를 세 번 작성했는데, 각각 다른 호스트의 API에 맞췄다. 그것을 재사용하려면 코드를 복사해야 했다.

그 결과는 일회성 통합의 캄브리아기 대폭발과 생태계 속도의 천장이었다.

MCP는 와이어 형식을 표준화하여 이를 고친다. 단일 MCP 서버가 모든 MCP 클라이언트에서 동작한다. Claude Desktop, ChatGPT, Cursor, VS Code, Gemini, Goose, Zed, Windsurf, 2026년 4월까지 300개 이상의 클라이언트. 월 1.1억 SDK 다운로드. 1만 개 이상의 공개 서버. Linux Foundation이 2025년 12월 새로운 Agentic AI Foundation 아래에서 관리를 맡았다.

이 phase에서 사용하는 명세 개정판은 **2025-11-25**다. 그것은 비동기 Tasks(SEP-1686), URL 모드 elicitation(SEP-1036), 도구를 사용한 sampling(SEP-1577), 증분 스코프 동의(SEP-835), 그리고 OAuth 2.1 리소스 지시자(resource-indicator) 의미론을 추가한다. Phase 13 · 09부터 16까지가 그 확장을 다룬다. 이 레슨은 베이스에서 멈춘다.

## 개념 (The Concept)

### 세 가지 서버 기본 요소

1. **Tools.** 호출 가능한 행동. Phase 13 · 01과 동일한 4단계 루프.
2. **Resources.** 노출된 데이터. URI로 주소 지정 가능한 읽기 전용 콘텐츠. `file:///path`, `db://query/...`, 커스텀 스킴(scheme).
3. **Prompts.** 재사용 가능한 템플릿. 호스트 UI의 슬래시 명령(slash-command). 서버가 템플릿을 공급하고, 클라이언트가 인자를 채운다.

### 세 가지 클라이언트 기본 요소

4. **Roots.** 서버가 건드리도록 허용된 URI의 집합. 클라이언트가 선언하고, 서버가 존중한다.
5. **Sampling.** 서버가 클라이언트의 모델에게 완성(completion)을 수행하도록 요청한다. 서버 측 API 키 없이 서버가 호스팅하는 에이전트 루프를 가능하게 한다.
6. **Elicitation.** 서버가 흐름 도중에 클라이언트의 사용자에게 구조화된 입력을 요청한다. 폼(form) 또는 URL(SEP-1036).

MCP의 모든 능력은 이 여섯 중 정확히 하나에 속한다. Phase 13 · 10부터 14까지가 각각을 깊이 다룬다.

### 와이어 형식: JSON-RPC 2.0

모든 메시지는 다음 필드를 가진 JSON 객체다.

- 요청: `{jsonrpc: "2.0", id, method, params}`.
- 응답: `{jsonrpc: "2.0", id, result | error}`.
- 알림: `{jsonrpc: "2.0", method, params}` — `id` 없음, 응답이 기대되지 않음.

베이스 명세는 기본 요소별로 그룹화된 약 15개 메서드를 가진다. 중요한 것들:

- `initialize` / `initialized` (핸드셰이크)
- `tools/list`, `tools/call`
- `resources/list`, `resources/read`, `resources/subscribe`
- `prompts/list`, `prompts/get`
- `sampling/createMessage` (서버-대-클라이언트)
- `notifications/tools/list_changed`, `notifications/resources/updated`, `notifications/progress`

### 3단계 생명 주기

**1단계: initialize.**

클라이언트가 자신의 `capabilities`와 `clientInfo`와 함께 `initialize`를 보낸다. 서버는 자신의 `capabilities`, `serverInfo`, 그리고 자신이 구사하는 명세 버전으로 응답한다. 클라이언트는 응답을 소화하면 `notifications/initialized`를 보낸다. 이제부터, 협상된 능력에 따라 어느 쪽이든 요청을 보낼 수 있다.

**2단계: operation.**

양방향. 클라이언트는 탐색을 위해 `tools/list`를 호출한 뒤, 호출을 위해 `tools/call`을 호출한다. 서버는 그 능력을 선언했다면 `sampling/createMessage`를 보낼 수 있다. 서버는 자신의 도구 집합이 변형되면 `notifications/tools/list_changed`를 보낼 수 있다. 클라이언트는 사용자가 루트 스코프(root scope)를 바꾸면 `notifications/roots/list_changed`를 보낼 수 있다.

**3단계: shutdown.**

어느 쪽이든 전송(transport)을 닫는다. MCP에는 구조화된 종료 메서드가 없다. 전송(stdio 또는 Streamable HTTP, Phase 13 · 09)이 연결 종료 신호를 운반한다.

### 능력 협상 (Capability negotiation)

`initialize` 핸드셰이크의 `capabilities`가 계약이다. 서버의 예시:

```json
{
  "tools": {"listChanged": true},
  "resources": {"subscribe": true, "listChanged": true},
  "prompts": {"listChanged": true}
}
```

서버는 `tools/list_changed` 알림을 내보낼 수 있고 `resources/subscribe`를 지원한다고 선언한다. 클라이언트는 자신의 것을 선언하여 동의한다.

```json
{
  "roots": {"listChanged": true},
  "sampling": {},
  "elicitation": {}
}
```

클라이언트가 `sampling`을 선언하지 않으면, 서버는 `sampling/createMessage`를 호출해서는 안 된다. 대칭적이다. 서버가 `resources.subscribe`를 선언하지 않으면, 클라이언트는 구독을 시도해서는 안 된다.

이것이 생태계 표류(drift)를 막는 것이다. sampling을 지원하지 않는 클라이언트도 여전히 유효한 MCP 클라이언트이고, `sampling`을 호출하지 않는 서버도 여전히 유효한 MCP 서버다. 단지 그 기능을 함께 사용하지 않을 뿐이다.

### 구조화된 콘텐츠와 오류 형태

`tools/call`은 타입 지정 블록의 `content` 배열을 반환한다. `text`, `image`, `resource`. Phase 13 · 14는 그 목록에 MCP Apps(`ui://` 대화형 UI)를 추가한다.

오류는 JSON-RPC 오류 코드를 사용한다. 명세가 정의한 추가 사항: `-32002` "Resource not found", `-32603` "Internal error", 그리고 `error.data`로서의 MCP 전용 오류 데이터.

### 클라이언트 능력 대 도구 호출 세부 사항

흔한 혼동: `capabilities.tools`는 클라이언트가 도구 목록 변경 알림을 지원하는지에 관한 것이다. 클라이언트가 특정 도구를 호출할 것인지는 능력 플래그가 아니라 그 모델이 주도하는 런타임 선택이다. 능력 플래그는 명세 수준의 계약이다. 모델의 선택은 직교적(orthogonal)이다.

### 왜 REST가 아니라 JSON-RPC인가?

JSON-RPC 2.0(2010)은 가벼운 양방향 프로토콜이다. REST는 클라이언트가 시작한다. MCP는 서버가 시작하는 메시지(sampling, 알림)가 필요했으므로, 대칭적인 요청/응답 형태를 가진 JSON-RPC가 자연스럽게 들어맞았다. JSON-RPC는 또한 HTTP의 요청 형태를 재발명하지 않고 stdio와 WebSocket/Streamable HTTP 위에서 깔끔하게 합성된다.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 최소한의 JSON-RPC 2.0 파서와 이미터(emitter)를 제공한 뒤, `initialize` → `tools/list` → `tools/call` → `shutdown` 순서를 손으로 따라가며 모든 메시지를 출력한다. 실제 전송 없음. 그저 메시지 형태만. 각 봉투를 검증하려면 더 읽을거리에 링크된 명세와 비교하라.

볼 것:

- `initialize`는 능력을 양방향으로 선언한다. 응답은 `serverInfo`와 `protocolVersion: "2025-11-25"`를 가진다.
- `tools/list`는 `tools` 배열을 반환한다. 각 항목은 `name`, `description`, `inputSchema`를 가진다.
- `tools/call`은 `params.name`과 `params.arguments`를 사용한다.
- 응답 `content`는 `{type, text}` 블록의 배열이다.

## 산출물 (Ship It)

이 레슨은 `outputs/skill-mcp-handshake-tracer.md`를 만든다. MCP 클라이언트-서버 상호작용의 pcap 스타일 전사(transcript)가 주어지면, 이 스킬은 각 메시지에 어떤 기본 요소인지, 어떤 생명 주기 단계인지, 어떤 능력에 의존하는지 주석을 단다.

## 연습 문제 (Exercises)

1. `code/main.py`를 돌려라. 능력 협상이 일어나는 줄을 식별하고, 서버가 `tools.listChanged`를 선언하지 않았다면 무엇이 바뀔지 기술하라.

2. `notifications/progress`를 처리하도록 파서를 확장하라. 메시지 형태: `{method: "notifications/progress", params: {progressToken, progress, total}}`. 오래 걸리는 `tools/call`이 진행 중일 때 그것을 내보내고, 클라이언트 핸들러가 진행 막대(progress bar)를 표시할지 확인하라.

3. MCP 2025-11-25 명세를 처음부터 끝까지 읽어라 — 전체 문서는 약 80페이지다. 대부분의 서버가 필요로 하지 않는 능력 플래그 하나를 식별하라. 힌트: 리소스 구독과 관련 있다.

4. 가상의 "cron job" 기능이 속할 기본 요소를 종이에 스케치하라. (힌트: 서버는 클라이언트가 예약된 시간에 그것을 호출하기를 원한다. 여섯 기본 요소 중 어느 것도 오늘날 들어맞지 않는다.) MCP의 2026년 로드맵에 이를 위한 초안 SEP가 있다.

5. GitHub의 공개 MCP 서버에서 세션 로그 하나를 파싱하라. 요청 대 응답 대 알림 메시지를 세어라. 트래픽의 어느 비율이 생명 주기 대 operation인지 계산하라.

## 핵심 용어 (Key Terms)

| 용어 | 사람들이 하는 말 | 실제 의미 |
|------|----------------|------------------------|
| MCP | "Model Context Protocol" | 모델-대-도구 탐색과 호출을 위한 오픈 프로토콜 |
| 서버 기본 요소(Server primitive) | "서버가 노출하는 것" | tools(행동), resources(데이터), prompts(템플릿) |
| 클라이언트 기본 요소(Client primitive) | "클라이언트가 서버에게 쓰게 하는 것" | roots(스코프), sampling(LLM 콜백), elicitation(사용자 입력) |
| JSON-RPC 2.0 | "와이어 형식" | 대칭적인 요청/응답/알림 봉투 |
| `initialize` 핸드셰이크 | "능력 협상" | 첫 메시지 쌍. 서버와 클라이언트가 지원하는 기능을 선언한다 |
| `tools/list` | "탐색(Discovery)" | 클라이언트가 서버에게 현재 도구 집합을 묻는다 |
| `tools/call` | "호출(Invocation)" | 클라이언트가 서버에게 인자와 함께 도구를 실행하도록 요청한다 |
| `notifications/*_changed` | "변형 이벤트" | 서버가 클라이언트에게 자신의 기본 요소 목록이 바뀌었다고 알린다 |
| 콘텐츠 블록(Content block) | "타입 지정 결과" | 도구 결과 안의 `{type: "text" \| "image" \| "resource" \| "ui_resource"}` |
| SEP | "Spec Evolution Proposal" | 이름 붙은 초안 제안(예: 비동기 Tasks를 위한 SEP-1686) |

## 더 읽을거리 (Further Reading)

- [Model Context Protocol — Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — 표준 명세 문서
- [Model Context Protocol — Architecture concepts](https://modelcontextprotocol.io/docs/concepts/architecture) — 여섯 기본 요소 멘탈 모델
- [Anthropic — Introducing the Model Context Protocol](https://www.anthropic.com/news/model-context-protocol) — 2024년 11월 출시 게시물
- [MCP blog — First MCP anniversary](https://blog.modelcontextprotocol.io/posts/2025-11-25-first-mcp-anniversary/) — 1주년 회고와 2025-11-25 명세 변경
- [WorkOS — MCP 2025-11-25 spec update](https://workos.com/blog/mcp-2025-11-25-spec-update) — SEP-1686, 1036, 1577, 835, 1724 요약
