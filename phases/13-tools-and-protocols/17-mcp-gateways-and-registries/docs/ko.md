# MCP 게이트웨이와 레지스트리 — 엔터프라이즈 컨트롤 플레인

> 기업은 모든 개발자가 아무 MCP 서버나 설치하도록 둘 수 없다. 게이트웨이(gateway)는 인증, RBAC, 감사(audit), 속도 제한(rate limiting), 캐싱, 툴 포이즈닝(tool-poisoning) 탐지를 중앙집중화하고, 병합된 툴 표면(tool surface)을 단일 MCP 엔드포인트로 노출한다. 공식 MCP 레지스트리(Official MCP Registry)(Anthropic + GitHub + PulseMCP + Microsoft, 네임스페이스 검증)는 표준 업스트림(upstream)이다. 이 레슨은 게이트웨이가 어디에 들어맞는지를 짚고, 최소 구현을 따라가며, 2026년 벤더 지형을 개괄한다.

**Type:** Learn
**Languages:** Python (stdlib, minimal gateway)
**Prerequisites:** Phase 13 · 15 (tool poisoning), Phase 13 · 16 (OAuth 2.1)
**Time:** ~45분

## 학습 목표 (Learning Objectives)

- MCP 게이트웨이가 어디에 위치하는지 설명하기(MCP 클라이언트와 다수의 백엔드 MCP 서버 사이).
- 게이트웨이의 다섯 가지 책임 구현하기: 인증, RBAC, 감사, 속도 제한, 정책.
- 게이트웨이 계층에서 고정된 툴 해시(pinned-tool-hash) 매니페스트 강제하기.
- 공식 MCP 레지스트리를 메타레지스트리(metaregistry)(Glama, MCPMarket, MCP.so, Smithery, LobeHub)와 구별하기.

## 문제 (The Problem)

어느 포춘 500 기업에 승인된 MCP 서버 30개, 개발자 5000명, 컴플라이언스 및 감사 요구사항, 그리고 중앙집중식 정책을 원하는 보안팀이 있다. 모든 개발자가 자신의 IDE에 임의의 서버를 설치하도록 두는 것은 애초에 불가능한 선택지다.

게이트웨이 패턴은 이렇다.

1. 게이트웨이가 개발자들이 연결하는 단일 Streamable HTTP 엔드포인트로 동작한다.
2. 게이트웨이가 각 백엔드 MCP 서버의 자격 증명(credential)을 보유한다.
3. 모든 개발자 요청은 게이트웨이 자체의 OAuth를 통해 인증되고 스코프(scope)가 부여된다.
4. 게이트웨이가 정책을 적용하면서 호출을 백엔드 서버로 라우팅(routing)한다.
5. 모든 호출이 감사를 위해 로깅된다.

Cloudflare MCP Portals, Kong AI Gateway, IBM ContextForge, MintMCP, TrueFoundry, Envoy AI Gateway — 모두 2025-2026년에 게이트웨이 또는 게이트웨이 기능을 출시했다.

한편, 공식 MCP 레지스트리는 표준 업스트림으로 출범했다. 큐레이션되고, 네임스페이스가 검증되며, 역방향 DNS(reverse-DNS) 이름이 붙은 서버들을 게이트웨이가 가져올 수 있는 출처다. 메타레지스트리(Glama, MCPMarket, MCP.so, Smithery, LobeHub)는 여러 출처에 걸쳐 서버를 집계한다.

## 개념 (The Concept)

### 게이트웨이의 다섯 가지 책임

1. **인증(Auth).** 개발자를 식별하기 위한 OAuth 2.1; 사용자 역할(role)에 매핑된다.
2. **RBAC.** 사용자별 정책: 어떤 서버, 어떤 툴, 어떤 스코프.
3. **감사(Audit).** 모든 호출을 누가, 무엇을, 언제, 결과와 함께 로깅한다.
4. **속도 제한(Rate limit).** 남용을 막기 위한 사용자별 / 툴별 / 서버별 상한.
5. **정책(Policy).** 포이즈닝된 설명 거부, 둘의 규칙(Rule of Two) 강제, PII 마스킹.

### 단일 엔드포인트로서의 게이트웨이

개발자에게 게이트웨이는 하나의 MCP 서버처럼 보인다. 내부적으로는 N개의 백엔드로 라우팅한다. 세션 ID(Phase 13 · 09)는 경계에서 다시 쓰여진다.

### 자격 증명 볼팅 (Credential vaulting)

개발자는 백엔드 토큰(token)을 결코 보지 못한다. 게이트웨이가 토큰을 보유한다(또는 토큰을 보유하는 ID 제공자(identity provider)로 프록시한다). 게이트웨이에서 `notes:read` 권한을 가진 개발자는 게이트웨이 자체의 백엔드 자격 증명으로 notes MCP 서버에 전이적으로(transitively) 접근할 수 있다 — 단, 그 전이적 접근을 결속하는 정책 하에서만 가능하다.

### 게이트웨이에서의 툴 해시 고정 (Tool-hash pinning)

게이트웨이는 승인된 툴 설명의 매니페스트(SHA256 해시)를 보유한다. 디스커버리(discovery) 시점에 각 백엔드의 `tools/list`를 가져와 해시를 매니페스트와 비교하고, 설명이 변형된 툴은 제거한다. 이는 Phase 13 · 15의 러그 풀(rug-pull) 방어를 중앙에서 적용한 것이다.

### 코드로서의 정책 (Policy-as-code)

고급 게이트웨이는 정책을 OPA/Rego, Kyverno, Styra로 표현한다. "사용자 `alice`는 org `acme`의 레포에서만 `github.open_pr`을 호출할 수 있다" 같은 규칙이 선언적으로 인코딩된다. 단순한 게이트웨이는 손으로 작성한 Python을 쓴다. 두 형태 모두 유효하다.

### 세션 인식 라우팅 (Session-aware routing)

사용자의 세션이 여러 서버를 섞어 포함할 때, 게이트웨이는 멀티플렉싱(multiplexing)한다. 개발자의 단일 MCP 세션이 서버당 하나씩 N개의 백엔드 세션을 보유한다. 어떤 백엔드로부터의 알림(notification)이든 게이트웨이를 거쳐 개발자의 세션으로 라우팅된다.

### 네임스페이스 병합 (Namespace merging)

게이트웨이는 모든 백엔드의 툴 네임스페이스를 병합하는데, 보통 충돌 시 접두어(prefix-on-collision) 방식을 쓴다. `github.open_pr`, `notes.search`처럼. 이로써 라우팅이 명확해진다.

### 레지스트리 (Registries)

- **공식 MCP 레지스트리(`registry.modelcontextprotocol.io`).** Anthropic, GitHub, PulseMCP, Microsoft의 관리 하에 출범했다. 네임스페이스 검증됨(역방향 DNS: `io.github.user/server`). 기본 품질에 대해 사전 필터링된다.
- **Glama.** 다수 출처를 집계하는 검색 중심 메타레지스트리.
- **MCPMarket.** 벤더 목록이 있는 상업 지향 디렉터리.
- **MCP.so.** 커뮤니티 디렉터리; 공개 제출.
- **Smithery.** 패키지 매니저 스타일의 설치 흐름.
- **LobeHub.** 그들의 LobeChat 앱에 UI 통합된 레지스트리.

엔터프라이즈 게이트웨이는 기본적으로 공식 레지스트리에서 가져오고, 관리자가 큐레이션한 메타레지스트리 추가를 허용하며, 고정되지 않은(unpinned) 것은 모두 거부한다.

### 역방향 DNS 명명 (Reverse-DNS naming)

공식 레지스트리는 공개 서버에 대해 역방향 DNS 이름을 의무화한다: `io.github.alice/notes`. 네임스페이스는 스쿼팅(squatting)을 막고 신뢰 위임을 더 명확하게 만든다.

### 벤더 개관, 2026년 4월

| 벤더 | 강점 |
|--------|----------|
| Cloudflare MCP Portals | 엣지 호스팅; OAuth 통합; 무료 티어 |
| Kong AI Gateway | K8s 네이티브; 세분화된 정책; OpenTelemetry로 로깅 |
| IBM ContextForge | 엔터프라이즈 IAM; 컴플라이언스; 감사 익스포트 |
| TrueFoundry | DevOps 지향; 메트릭 우선 |
| MintMCP | 개발자 플랫폼 지향 |
| Envoy AI Gateway | 오픈소스; 커스터마이즈 가능한 필터 |

Phase 17(프로덕션 인프라)에서 게이트웨이 운영을 더 깊이 다룬다.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 약 150줄짜리 최소 게이트웨이를 제공한다. 가짜 Bearer 토큰으로 사용자를 인증하고, 사용자별 RBAC 정책을 보유하며, 요청을 두 개의 백엔드 MCP 서버로 라우팅하고, 모든 호출을 감사 로그에 기록하며, 속도 제한을 강제하고, 설명 해시가 고정된 매니페스트와 일치하지 않는 백엔드 툴은 모두 거부한다.

볼 것:

- `user_id`를 키로 하고 허용된 `server_tool` 항목을 담은 `RBAC` 딕셔너리.
- `AUDIT_LOG`는 추가 전용(append-only) 이벤트 리스트다.
- 속도 제한은 사용자당 토큰 버킷(token bucket)을 사용한다.
- 고정된 매니페스트는 `server::tool -> hash` 형태의 딕셔너리다.

## 산출물 (Ship It)

이 레슨은 `outputs/skill-gateway-bootstrap.md`를 만든다. 엔터프라이즈 MCP 계획(사용자, 백엔드, 컴플라이언스)이 주어지면, 이 스킬은 게이트웨이 구성 명세를 만들어낸다.

## 연습 문제 (Exercises)

1. `code/main.py`를 실행하라. 허용된 사용자로 호출한 다음; 허용되지 않은 사용자로; 그다음 속도 제한을 초과하는 버스트로 호출하라. 세 흐름 모두 검증하라.

2. 클라이언트로 반환하기 전에 결과에서 PII를 마스킹하는 정책을 추가하라. SSN 형태의 문자열에 대해 간단한 정규식 패스를 사용하고; 빈틈(이메일, 전화번호)을 기록하라.

3. 감사 로그를 OpenTelemetry GenAI 스팬(span)을 방출하도록 확장하라. Phase 13 · 20이 정확한 속성을 다룬다.

4. 백엔드 다섯 개(notes, github, postgres, jira, slack)를 가진 50명 규모 개발자 팀을 위한 RBAC 정책을 설계하라. 각각에서 누가 읽기 전용을 받는가? 누가 쓰기를 받는가?

5. Cloudflare 엔터프라이즈 MCP 글을 처음부터 끝까지 읽어라. Cloudflare가 제공하지만 이 stdlib 게이트웨이가 제공하지 않는 기능 하나를 식별하라.

## 핵심 용어 (Key Terms)

| 용어 | 사람들이 말하는 것 | 실제 의미 |
|------|----------------|------------------------|
| 게이트웨이(Gateway) | "MCP 프록시" | 클라이언트와 백엔드 사이를 중앙집중화하는 서버 |
| 자격 증명 볼팅(Credential vaulting) | "백엔드 토큰은 서버 측에 머문다" | 개발자는 업스트림 토큰을 결코 보지 못한다 |
| 세션 인식 라우팅(Session-aware routing) | "멀티 백엔드 세션" | 게이트웨이가 개발자 세션당 N개의 백엔드 세션을 멀티플렉싱한다 |
| 툴 해시 고정(Tool-hash pinning) | "승인된 매니페스트" | 승인된 모든 툴 설명의 SHA256; 러그 풀을 중앙에서 차단한다 |
| RBAC | "사용자별 정책" | 툴과 서버에 대한 역할 기반 접근 제어 |
| 코드로서의 정책(Policy-as-code) | "선언적 규칙" | 게이트웨이에서 강제되는 OPA/Rego, Kyverno, Styra 정책 |
| 감사 로그(Audit log) | "누가, 무엇을, 언제" | 컴플라이언스를 위한 추가 전용 이벤트 로그 |
| 속도 제한(Rate limit) | "사용자별 토큰 버킷" | 남용을 막기 위한 분당 상한 |
| 공식 MCP 레지스트리(Official MCP Registry) | "표준 업스트림" | `registry.modelcontextprotocol.io`, 네임스페이스 검증됨 |
| 역방향 DNS 명명(Reverse-DNS naming) | "레지스트리 네임스페이스" | `io.github.user/server` 컨벤션 |

## 더 읽을거리 (Further Reading)

- [Official MCP Registry](https://registry.modelcontextprotocol.io/) — 표준 업스트림, 네임스페이스 검증됨
- [Cloudflare — Enterprise MCP](https://blog.cloudflare.com/enterprise-mcp/) — OAuth와 정책을 갖춘 게이트웨이 패턴
- [agentic-community — MCP gateway registry](https://github.com/agentic-community/mcp-gateway-registry) — 오픈소스 레퍼런스 게이트웨이
- [TrueFoundry — What is an MCP gateway?](https://www.truefoundry.com/blog/what-is-mcp-gateway) — 기능 비교 글
- [IBM — MCP context forge](https://github.com/IBM/mcp-context-forge) — IBM의 엔터프라이즈 게이트웨이
