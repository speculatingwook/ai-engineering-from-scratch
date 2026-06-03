# Capstone 13 — 레지스트리와 거버넌스를 갖춘 MCP 서버 (MCP Server with Registry and Governance)

> Model Context Protocol은 더 이상 미래가 아니라 2026년의 기본 도구 사용(tool-use) 명세가 되었다. Anthropic, OpenAI, Google을 비롯한 모든 주요 IDE가 MCP 클라이언트를 탑재한다. Pinterest는 자사 내부 MCP 서버 생태계를 공개했다. AAIF 레지스트리(Registry)는 `.well-known`에서 역량(capability) 메타데이터를 공식화했다. AWS ECS는 레퍼런스 무상태(stateless) 배포를 발표했다. Block의 goose-agent는 동일한 프로토콜을 호스팅형 어시스턴트 안에 넣었다. 2026 프로덕션(production)의 형태는 이렇다: StreamableHTTP 전송, OAuth 2.1 스코프(scope), OPA 정책 게이팅(gating), 그리고 플랫폼 팀이 서버를 발견·검증·활성화할 수 있게 하는 레지스트리. 이것을 끝에서 끝까지 만든다.

**Type:** Capstone
**Languages:** Python (server, via FastMCP) or TypeScript (@modelcontextprotocol/sdk), Go (registry service)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and MCP), Phase 14 (agents), Phase 17 (infrastructure), Phase 18 (safety)
**Phases exercised:** P11 · P13 · P14 · P17 · P18
**Time:** 25시간

## 문제 (Problem)

MCP는 도구 사용의 링구아 프랑카(lingua franca)가 되었다. Claude Code, Cursor 3, Amp, OpenCode, Gemini CLI를 비롯한 모든 매니지드 에이전트(agent)가 이제 MCP 서버를 소비한다. 프로덕션의 과제는 서버를 작성하는 것이 아니라(FastMCP가 그것을 쉽게 만든다) 엔터프라이즈 요구사항과 함께 대규모로 배포하는 것이다: 테넌트(tenant)별 OAuth 스코프, 파괴적(destructive) 도구에 대한 OPA 정책, StreamableHTTP 무상태 확장, 발견을 위한 레지스트리, 도구 호출별 감사 로그(audit log). Pinterest의 내부 MCP 생태계와 AAIF 레지스트리 명세가 2026 기준을 설정했다.

이 과제에서는 10개의 내부 도구(읽기 전용 Postgres, S3 목록, Jira, Linear, Datadog 등)를 노출하는 MCP 서버, 플랫폼 발견을 위한 레지스트리 UI, 파괴적 도구에 대한 사람 승인 게이트(human-approval gate)를 만든다. 부하 테스트는 StreamableHTTP 수평 확장을 시연한다. 감사 추적(audit trail)은 엔터프라이즈 보안 검토를 만족시킨다.

## 개념 (Concept)

MCP 2026 개정판은 StreamableHTTP를 기본 전송으로 의무화한다. 이전의 stdio-and-SSE 형태와 달리, StreamableHTTP는 기본적으로 무상태다: 단일 HTTP 엔드포인트가 JSON-RPC 요청을 받고, 응답을 스트리밍하며, 알림(notification)을 위한 장수명 연결을 지원한다. 무상태라는 것은 로드 밸런서(load balancer) 뒤에서 수평 확장이 가능하다는 뜻이다.

인가(authorization)는 도구별 스코프를 갖는 OAuth 2.1이다. 토큰은 `jira:read`, `s3:list`, `postgres:query:readonly` 같은 스코프를 담는다. MCP 서버는 세션 시작 시점만이 아니라 도구 호출 시점에 스코프를 확인한다. 고위험 도구의 경우, 서버는 최근 N분 이내에 `approved:by:human`으로 승격되지 않은 스코프의 호출을 모두 거부한다 — 그 승격은 Slack 검토 카드에서 나온다.

레지스트리는 별도 서비스다. 모든 MCP 서버는 도구 매니페스트(manifest), 전송 URL, 인증 요구사항을 담은 `.well-known/mcp-capabilities` 문서를 노출한다. 레지스트리는 폴링하고, 검증하고, 인덱싱한다. 플랫폼 팀은 레지스트리 UI를 사용해 어떤 도구가 가용한지, 어떤 스코프가 필요한지, 어느 팀이 소유하는지를 본다.

## 아키텍처 (Architecture)

```
MCP client (Claude Code, Cursor 3, ...)
          |
          v
StreamableHTTP over HTTPS (JSON-RPC + streaming)
          |
          v
MCP server (FastMCP) behind load balancer
          |
   +------+------+---------+----------+------------+
   v             v         v          v            v
Postgres    S3 listing  Jira       Linear     Datadog
(read-only) (paged)     (read)     (read)     (query)
          |
   +------+-------------+
   v                    v
 OPA policy gate   destructive tool MCP (separate server)
                        |
                        v
                   human approval via Slack
                        |
                        v
                   audit log (append-only, per-tenant)

  registry service
     |
     v  GET /.well-known/mcp-capabilities from each server
     v
     UI: search / validate / enable-disable / ownership
```

## 스택 (Stack)

- 서버 프레임워크: FastMCP (Python) 또는 `@modelcontextprotocol/sdk` (TypeScript)
- 전송: HTTPS 위의 StreamableHTTP (무상태)
- 인증: SPIFFE / SPIRE를 통한 워크로드 아이덴티티(workload identity)를 갖는 OAuth 2.1
- 정책: 도구별 OPA / Rego 규칙; 요청별 정책 결정 서비스
- 레지스트리: 셀프 호스팅, `.well-known/mcp-capabilities` 매니페스트를 소비
- 사람 승인: 파괴적 도구를 위한 Slack 인터랙티브 메시지
- 배포: AWS ECS Fargate 또는 Fly.io, 테넌트당 서버 하나 또는 테넌트 스코핑을 갖춘 공유
- 감사: 호출별 계보(lineage)를 갖는 테넌트별 버킷의 구조화된 JSONL

## 직접 만들기 (Build It)

1. **도구 표면.** 10개의 내부 도구를 노출한다: Postgres 읽기 전용 질의, S3 객체 목록, Jira 검색/조회, Linear 검색/조회, Datadog 메트릭 질의, PagerDuty 온콜 조회, GitHub 읽기 전용, Notion 검색, Slack 검색, Salesforce 읽기. 각 도구는 타입이 지정된 스키마와 스코프 레이블을 갖는다.

2. **FastMCP 서버.** 도구를 마운트한다. StreamableHTTP 전송을 구성한다. OAuth 토큰 인트로스펙션(introspection)과 스코프 시행을 위한 미들웨어를 추가한다.

3. **OPA 정책.** 도구별 Rego 정책: 어떤 스코프가 호출을 허용하는지, 어떤 PII 마스킹(redaction)이 적용되는지, 어떤 페이로드 크기 상한이 적용되는지. 모든 도구 호출에서 결정 서비스가 호출된다.

4. **레지스트리 서비스.** 등록된 서버로부터 `.well-known/mcp-capabilities`를 폴링하고, JSON Schema로 검증하며, 목록 / 검색 / 검증 / 활성화-비활성화 UI를 노출하는 별도의 Go 또는 TS 서비스.

5. **역량 매니페스트.** 각 서버는 도구 목록, 인증 요구사항, 전송 URL, 소유 팀, SLO를 담은 `.well-known/mcp-capabilities`를 노출한다.

6. **파괴적 도구 분리.** 상태를 변경하는 도구(Jira 생성, Linear 생성, Postgres 쓰기)는 더 엄격한 인증 흐름을 갖는 두 번째 MCP 서버에 둔다: 토큰은 15분 이내에 Slack 카드를 통해 승격된 `approved:by:human` 스코프를 가져야 한다.

7. **감사 로그.** 테넌트별 추가 전용(append-only) JSONL: `{timestamp, user, tool, args_redacted, response_redacted, outcome}`. 쓰기 전에 Presidio를 통한 PII 마스킹.

8. **부하 테스트.** StreamableHTTP에서 100개의 동시 클라이언트. 두 번째 레플리카를 추가해 수평 확장을 시연한다. 세션 고정(session stickiness) 없이 로드 밸런서가 재분배하는 것을 보여준다.

9. **적합성 테스트.** 두 서버 모두에 대해 공식 MCP 적합성(conformance) 스위트를 실행한다. 모든 필수 섹션을 통과시킨다.

## 라이브러리로 써보기 (Use It)

```
$ curl -H "Authorization: Bearer eyJhbGc..." \
       -X POST https://mcp.internal.example.com/ \
       -d '{"jsonrpc":"2.0","method":"tools/call",
            "params":{"name":"postgres.readonly","arguments":{"sql":"SELECT 1"}}}'
[registry]   capability validated: postgres.readonly v1.2
[policy]    scope postgres:query:readonly present; allowed
[audit]     logged: user=u42 tool=postgres.readonly outcome=ok
response:    { "result": { "rows": [[1]] } }
```

## 산출물 (Ship It)

`outputs/skill-mcp-server.md`가 결과물을 설명한다. OAuth 2.1 스코프와 OPA 게이팅을 갖춘 내부 도구용 프로덕션급 MCP 서버 + 레지스트리 + 감사 계층.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | 명세 적합성 | StreamableHTTP + 역량 매니페스트가 MCP 적합성 테스트 통과 |
| 20 | 보안 | 스코프 시행, 모든 도구에 걸친 OPA 커버리지, 시크릿 위생 |
| 20 | 관측성 | PII 마스킹을 갖춘 도구 호출별 감사 로그 |
| 20 | 확장성 | 100 클라이언트 부하 테스트 수평 확장 시연 |
| 15 | 레지스트리 UX | 발견 / 검증 / 활성화-비활성화 워크플로 |
| **100** | | |

## 연습 문제 (Exercises)

1. 새 도구(Confluence 검색)를 추가한다. 코어 서버를 건드리지 않고 레지스트리 검증 흐름을 통해 출하한다.

2. `email`, `ssn`, 또는 `phone`이라는 이름의 컬럼을 포함하는 Postgres 질의 결과를 마스킹하는 OPA 정책을 작성한다. 프로브 질의로 동작시킨다.

3. 로컬 지연 시간에서 StreamableHTTP 대 stdio를 벤치마크한다. 호출별 p50/p95를 보고한다.

4. 테넌트별 쿼터(quota)를 구현한다: 테넌트당 도구당 분당 최대 N회 호출. 두 번째 OPA 규칙으로 시행한다.

5. [mcp-conformance-tests](https://github.com/modelcontextprotocol/conformance)에서 MCP 적합성 스위트를 실행하고 모든 실패를 수정한다.

## 핵심 용어 (Key Terms)

| 용어 | 사람들이 말하는 것 | 실제 의미 |
|------|-----------------|------------------------|
| StreamableHTTP | "2026 MCP 전송" | 무상태 HTTP + 스트리밍; 네트워크 서버에서 SSE + stdio를 대체 |
| Capability manifest | "well-known 문서" | 도구 목록, 인증, 전송 URL을 담은 `.well-known/mcp-capabilities` |
| OPA / Rego | "정책 엔진" | 외부 규칙에 대해 도구 호출을 인가하는 Open Policy Agent |
| Scope elevation | "사람이 승인함(approved-by-human)" | Slack 승인을 통해 부여되는 단수명 스코프; 파괴적 도구에 필요 |
| Registry | "도구 발견" | 역량 매니페스트로부터 MCP 서버를 인덱싱하는 서비스 |
| Workload identity | "SPIFFE / SPIRE" | OAuth 토큰 발급을 위한 암호학적 서비스 아이덴티티 |
| Conformance suite | "명세 테스트" | StreamableHTTP + 도구 매니페스트 정확성을 위한 공식 MCP 테스트 배터리 |

## 더 읽을거리 (Further Reading)

- [Model Context Protocol 2026 Roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP, 역량 메타데이터, 레지스트리
- [AAIF MCP Registry spec](https://github.com/modelcontextprotocol/registry) — 2026 레지스트리 명세
- [AWS ECS reference deployment](https://aws.amazon.com/blogs/containers/deploying-model-context-protocol-mcp-servers-on-amazon-ecs/) — 레퍼런스 프로덕션 배포
- [Pinterest internal MCP ecosystem](https://www.infoq.com/news/2026/04/pinterest-mcp-ecosystem/) — 레퍼런스 내부 배포
- [Block `goose` MCP usage](https://block.github.io/goose/) — 레퍼런스 에이전트 소비 패턴
- [FastMCP](https://github.com/jlowin/fastmcp) — Python 서버 프레임워크
- [Open Policy Agent](https://www.openpolicyagent.org/) — 정책 엔진 레퍼런스
- [SPIFFE / SPIRE](https://spiffe.io) — 워크로드 아이덴티티 레퍼런스
