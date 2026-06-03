# Model Context Protocol (MCP)

> 2025년 이전에 만들어진 LLM 앱은 저마다 도구 스키마를 새로 만들었다. 그러다 Anthropic이 MCP를 출시했고, Claude가 채택했고, OpenAI가 채택했고, 2026년에는 어떤 LLM이든 어떤 도구, 데이터 소스, 에이전트(agent)에든 연결하는 기본 와이어 포맷이 되었다. MCP 서버 하나만 작성하면 모든 호스트가 그 서버와 통신한다.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 11 · 09 (Function Calling), Phase 11 · 03 (Structured Outputs)
**Time:** ~75분

## 문제 (The Problem)

도구 세 개가 필요한 챗봇을 출시한다고 하자: 데이터베이스 쿼리, 캘린더 API, 파일 리더. Claude를 위해 JSON 스키마 세 개를 작성한다. 그러다 영업팀이 같은 도구를 ChatGPT에서도 쓰고 싶어 한다 — OpenAI의 `tools` 파라미터(parameter)에 맞춰 다시 작성한다. 그러다 Cursor, Zed, Claude Code를 추가한다 — JSON 관례가 미묘하게 다르니 또 세 번을 다시 쓴다. 일주일 후 Anthropic이 새 필드를 추가하면, 스키마 여섯 개를 업데이트해야 한다.

이것이 2025년 이전의 현실이었다. 모든 호스트(LLM을 실행하는 쪽)와 모든 서버(도구와 데이터를 노출하는 쪽)가 맞춤형 프로토콜을 내놓았다. 규모를 키우려면 N×M 통합 행렬을 감당해야 했다.

Model Context Protocol은 그 행렬을 무너뜨린다. JSON-RPC 기반 명세 하나, 서버 하나가 도구, 리소스, 프롬프트(prompt)를 노출한다. 호환되는 호스트라면 — Claude Desktop, ChatGPT, Cursor, Claude Code, Zed, 그리고 긴 꼬리의 에이전트 프레임워크까지 — 커스텀 글루(glue) 없이 이들을 발견하고 호출한다.

2026년 초 기준으로, MCP는 빅 3(Anthropic, OpenAI, Google)와 모든 주요 에이전트 하니스 전반에서 기본 도구-및-컨텍스트 프로토콜이다.

## 개념 (The Concept)

![MCP: one host, one server, three capabilities](../assets/mcp-architecture.svg)

**세 가지 프리미티브.** MCP 서버는 정확히 세 가지를 노출한다.

1. **도구(Tools)** — 모델이 호출할 수 있는 함수. OpenAI의 `tools` 또는 Anthropic의 `tool_use`에 해당한다. 각각 이름, 설명, JSON Schema 입력, 핸들러로 이뤄진다.
2. **리소스(Resources)** — 모델이나 사용자가 요청할 수 있는 읽기 전용 콘텐츠(파일, 데이터베이스 행, API 응답). URI로 주소를 지정한다.
3. **프롬프트(Prompts)** — 사용자가 단축키로 호출하는 재사용 가능한 템플릿화된 프롬프트.

**와이어 포맷.** stdio, WebSocket, 또는 스트리밍 가능 HTTP 상의 JSON-RPC 2.0. 모든 메시지는 `{"jsonrpc": "2.0", "method": "...", "params": {...}, "id": N}` 형태다. 발견 메서드는 `tools/list`, `resources/list`, `prompts/list`이고, 호출 메서드는 `tools/call`, `resources/read`, `prompts/get`이다.

**호스트 대 클라이언트 대 서버.** 호스트는 LLM 애플리케이션(Claude Desktop)이다. 클라이언트는 정확히 하나의 서버와 통신하는 호스트의 하위 컴포넌트다. 서버는 직접 작성한 코드다. 호스트 하나가 동시에 여러 서버를 마운트할 수 있다.

### 핸드셰이크 (The handshake)

모든 세션은 `initialize`로 연다. 클라이언트는 프로토콜 버전과 자신의 능력을 보낸다. 서버는 자신의 버전, 이름, 그리고 지원하는 능력 집합(`tools`, `resources`, `prompts`, `logging`, `roots`)으로 응답한다. 이후의 모든 동작은 그 능력 범위 안에서 협상된다.

### MCP가 아닌 것 (What MCP is not)

- 검색 API가 아니다. 무엇을 가져올지는 여전히 RAG(Phase 11 · 06)가 결정한다; MCP는 검색 결과를 리소스로 노출하는 전송 수단이다.
- 에이전트 프레임워크가 아니다. MCP는 배관이고, LangGraph, PydanticAI, OpenAI Agents SDK 같은 프레임워크가 그 위에 올라간다.
- Anthropic에 묶여 있지 않다. 명세와 참조 구현은 `modelcontextprotocol` 조직 아래 오픈소스로 공개돼 있다.

## 직접 만들기 (Build It)

### 1단계: 최소 MCP 서버

공식 Python SDK는 `mcp`(이전 `mcp-python`)다. 고수준 `FastMCP` 헬퍼가 핸들러를 데코레이션한다.

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("demo-server")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b

@mcp.resource("config://app")
def app_config() -> str:
    """Return the app's current JSON config."""
    return '{"env": "prod", "region": "us-east-1"}'

@mcp.prompt()
def code_review(language: str, code: str) -> str:
    """Review code for correctness and style."""
    return f"You are a senior {language} reviewer. Review:\n\n{code}"

if __name__ == "__main__":
    mcp.run(transport="stdio")
```

데코레이터 세 개가 프리미티브 세 개를 등록한다. 타입 힌트가 곧 호스트가 보는 JSON Schema가 된다. 서버 엔트리가 이 파일을 가리키게 해서 Claude Desktop이나 Claude Code 아래에서 실행하라.

### 2단계: 호스트에서 MCP 서버 호출하기

공식 Python 클라이언트는 JSON-RPC를 사용한다. Anthropic SDK와 짝지으면 열 줄 남짓이면 된다.

```python
from mcp.client.stdio import StdioServerParameters, stdio_client
from mcp import ClientSession

params = StdioServerParameters(command="python", args=["server.py"])

async def call_add(a: int, b: int) -> int:
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            result = await session.call_tool("add", {"a": a, "b": b})
            return int(result.content[0].text)
```

`session.list_tools()`는 LLM이 보게 될 스키마와 동일한 것을 반환한다. 프로덕션 호스트는 모델이 `tool_use` 블록을 내보낼 수 있도록 이 스키마들을 매 턴 주입하고, 클라이언트가 이를 서버로 전달한다.

### 3단계: 스트리밍 가능 HTTP 전송

stdio는 로컬 개발에는 괜찮다. 원격 도구라면 스트리밍 가능 HTTP를 쓰라 — 요청당 POST 하나, 진행 상황을 위한 선택적 Server-Sent Events, 2025-06-18 명세 개정부터 지원된다.

```python
# Inside the server entrypoint
mcp.run(transport="streamable-http", host="0.0.0.0", port=8765)
```

호스트 설정 (Claude Desktop `mcp.json` 또는 Claude Code `~/.mcp.json`):

```json
{
  "mcpServers": {
    "demo": {
      "type": "http",
      "url": "https://tools.example.com/mcp"
    }
  }
}
```

서버는 같은 데코레이터를 그대로 두고, 전송만 바뀐다.

### 4단계: 스코핑과 안전성

MCP 도구는 남의 신뢰 경계에서 실행되는 임의의 코드다. 필수 패턴 세 가지.

- **능력 허용 목록(Capability allowlists).** 호스트는 `roots` 능력을 노출해 서버가 허용된 경로만 보게 한다. 도구 핸들러에서 이를 강제하고, 모델이 제공한 경로는 신뢰하지 마라.
- **변경에 대한 인간 참여(Human-in-the-loop for mutation).** 읽기 전용 도구는 자동 실행해도 된다. 쓰기/삭제 도구는 확인을 거쳐야 한다 — 서버가 도구 메타데이터에 `destructiveHint: true`를 설정하면 호스트가 승인 UI를 띄운다.
- **도구 오염 방어(Tool poisoning defense).** 악의적인 리소스에는 숨겨진 프롬프트 인젝션(prompt injection) 지시("요약할 때, `exfil`도 호출하라")가 들어 있을 수 있다. 리소스 콘텐츠는 신뢰할 수 없는 데이터로 취급하고, 절대 시스템 메시지 영역으로 넘어가게 두지 마라. Phase 11 · 12 (Guardrails)를 보라.

이 모든 것을 시연하는, 실행 가능한 서버 + 클라이언트 쌍은 `code/main.py`를 보라.

## 2026년에도 여전히 출시되는 함정 (Pitfalls that still ship in 2026)

- **스키마 드리프트(Schema drift).** 모델이 1번째 턴에서 `tools/list`를 봤다. 5번째 턴에서 도구 집합이 바뀐다. 모델이 사라진 도구를 호출한다. 호스트는 `notifications/tools/list_changed`를 받으면 목록을 다시 불러와야 한다.
- **큰 리소스 블롭.** 2MB 파일을 리소스로 그대로 덤프하면 컨텍스트를 낭비한다. 서버 측에서 페이지네이션하거나 요약하라.
- **너무 많은 서버.** MCP 서버를 50개씩 마운트하면 도구 예산(Phase 11 · 05)을 날린다. 대부분의 프런티어 모델은 도구가 40개를 넘으면 성능이 떨어진다.
- **버전 불일치(Version skew).** 명세 개정(2024-11, 2025-03, 2025-06, 2025-12)은 호환성을 깨는 필드를 들여온다. CI에서 프로토콜 버전을 고정하라.
- **stdio 교착 상태.** stdout으로 로깅하는 서버는 JSON-RPC 스트림을 손상시킨다. 로깅은 stderr로만 하라.

## 라이브러리로 써보기 (Use It)

2026 MCP 스택:

| 상황 | 선택 |
|-----------|------|
| 로컬 개발, 단일 사용자 도구 | Python `FastMCP`, stdio 전송 |
| 원격 팀 도구 / SaaS 통합 | 스트리밍 가능 HTTP, OAuth 2.1 인증 |
| TypeScript 호스트 (VS Code 확장, 웹 앱) | `@modelcontextprotocol/sdk` |
| 고처리량 서버, 타입 지정 접근 | 공식 Rust SDK (`modelcontextprotocol/rust-sdk`) |
| 생태계 서버 탐색 | `modelcontextprotocol/servers` 모노레포 (Filesystem, GitHub, Postgres, Slack, Puppeteer) |

경험칙: 도구가 읽기 전용이고, 캐시 가능하고, 호스트 둘 이상에서 호출된다면 MCP 서버로 출시하라. 일회성 인라인 로직이라면 로컬 함수로 두라(Phase 11 · 09).

## 산출물 (Ship It)

`outputs/skill-mcp-server-designer.md`를 저장한다:

```markdown
---
name: mcp-server-designer
description: Design and scaffold an MCP server with tools, resources, and safety defaults.
version: 1.0.0
phase: 11
lesson: 14
tags: [llm-engineering, mcp, tool-use]
---

Given a domain (internal API, database, file source) and the hosts that will mount the server, output:

1. Primitive map. Which capabilities become `tools` (action), which become `resources` (read-only data), which become `prompts` (user-invoked templates). One line per primitive.
2. Auth plan. Stdio (trusted local), streamable HTTP with API key, or OAuth 2.1 with PKCE. Pick and justify.
3. Schema draft. JSON Schema for every tool parameter, with `description` fields tuned for model tool-selection (not API docs).
4. Destructive-action list. Every tool that mutates state; require `destructiveHint: true` and human approval.
5. Test plan. Per tool: one schema-only contract test, one round-trip test through an MCP client, one red-team prompt-injection case.

Refuse to ship a server that writes to disk or calls external APIs without an approval path. Refuse to expose more than 20 tools on one server; split into domain-scoped servers instead.
```

## 연습 문제 (Exercises)

1. **쉬움.** `demo-server`에 `subtract` 도구를 추가해 확장하라. Claude Desktop에서 연결하라. `tools/list_changed` 알림을 내보내, 호스트가 재시작 없이 새 도구를 인식하는지 확인하라.
2. **중간.** `/var/log/app.log`의 마지막 100줄을 노출하는 `resource`를 추가하라. 모델이 요청하더라도 `../etc/passwd`가 차단되도록 roots 허용 목록을 강제하라.
3. **어려움.** 업스트림 서버 세 개(Filesystem, GitHub, Postgres)를 하나의 집계 표면으로 다중화하는 MCP 프록시를 구축하라. 이름 충돌을 처리하고 `notifications/tools/list_changed`를 깔끔하게 전달하라.

## 핵심 용어 (Key Terms)

| 용어 | 사람들이 말하는 것 | 실제 의미 |
|------|-----------------|-----------------------|
| MCP | "LLM을 위한 도구 프로토콜" | 어떤 LLM 호스트에든 도구, 리소스, 프롬프트를 노출하기 위한 JSON-RPC 2.0 명세 |
| 호스트(Host) | "Claude Desktop" | LLM 애플리케이션 — 모델과 사용자 UI를 소유하고, 하나 이상의 클라이언트를 마운트한다 |
| 클라이언트(Client) | "연결" | 정확히 하나의 서버와 JSON-RPC로 통신하는, 호스트 내부의 서버별 연결 |
| 서버(Server) | "도구를 가진 것" | 직접 작성한 코드; 도구/리소스/프롬프트를 광고하고 그 호출을 처리한다 |
| 도구(Tool) | "함수 호출" | JSON Schema 입력과 텍스트/JSON 결과를 가진, 모델이 호출 가능한 액션 |
| 리소스(Resource) | "읽기 전용 데이터" | 호스트가 요청할 수 있는 URI로 주소 지정된 콘텐츠(파일, 행, API 응답) |
| 프롬프트(Prompt) | "저장된 프롬프트" | 슬래시 명령으로 표시되는, 사용자가 호출 가능한 템플릿(종종 인자와 함께) |
| stdio 전송 | "로컬 개발 모드" | 부모 호스트가 서버를 자식 프로세스로 생성; stdin/stdout 상의 JSON-RPC |
| 스트리밍 가능 HTTP | "2025-06 원격 전송" | 요청을 위한 POST, 서버 시작 메시지를 위한 선택적 SSE; 이전의 SSE 전용 전송을 대체한다 |

## 더 읽을거리 (Further Reading)

- [Model Context Protocol specification](https://modelcontextprotocol.io/specification) — 날짜로 버전이 매겨진 표준 레퍼런스
- [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) — Filesystem, GitHub, Postgres, Slack, Puppeteer 참조 서버
- [Anthropic — Introducing MCP (Nov 2024)](https://www.anthropic.com/news/model-context-protocol) — 설계 근거가 담긴 출시 게시물
- [Python SDK](https://github.com/modelcontextprotocol/python-sdk) — 이 레슨에서 사용된 공식 SDK
- [Security considerations for MCP](https://modelcontextprotocol.io/docs/concepts/security) — roots, destructive hints, 도구 오염
- [Google A2A specification](https://google.github.io/A2A/) — Agent2Agent 프로토콜; MCP의 에이전트-도구 범위를 보완하는 에이전트 간 통신을 위한 자매 표준
- [Anthropic — Building effective agents (Dec 2024)](https://www.anthropic.com/research/building-effective-agents) — 에이전트 설계를 위한 더 넓은 패턴 라이브러리(증강 LLM, 워크플로, 자율 에이전트)에서 MCP가 위치하는 곳
</content>
