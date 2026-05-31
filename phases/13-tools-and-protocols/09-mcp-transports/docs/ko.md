# MCP 트랜스포트 — stdio vs Streamable HTTP vs SSE 마이그레이션

> stdio는 로컬에서만 동작하고 다른 곳에서는 동작하지 않는다. Streamable HTTP(2025-03-26)는 원격 표준이다. 기존 HTTP+SSE 트랜스포트는 더 이상 사용되지 않으며 2026년 중반에 제거된다. 잘못된 트랜스포트를 고르면 마이그레이션 비용을 치르게 되고, 올바른 것을 고르면 세션 연속성(session continuity)과 DNS 리바인딩(DNS-rebinding) 방어를 갖춘 원격 호스팅 가능한 MCP 서버를 얻는다.

**Type:** Learn
**Languages:** Python (stdlib, Streamable HTTP endpoint skeleton)
**Prerequisites:** Phase 13 · 07, 08 (MCP server and client)
**Time:** ~45분

## 학습 목표 (Learning Objectives)

- 배포 형태(로컬 vs 원격, 단일 프로세스 vs 플릿)에 따라 stdio와 Streamable HTTP 중에서 선택하기.
- Streamable HTTP 단일 엔드포인트 패턴 구현하기: 요청에는 POST, 세션 스트림에는 GET.
- DNS 리바인딩을 막기 위해 `Origin` 검증과 세션 id 의미론(semantics)을 강제하기.
- 2026년 중반 제거 마감 전에 레거시 HTTP+SSE 서버를 Streamable HTTP로 마이그레이션하기.

## 문제 (The Problem)

최초의 MCP 원격 트랜스포트(2024-11)는 HTTP+SSE였다. 엔드포인트가 두 개로, 하나는 클라이언트의 POST용이고 다른 하나는 서버-투-클라이언트 스트림을 위한 Server-Sent-Events 채널이었다. 동작은 했다. 그러나 투박하기도 했다. 세션마다 엔드포인트 두 개, 일부 CDN 앞단에서 깨지는 캐시, 그리고 일부 WAF가 공격적으로 끊어버리는 장기 연결 SSE에 대한 강한 의존성이 있었다.

2025-03-26 사양(spec)은 이를 Streamable HTTP로 대체했다. 엔드포인트 하나에, 클라이언트 요청에는 POST, 세션 스트림 수립에는 GET을 쓰며, 둘 다 `Mcp-Session-Id` 헤더를 공유한다. 그 이후로 구축되거나 마이그레이션된 모든 서버는 Streamable HTTP를 사용한다. 기존 SSE 모드는 더 이상 사용되지 않는 방향으로 가고 있다. Atlassian Rovo는 2026년 6월 30일에 제거했고, Keboola는 2026년 4월 1일에, 남은 대부분의 엔터프라이즈 서버는 2026년 말까지 제거한다.

그리고 stdio는 여전히 로컬 서버에 중요하다. Claude Desktop, VS Code, 그리고 IDE 형태의 모든 클라이언트는 stdio를 통해 서버를 띄운다. 올바른 멘탈 모델은 이렇다. "이 머신"에는 stdio, "네트워크 너머"에는 Streamable HTTP. 교차는 없다.

## 개념 (The Concept)

### stdio

- 자식 프로세스(child-process) 트랜스포트. 클라이언트가 서버를 띄우고 stdin/stdout으로 통신한다.
- 한 줄당 하나의 JSON 객체. 줄바꿈으로 구분된다.
- 세션 id가 없다. 프로세스 정체성(identity)이 곧 세션이다.
- 인증이 필요 없다(자식이 부모의 신뢰 경계를 상속한다).
- 원격 서버에는 절대 쓰지 않는다. SSH나 socat으로 터널링해야 하는데, 그럴 거라면 Streamable HTTP를 쓰면 된다.

### Streamable HTTP

단일 엔드포인트 `/mcp`(또는 임의의 경로). 세 가지 HTTP 메서드를 지원한다:

- **POST /mcp.** 클라이언트가 JSON-RPC 메시지를 보낸다. 서버는 단일 JSON 응답으로 답하거나, 하나 이상의 응답으로 이루어진 SSE 스트림으로 답한다(배치 응답과 해당 요청에 관련된 알림(notification)에 유용하다).
- **GET /mcp.** 클라이언트가 장기 연결 SSE 채널을 연다. 서버는 이를 서버-투-클라이언트 요청(샘플링(sampling), 알림, 유도(elicitation))에 사용한다.
- **DELETE /mcp.** 클라이언트가 세션을 명시적으로 종료한다.

세션은 서버가 첫 응답에 설정하고 클라이언트가 이후 모든 요청에서 되돌려 보내는 `Mcp-Session-Id` 헤더로 식별된다. 세션 id는 반드시 암호학적으로 무작위(128비트 이상)여야 한다. 클라이언트가 고른 id는 안전을 위해 거부된다.

### 단일 엔드포인트 vs 두 개

기존 사양의 두-엔드포인트 모드는 2026년에도 여전히 호출 가능하다. 사양이 이를 "레거시 호환(legacy compatible)"으로 선언한다. 그러나 모든 새 서버는 단일 엔드포인트여야 한다. 공식 SDK는 단일 엔드포인트를 내보낸다. 레거시 모드는 마이그레이션되지 않은 원격과 통신할 때만 사용한다.

### `Origin` 검증과 DNS 리바인딩

브라우저는 (오늘날) MCP 클라이언트가 아니지만, 공격자는 브라우저가 `localhost:1234/mcp`로 POST하도록 유도하는 웹페이지를 만들 수 있다. 바로 그곳에서 사용자의 로컬 MCP 서버가 수신 대기 중이다. 서버가 `Origin`을 검사하지 않으면, `Origin: http://evil.com`은 유효한 교차 출처(cross-origin)이므로 브라우저의 동일 출처 정책(same-origin policy)이 막아주지 못한다.

2025-11-25 사양은 서버가 `Origin`이 허용 목록(allowlist)에 없는 요청을 거부하도록 요구한다. 허용 목록에는 보통 MCP 클라이언트 호스트(`https://claude.ai`, `vscode-webview://*`)와 로컬 UI를 위한 localhost 변형들이 포함된다.

### 세션 id 생명주기

1. 클라이언트가 `Mcp-Session-Id` 없이 첫 요청을 보낸다.
2. 서버가 무작위 id를 할당하고 응답 헤더에 `Mcp-Session-Id`를 설정한다.
3. 클라이언트가 이후 모든 요청과 스트림용 `GET /mcp`에서 그 헤더를 되돌려 보낸다.
4. 세션은 서버에 의해 취소될 수 있다. 클라이언트는 이후 요청에서 404를 보고 다시 초기화해야 한다.
5. 클라이언트는 깔끔한 종료를 위해 세션을 명시적으로 DELETE할 수 있다.

### 킵얼라이브(keepalive)와 재연결

SSE 연결은 끊긴다. 클라이언트는 동일한 `Mcp-Session-Id`로 다시 GET하여 재수립한다. 서버는 반드시 단절 동안 놓친 이벤트를 (합리적인 윈도우까지) 큐에 저장하고, 클라이언트가 되돌려 보내는 `last-event-id` 헤더를 통해 재생(replay)해야 한다.

Phase 13 · 13은 태스크(Task)를 다루며, 이를 통해 장기 실행 작업이 전체 세션 재연결 이후에도 살아남을 수 있다.

### 하위 호환성 프로브(probe)

기존 서버와 새 서버를 모두 지원하려는 클라이언트는 다음을 수행한다:

1. `/mcp`에 POST한다.
2. 응답이 JSON 또는 SSE를 동반한 `200 OK`이면, 이는 Streamable HTTP이다.
3. 응답이 `Content-Type: text/event-stream`인 `200 OK`이고 보조 엔드포인트를 가리키는 `Location` 헤더가 있으면, 이는 레거시 HTTP+SSE이다. `Location`을 따라간다.

### Cloudflare, ngrok, 호스팅

2026년 프로덕션(production) 원격 MCP 서버는 Cloudflare Workers(그들의 MCP Agents SDK 사용), Vercel Functions, 또는 컨테이너화된 Node/Python에서 실행된다. 핵심은 이렇다. 호스팅이 SSE GET을 위한 장기 연결 HTTP 연결을 지원해야 한다. Vercel의 무료 티어는 10초로 제한되어 적합하지 않다. Cloudflare Workers는 무기한 스트림을 지원한다.

### 게이트웨이 구성(composition)

게이트웨이(Phase 13 · 17)로 여러 MCP 서버를 앞단에서 묶으면, 게이트웨이는 세션 id를 다시 쓰고 업스트림을 다중화(multiplex)하는 단일 Streamable HTTP 엔드포인트가 된다. 도구는 게이트웨이 계층에서 병합되며, 클라이언트는 하나의 논리적 서버만 본다.

### 트랜스포트 실패 모드

- **stdio SIGPIPE.** 쓰기 도중 자식 프로세스가 죽으면 SIGPIPE가 발생한다. 서버는 깔끔하게 종료해야 한다. 클라이언트는 EOF를 감지하고 세션을 죽은 것으로 표시해야 한다.
- **HTTP 502 / 504.** Cloudflare, nginx, 기타 프록시는 업스트림 실패 시 이를 내보낸다. Streamable HTTP 클라이언트는 짧은 백오프(backoff) 후 한 번 재시도해야 한다.
- **SSE 연결 끊김.** TCP RST, 프록시 타임아웃, 또는 클라이언트 네트워크 변경이 스트림을 닫는다. 클라이언트는 `Mcp-Session-Id`와 선택적 `last-event-id`로 재연결하여 재개한다.
- **세션 취소.** 서버가 세션 id를 무효화한다. 클라이언트는 다음 요청에서 404를 본다. 클라이언트는 다시 핸드셰이크해야 한다.
- **시계 편차(clock skew).** 클라이언트의 리소스-TTL 계산이 서버와 어긋난다. 클라이언트는 서버 타임스탬프를 권위 있는 것으로 취급해야 한다.

### Streamable HTTP를 우회할 때

일부 기업은 자체 네트워크 내부에서 gRPC나 메시지 큐 트랜스포트 뒤에 MCP 서버를 배포한다. 이는 비표준이다. MCP 사양은 이를 공식적으로 정의하지 않는다. 게이트웨이는 내부적으로 gRPC를 쓰면서 MCP 클라이언트에게는 Streamable HTTP 표면을 노출할 수 있다. 외부 표면은 사양을 준수하게 유지하고, 변환은 게이트웨이가 담당하게 한다.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 `http.server`(stdlib)를 사용해 최소한의 Streamable HTTP 엔드포인트를 구현한다. `/mcp`에서 POST, GET, DELETE를 처리하고, 첫 응답에 `Mcp-Session-Id`를 설정하며, `Origin`을 검증하고, 허용 목록에 없는 출처의 요청을 거부한다. 핸들러는 Lesson 07 노트 서버의 디스패치 로직을 재사용한다.

살펴볼 것:

- POST 핸들러는 JSON-RPC 본문을 읽고, 디스패치하고, JSON 응답을 쓴다(단일 응답 변형. SSE 변형도 구조적으로 유사하다).
- `Origin` 검사는 기본 `http://evil.example` 프로브를 거부하지만 `http://localhost`는 허용한다.
- 세션 id는 무작위 128비트 16진수 문자열이다. 서버는 세션별 상태를 메모리에 유지한다.

## 산출물 (Ship It)

이 레슨은 `outputs/skill-mcp-transport-migrator.md`를 만든다. HTTP+SSE(레거시) MCP 서버가 주어지면, 이 스킬은 세션 id 연속성, Origin 검사, 하위 호환 프로브 지원을 갖춘 Streamable HTTP로의 마이그레이션 계획을 생성한다.

## 연습 문제 (Exercises)

1. `code/main.py`를 실행한다. `curl`로 `initialize`를 POST하고 `Mcp-Session-Id` 응답 헤더를 관찰한다. 그 헤더를 되돌려 보내는 두 번째 요청을 POST하고 세션 연속성을 확인한다.

2. SSE 스트림을 여는 GET 핸들러를 추가한다. 5초마다 `notifications/progress` 이벤트를 하나씩 보낸다. 동일한 세션 id로 다시 GET하여 재연결하고 서버가 이를 수락하는지 확인한다.

3. `last-event-id` 재생 로직을 구현한다. 재연결 시 해당 id 이후에 생성된 모든 이벤트를 재생한다.

4. `Origin` 검증을 와일드카드 패턴(`https://*.example.com`)을 지원하도록 확장하고, `https://app.example.com`은 수락하지만 `https://evil.example.com.attacker.net`은 거부하는지 확인한다.

5. 공식 레지스트리에서 레거시 HTTP+SSE 서버(여럿 있다)를 가져와 마이그레이션을 스케치한다. 엔드포인트 처리, 세션 id 생성, 헤더 의미론에서 무엇이 바뀌는가.

## 핵심 용어 (Key Terms)

| 용어 | 흔히 말하는 것 | 실제 의미 |
|------|----------------|------------------------|
| stdio 트랜스포트 | "로컬 자식 프로세스" | stdin/stdout 위의 JSON-RPC, 줄바꿈으로 구분됨 |
| Streamable HTTP | "원격 트랜스포트" | 단일 엔드포인트 POST + GET + 선택적 SSE, 2025-03-26 사양 |
| HTTP+SSE | "레거시" | 2026년 중반에 제거되는 두-엔드포인트 모델 |
| `Mcp-Session-Id` | "세션 헤더" | 서버가 할당하고 이후 모든 요청에서 되돌려 보내는 무작위 id |
| `Origin` 허용 목록 | "DNS 리바인딩 방어" | Origin이 승인되지 않은 요청을 거부 |
| 단일 엔드포인트 | "하나의 URL" | `/mcp`가 모든 세션 작업에 대해 POST / GET / DELETE를 처리 |
| `last-event-id` | "SSE 재생" | 이벤트를 놓치지 않고 끊긴 스트림을 재개하는 데 쓰는 헤더 |
| 하위 호환 프로브 | "구식 vs 신식 탐지" | 트랜스포트를 자동 선택하는 클라이언트 응답 형태 검사 |
| 장기 연결 HTTP | "SSE 스트리밍" | 서버가 하나의 TCP 연결에서 수 분 또는 수 시간 동안 이벤트를 푸시 |
| 세션 취소 | "강제 재초기화" | 서버가 세션 id를 무효화. 클라이언트는 다시 핸드셰이크해야 함 |

## 더 읽을거리 (Further Reading)

- [MCP — Basic transports spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) — stdio와 Streamable HTTP의 표준 레퍼런스
- [MCP — Basic transports spec 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — Streamable HTTP를 도입한 개정판
- [Cloudflare — MCP transport](https://developers.cloudflare.com/agents/model-context-protocol/transport/) — Workers 호스팅 Streamable HTTP 패턴
- [AWS — MCP transport mechanisms](https://builder.aws.com/content/35A0IphCeLvYzly9Sw40G1dVNzc/mcp-transport-mechanisms-stdio-vs-streamable-http) — 배포 형태별 비교
- [Atlassian — HTTP+SSE deprecation notice](https://community.atlassian.com/forums/Atlassian-Remote-MCP-Server/HTTP-SSE-Deprecation-Notice/ba-p/3205484) — 구체적인 마이그레이션 마감 사례
