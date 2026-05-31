# MCP 서버 만들기 — Python + TypeScript SDK

> 대부분의 MCP 튜토리얼은 stdio hello-world만 보여준다. 실제 서버는 tools 더하기 resources 더하기 prompts를 노출하고, 능력 협상(capability negotiation)을 처리하고, 구조화된 오류를 내보내고, SDK 전반에서 동일하게 동작한다. 이 레슨은 노트 서버를 종단 간(end-to-end)으로 만든다. stdlib stdio 전송(transport), JSON-RPC 디스패치(dispatch), 세 가지 서버 기본 요소(primitive), 그리고 당신이 졸업할 때 Python SDK의 FastMCP나 TypeScript SDK에 그대로 들어가는 순수 함수(pure-function) 스타일.

**Type:** Build
**Languages:** Python (stdlib, stdio MCP server)
**Prerequisites:** Phase 13 · 06 (MCP fundamentals)
**Time:** ~75분

## 학습 목표 (Learning Objectives)

- `initialize`, `tools/list`, `tools/call`, `resources/list`, `resources/read`, `prompts/list`, `prompts/get` 메서드를 구현하기.
- stdin에서 JSON-RPC 메시지를 읽고 stdout에 응답을 쓰는 디스패치 루프를 작성하기.
- JSON-RPC 2.0 명세와 MCP의 추가 코드에 따라 구조화된 오류 응답을 내보내기.
- 도구 로직을 다시 작성하지 않고 stdlib 구현을 FastMCP(Python SDK) 또는 TypeScript SDK로 졸업시키기.

## 문제 (The Problem)

원격 전송(Phase 13 · 09)이나 인증 계층(Phase 13 · 16)을 쓰기 전에, 깔끔한 로컬 서버가 필요하다. 로컬은 stdio를 뜻한다. 서버는 클라이언트에 의해 자식 프로세스(child process)로 생성되고, 메시지는 줄바꿈으로 구분되어(newline-delimited) stdin/stdout 위로 흐른다.

2025-11-25 명세는 stdio 메시지가 명시적 `\n` 구분자를 가진 JSON 객체로 인코딩되도록 규정한다. 여기에는 SSE가 없다. SSE는 옛 원격 모드였고 2026년 중반에 제거되고 있다(Atlassian의 Rovo MCP 서버는 2026년 6월 30일에, Keboola는 2026년 4월 1일에 그것을 폐기했다). stdio의 경우, 줄당 하나의 JSON 객체가 와이어 형식(wire format)의 전부다.

노트 서버는 세 가지 서버 기본 요소를 모두 연습시키기 때문에 좋은 형태다. Tools는 변경(mutation)을 한다(`notes_create`). Resources는 데이터를 노출한다(`notes://{id}`). Prompts는 템플릿을 제공한다(`review_note`). 이 레슨의 형태는 어떤 도메인으로든 일반화된다.

## 개념 (The Concept)

### 디스패치 루프

```
loop:
  line = stdin.readline()
  msg = json.loads(line)
  if has id:
    handle request -> write response
  else:
    handle notification -> no response
```

세 가지 규칙:

- JSON-RPC 봉투(envelope)가 아닌 어떤 것도 stdout에 출력하지 마라. 디버그 로그는 stderr로 간다.
- 모든 요청은 반드시 동일한 `id`를 운반하는 응답과 짝지어져야 한다.
- 알림(notification)에는 응답해서는 안 된다.

### `initialize` 구현

```python
def initialize(params):
    return {
        "protocolVersion": "2025-11-25",
        "capabilities": {
            "tools": {"listChanged": True},
            "resources": {"listChanged": True, "subscribe": False},
            "prompts": {"listChanged": False},
        },
        "serverInfo": {"name": "notes", "version": "1.0.0"},
    }
```

당신이 지원하는 것만 선언하라. 클라이언트는 기능을 게이트하기 위해 능력 집합에 의존한다.

### `tools/list`와 `tools/call` 구현

`tools/list`는 각 항목이 `name`, `description`, `inputSchema`를 가진 `{tools: [...]}`를 반환한다. `tools/call`은 `{name, arguments}`를 받아 `{content: [blocks], isError: bool}`를 반환한다.

콘텐츠 블록은 타입이 지정된다. 가장 흔한 것:

```json
{"type": "text", "text": "Found 2 notes"}
{"type": "resource", "resource": {"uri": "notes://14", "text": "..."}}
{"type": "image", "data": "<base64>", "mimeType": "image/png"}
```

도구 오류는 두 형태로 온다. 프로토콜 수준 오류(알 수 없는 메서드, 잘못된 params)는 JSON-RPC 오류다. 도구 수준 오류(유효한 호출이지만 도구가 실패함)는 `{content: [...], isError: true}`로 반환된다. 그것은 모델이 자신의 컨텍스트에서 실패를 보게 한다.

### resources 구현

Resources는 설계상 읽기 전용이다. `resources/list`는 매니페스트(manifest)를 반환하고, `resources/read`는 콘텐츠를 반환한다. URI는 `file://...`, `http://...`, 또는 `notes://` 같은 커스텀 스킴(scheme)일 수 있다.

데이터를 도구 대신 리소스로 노출할 때:

- 모델은 그것을 "호출"하지 않는다. 클라이언트가 사용자 요청 시 그것을 컨텍스트에 주입할 수 있다.
- 구독(subscription)은 리소스가 바뀔 때 서버가 업데이트를 푸시(push)하게 한다(Phase 13 · 10).
- Phase 13 · 14는 대화형 리소스를 위해 이것을 `ui://`로 확장한다.

### prompts 구현

Prompts는 이름 붙은 인자를 가진 템플릿이다. 호스트는 그것들을 슬래시 명령(slash-command)으로 드러낸다. `review_note` 프롬프트는 `note_id` 인자를 받아 클라이언트가 그 모델에 공급하는 다중 메시지 프롬프트 템플릿을 만들 수 있다.

### Stdio 전송의 미묘함

- 줄바꿈으로 구분된 JSON. 길이 접두사 프레이밍(length-prefixed framing) 없음.
- 버퍼링하지 마라. 각 쓰기 후 `sys.stdout.flush()`.
- 클라이언트가 수명을 제어한다. stdin이 닫히면(EOF), 깔끔하게 종료하라.
- SIGPIPE를 조용히 처리하지 마라. 로깅하고 종료하라.

### 주석 (Annotations)

각 도구는 안전 속성을 기술하는 `annotations`를 운반할 수 있다.

- `readOnlyHint: true` — 순수 읽기, 재시도해도 안전함.
- `destructiveHint: true` — 되돌릴 수 없는 부수 효과. 클라이언트가 확인해야 함.
- `idempotentHint: true` — 같은 입력이 같은 출력을 만듦.
- `openWorldHint: true` — 외부 시스템과 상호작용함.

클라이언트는 이것을 사용해 UX(확인 대화상자, 상태 표시기)와 라우팅(routing)(Phase 13 · 17)을 결정한다.

### 졸업 경로 (Graduation path)

`code/main.py`의 stdlib 서버는 약 180줄이다. FastMCP(Python)는 같은 로직을 데코레이터 스타일로 붕괴시킨다.

```python
from fastmcp import FastMCP
app = FastMCP("notes")

@app.tool()
def notes_search(query: str, limit: int = 10) -> list[dict]:
    ...
```

TypeScript SDK는 등가의 형태를 가진다. 졸업 경로는 당신이 준비되면 그대로 들어간다(drop-in). 개념(능력, 디스패치, 콘텐츠 블록)은 동일하다.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 stdio 위에서 stdlib만으로 만든 완전한 노트 MCP 서버다. 세 도구(`notes_list`, `notes_search`, `notes_create`)에 대한 `initialize`, `tools/list`, `tools/call`, 각 노트에 대한 `resources/list`와 `resources/read`, 그리고 `review_note` 프롬프트를 처리한다. JSON-RPC 메시지를 파이프(pipe)하여 구동할 수 있다.

```
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python main.py
```

볼 것:

- 디스패처는 메서드 이름을 키로 하는 `dict[str, Callable]`이다.
- 모든 도구 실행기(executor)는 맨 문자열이 아니라 콘텐츠 블록 목록을 반환한다.
- 실행기가 예외를 일으키면 `isError: true`가 설정된다.

## 산출물 (Ship It)

이 레슨은 `outputs/skill-mcp-server-scaffolder.md`를 만든다. 도메인(노트, 티켓, 파일, 데이터베이스)이 주어지면, 이 스킬은 올바른 tools / resources / prompts 분할과 SDK 졸업 경로를 가진 MCP 서버를 스캐폴딩(scaffold)한다.

## 연습 문제 (Exercises)

1. `code/main.py`를 돌리고 손으로 만든 JSON-RPC 메시지로 구동하라. `notes_create`를 연습한 뒤, `resources/read`로 새 노트를 검색하라.

2. `annotations: {destructiveHint: true}`를 가진 `notes_delete` 도구를 추가하라. 클라이언트가 확인 대화상자를 드러낼지 확인하라(이것은 실제 호스트가 필요하다. Claude Desktop이 동작한다).

3. 노트가 수정될 때마다 서버가 `notifications/resources/updated`를 푸시하도록 `resources/subscribe`를 구현하라. 킵얼라이브(keepalive) 작업을 추가하라.

4. 서버를 FastMCP로 포팅하라. Python 파일은 80줄 미만으로 줄어야 한다. 와이어 동작은 동일해야 한다. 같은 JSON-RPC 테스트 하니스(harness)로 검증하라.

5. 명세의 `server/tools` 섹션을 읽고 이 레슨의 서버에 구현되지 않은 도구 정의의 필드 하나를 식별하라. (힌트: 여러 개가 있다. 하나를 골라 추가하라.)

## 핵심 용어 (Key Terms)

| 용어 | 사람들이 하는 말 | 실제 의미 |
|------|----------------|------------------------|
| MCP 서버(MCP server) | "도구를 노출하는 것" | stdio나 HTTP 위로 MCP JSON-RPC를 구사하는 프로세스 |
| stdio 전송(stdio transport) | "자식 프로세스 모델" | 서버가 클라이언트에 의해 생성됨. stdin/stdout으로 통신 |
| 디스패처(Dispatcher) | "메서드 라우터" | JSON-RPC 메서드 이름에서 핸들러 함수로의 맵 |
| 콘텐츠 블록(Content block) | "도구 결과 청크" | 도구 응답의 `content` 배열 속 타입 지정 요소 |
| `isError` | "도구 수준 실패" | 도구가 실패했음을 알림. JSON-RPC 오류와 구별 |
| 주석(Annotations) | "안전 힌트" | readOnly / destructive / idempotent / openWorld 플래그 |
| FastMCP | "Python SDK" | MCP 프로토콜 위의 데코레이터 기반 상위 수준 프레임워크 |
| 리소스 URI(Resource URI) | "주소 지정 가능한 데이터" | 리소스를 식별하는 `file://`, `db://`, 또는 커스텀 스킴 |
| 프롬프트 템플릿(Prompt template) | "슬래시 명령 브리프" | 호스트 UI를 위한 인자 슬롯을 가진 서버 공급 템플릿 |
| 능력 선언(Capability declaration) | "기능 토글" | `initialize`에서 선언되는 기본 요소별 플래그 |

## 더 읽을거리 (Further Reading)

- [Model Context Protocol — Python SDK](https://github.com/modelcontextprotocol/python-sdk) — 레퍼런스 Python 구현
- [Model Context Protocol — TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) — 병렬 TS 구현
- [FastMCP — server framework](https://gofastmcp.com/) — MCP 서버를 위한 데코레이터 스타일 Python API
- [MCP — Quickstart server guide](https://modelcontextprotocol.io/quickstart/server) — 어느 SDK든 사용하는 종단 간 튜토리얼
- [MCP — Server tools spec](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) — tools/* 메시지에 대한 완전한 레퍼런스
