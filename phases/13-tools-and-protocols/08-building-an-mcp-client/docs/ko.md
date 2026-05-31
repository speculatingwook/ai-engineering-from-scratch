# MCP 클라이언트 만들기 — 탐색, 호출, 세션 관리

> 대부분의 MCP 콘텐츠는 서버 튜토리얼을 제공하고 클라이언트는 손짓으로 넘긴다. 어려운 오케스트레이션(orchestration)이 사는 곳은 클라이언트 코드다. 프로세스 생성(process spawning), 능력 협상(capability negotiation), 여러 서버에 걸친 도구 목록 병합, sampling 콜백, 재연결(reconnection), 그리고 네임스페이스 충돌 해소. 이 레슨은 세 개의 서로 다른 MCP 서버를 모델을 위한 하나의 평평한 도구 네임스페이스로 들어 올리는 다중 서버(multi-server) 클라이언트를 만든다.

**Type:** Build
**Languages:** Python (stdlib, multi-server MCP client)
**Prerequisites:** Phase 13 · 07 (building an MCP server)
**Time:** ~75분

## 학습 목표 (Learning Objectives)

- MCP 서버를 자식 프로세스(child process)로 생성하고, `initialize`를 완료하고, `notifications/initialized`를 보내기.
- 서버별 세션 상태(능력, 도구 목록, 마지막으로 본 알림 id)를 유지하기.
- 여러 서버에 걸친 도구 목록을 충돌 처리와 함께 하나의 네임스페이스로 병합하기.
- 도구 호출을 그것을 소유한 서버로 라우팅하고 응답을 재조립하기.

## 문제 (The Problem)

실제 에이전트 호스트(Claude Desktop, Cursor, Goose, Gemini CLI)는 여러 MCP 서버를 한꺼번에 로드한다. 사용자는 파일시스템 서버, Postgres 서버, GitHub 서버를 동시에 돌리고 있을 수 있다. 클라이언트의 일:

1. 각 서버를 생성한다.
2. 각각을 독립적으로 핸드셰이크한다.
3. 각각에 대해 `tools/list`를 호출하고 결과를 평탄화(flatten)한다.
4. 모델이 `notes_search`를 내보내면, 병합된 네임스페이스에서 그것을 찾아 올바른 서버로 라우팅한다.
5. 차단(block) 없이 어떤 서버로부터의 알림(`tools/list_changed`)을 처리한다.
6. 전송 실패 시 재연결한다.

그 모든 것을 손으로 만드는 것이 "장난감"과 "쓸 만한 것"을 가른다. 공식 SDK가 이것을 감싸지만, 멘탈 모델은 당신의 것이어야 한다.

## 개념 (The Concept)

### 자식 프로세스 생성

`stdin=PIPE, stdout=PIPE, stderr=PIPE`를 가진 `subprocess.Popen`. `bufsize=1`을 설정하고 줄 단위 읽기를 위해 텍스트 모드를 사용하라. 각 서버는 하나의 프로세스다. 클라이언트는 서버당 하나의 `Popen` 핸들을 보유한다.

### 서버별 세션 상태

서버당 하나의 `Session` 객체가 보유하는 것:

- `process` — Popen 핸들.
- `capabilities` — 서버가 `initialize`에서 선언한 것.
- `tools` — 마지막 `tools/list` 결과.
- `pending` — 요청 id에서 응답을 기다리는 promise/future로의 맵.

요청은 본질적으로 비동기다. 서버 B가 호출 도중일 때 서버 A로 보낸 `tools/call`은 차단되어서는 안 된다. 큐(queue)를 가진 스레드나 asyncio를 사용하라.

### 병합된 네임스페이스

클라이언트가 종합 도구 목록을 볼 때, 이름이 충돌할 수 있다. 두 서버가 둘 다 `search`를 노출할 수 있다. 클라이언트는 세 가지 선택지를 가진다.

1. **서버 이름으로 접두사.** `notes/search`, `files/search`. 명확하지만 보기 흉하다.
2. **조용한 선착순(first-come).** 나중 서버의 `search`가 앞의 것을 덮어쓴다. 위험하다. 충돌을 숨긴다.
3. **충돌 거부.** 두 번째 서버 로드를 거부한다. 사용자에게 알린다. 보안에 민감한 호스트에 가장 안전하다.

Claude Desktop은 서버별 접두사를 사용한다. Cursor는 명확한 오류와 함께 충돌 거부를 사용한다. VS Code MCP도 서버별 접두사를 채택한다.

### 라우팅 (Routing)

병합 후, 디스패치 테이블(dispatch table)이 `tool_name -> session`을 매핑한다. 모델이 이름으로 호출을 내보내면, 클라이언트가 세션을 찾아 그 서버의 stdin에 `tools/call` 메시지를 쓴 뒤, 응답을 기다린다.

### Sampling 콜백

서버가 `initialize`에서 `sampling` 능력을 선언했다면, 그것은 클라이언트에게 LLM을 돌리도록 요청하는 `sampling/createMessage`를 보낼 수 있다. 클라이언트는 반드시:

1. 샘플이 해결될 때까지 그 서버로의 추가 요청을 차단하거나, 그 구현이 동시성을 지원하면 파이프라인화한다.
2. 자신의 LLM 제공자(provider)를 호출한다.
3. 응답을 서버로 다시 보낸다.

레슨 11이 sampling을 종단 간으로 다룬다. 이 레슨은 완전성을 위해 그것을 스텁(stub)으로 둔다.

### 알림 처리

`notifications/tools/list_changed`는 `tools/list`를 다시 호출하라는 뜻이다. `notifications/resources/updated`는 리소스가 사용 중이면 그것을 다시 읽으라는 뜻이다. 알림은 응답을 만들어서는 안 된다 — 그것들을 ack(확인 응답)하려 하지 마라.

흔한 클라이언트 버그: 알림이 스트림에 앉아 있는 동안 `tools/call`에서 읽기 루프를 차단하는 것. 모든 메시지를 큐에 밀어 넣는 백그라운드 리더 스레드(background reader thread)를 사용하라. 메인 스레드가 큐에서 꺼내 디스패치한다.

### 재연결 (Reconnection)

전송은 실패할 수 있다. 서버가 충돌했거나, OS가 프로세스를 죽였거나, stdio 파이프가 깨졌다. 클라이언트는 stdout에서 EOF를 감지하고 세션을 죽은 것으로 취급한다. 선택지:

- 조용히 서버를 재시작하고 다시 핸드셰이크한다. 순수 읽기 전용 서버에 괜찮다.
- 실패를 사용자에게 드러낸다. 사용자에게 보이는 세션을 가진 상태 유지(stateful) 서버에 괜찮다.

Phase 13 · 09는 Streamable HTTP 재연결 의미론을 다룬다. stdio는 더 간단하다.

### 킵얼라이브와 세션 id

Streamable HTTP는 `Mcp-Session-Id` 헤더를 사용한다. Stdio에는 세션 id가 없다 — 프로세스 정체성이 곧 세션이다. 킵얼라이브(keepalive) 핑은 선택적이다. stdio 파이프는 비활성 상태에서 깨지지 않는다.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 세 시뮬레이션된 MCP 서버를 서브프로세스(subprocess)로 생성하고, 각각을 핸드셰이크하고, 그 도구 목록을 병합하고, 도구 호출을 올바른 서버로 라우팅한다. 그 "서버들"은 사실 장난감 응답기(toy responder)를 돌리는 다른 Python 프로세스다(실제 LLM 없음). 다음을 보려면 돌려라.

- 세 번의 초기화, 각각 자신만의 능력 집합과 함께.
- 7개 도구 네임스페이스로 병합된 세 `tools/list` 결과.
- 도구 이름에 기반한 라우팅 결정.
- 네임스페이스 접두사로 방지된 충돌.

볼 것:

- `Session` 데이터클래스(dataclass)가 서버별 상태를 깔끔하게 보유한다.
- 백그라운드 리더 스레드가 메인 스레드를 차단하지 않고 stdout의 모든 줄을 큐에서 꺼낸다.
- 디스패치 테이블은 간단한 `dict[str, Session]`이다.
- 충돌 처리는 명시적이다. 두 서버가 같은 이름을 선언하면, 나중 것이 접두사로 이름이 바뀐다.

## 산출물 (Ship It)

이 레슨은 `outputs/skill-mcp-client-harness.md`를 만든다. MCP 서버의 선언적 목록(이름, 명령, 인자)이 주어지면, 이 스킬은 그것들을 생성하고, 도구 목록을 병합하고, 충돌 해소를 갖춘 라우팅 함수를 제공하는 하니스(harness)를 만든다.

## 연습 문제 (Exercises)

1. `code/main.py`를 돌리고 서버 생성 로그를 보라. 시뮬레이션된 서버 프로세스 중 하나를 SIGTERM으로 죽이고, 클라이언트가 EOF를 감지하고 그 세션을 죽은 것으로 표시하는 방식을 관찰하라.

2. 네임스페이스 접두사를 구현하라. 두 서버가 `search`를 노출하면, 두 번째를 `<server>/search`로 이름을 바꿔라. 디스패치 테이블을 업데이트하고 도구 호출이 올바르게 라우팅되는지 검증하라.

3. 서버 재시작을 위한 연결 풀 스타일 백오프(backoff)를 추가하라. 연속 실패에 대한 지수 백오프(exponential backoff), 30초에서 상한, 세 번 실패 후 사용자에게 알림 내보내기.

4. 100개의 동시 MCP 서버를 지원하는 클라이언트를 스케치하라. 간단한 디스패치 dict를 무엇이 대체하는가? (힌트: 접두사 네임스페이싱을 위한 트라이(trie), 더하기 서버당 도구 수 지표.)

5. 클라이언트를 공식 MCP Python SDK로 포팅하라. SDK는 `stdio_client`와 `ClientSession`을 감싼다. 코드는 다중 서버 라우팅을 보존하면서 약 200줄에서 약 40줄로 줄어야 한다.

## 핵심 용어 (Key Terms)

| 용어 | 사람들이 하는 말 | 실제 의미 |
|------|----------------|------------------------|
| MCP 클라이언트(MCP client) | "에이전트 호스트" | 서버를 생성하고 도구 호출을 오케스트레이션하는 프로세스 |
| 세션(Session) | "서버별 상태" | 능력, 도구 목록, 대기 중 요청 장부(bookkeeping) |
| 병합된 네임스페이스(Merged namespace) | "하나의 도구 목록" | 모든 활성 서버에 걸친 평평한 도구 이름 집합 |
| 네임스페이스 충돌(Namespace collision) | "두 서버 같은 도구" | 클라이언트가 중복을 접두사 처리, 거부, 또는 선착순해야 함 |
| 라우팅(Routing) | "이 호출을 누가 받나?" | 도구 이름에서 소유 서버로의 디스패치 |
| 백그라운드 리더(Background reader) | "차단 없는 stdout" | 서버 stdout을 큐로 비우는 스레드 또는 태스크 |
| Sampling 콜백(Sampling callback) | "서비스로서의 LLM" | 서버로부터의 `sampling/createMessage`에 대한 클라이언트 핸들러 |
| `notifications/*_changed` | "기본 요소 변형됨" | 클라이언트가 다시 탐색하거나 다시 읽어야 한다는 신호 |
| 재연결 정책(Reconnection policy) | "서버가 죽을 때" | 전송 실패 시 재시작 의미론 |
| Stdio 세션(Stdio session) | "프로세스 = 세션" | 세션 id 없음. 자식 프로세스 수명이 곧 세션 |

## 더 읽을거리 (Further Reading)

- [Model Context Protocol — Client spec](https://modelcontextprotocol.io/specification/2025-11-25/client) — 표준 클라이언트 동작
- [MCP — Quickstart client guide](https://modelcontextprotocol.io/quickstart/client) — Python SDK를 사용한 hello-world 클라이언트 튜토리얼
- [MCP Python SDK — client module](https://github.com/modelcontextprotocol/python-sdk) — 레퍼런스 `ClientSession`과 `stdio_client`
- [MCP TypeScript SDK — Client](https://github.com/modelcontextprotocol/typescript-sdk) — TS 병렬
- [VS Code — MCP in extensions](https://code.visualstudio.com/api/extension-guides/ai/mcp) — VS Code가 단일 에디터 호스트에서 여러 MCP 서버를 다중화(multiplex)하는 방식
