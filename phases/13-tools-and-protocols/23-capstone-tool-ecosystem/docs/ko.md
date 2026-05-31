# 캡스톤 — 완전한 툴 생태계 구축하기

> Phase 13은 모든 조각을 가르쳤다. 이 캡스톤(capstone)은 그것들을 하나의 프로덕션 형태 시스템으로 연결한다: 툴 + 리소스 + 프롬프트 + 태스크 + UI를 갖춘 MCP 서버, 엣지에서의 OAuth 2.1, RBAC 게이트웨이, 멀티 서버 클라이언트, A2A 하위 에이전트 호출, 컬렉터로 들어가는 OTel 추적, CI에서의 툴 포이즈닝(tool-poisoning) 탐지, 그리고 AGENTS.md + SKILL.md 번들. 끝에 이르면 당신은 모든 아키텍처 선택을 방어할 수 있다.

**Type:** Build
**Languages:** Python (stdlib, end-to-end ecosystem harness)
**Prerequisites:** Phase 13 · 01 through 21
**Time:** ~120분

## 학습 목표 (Learning Objectives)

- 툴, 리소스, 프롬프트, 그리고 `ui://` 앱을 갖춘 태스크를 노출하는 MCP 서버 구성하기.
- RBAC와 고정된 해시(pinned hash)를 강제하는 OAuth 2.1 게이트웨이로 서버 앞단을 두기.
- OTel GenAI 속성으로 종단 간 추적하는 멀티 서버 클라이언트 작성하기.
- 워크로드의 일부를 A2A 하위 에이전트에 위임하기; 불투명성(opacity)이 보존되는지 검증하기.
- 다른 에이전트가 구동할 수 있도록 AGENTS.md + SKILL.md로 전체 스택을 패키징하기.

## 문제 (The Problem)

"리서치 및 보고" 시스템을 출하하라:

- 사용자가 묻는다: "에이전트 프로토콜에 관한 2026년 arXiv 논문 중 가장 많이 인용된 세 편을 요약하라."
- 시스템: MCP를 통해 arXiv를 검색하고; A2A를 통해 논문 요약을 전문 작성 에이전트에 위임하고; 결과를 집계하고; 인터랙티브 보고서를 MCP Apps `ui://` 리소스로 렌더링하고; 모든 단계를 OTel에 로깅한다.

Phase 13의 모든 프리미티브가 등장한다. 이것은 장난감이 아니다 — 2026년 Anthropic(Claude Research 제품), OpenAI(Apps SDK를 갖춘 GPTs), 그리고 서드파티가 출하한 프로덕션 리서치 어시스턴트 시스템이 정확히 이 형태다.

## 개념 (The Concept)

### 아키텍처

```
[user] -> [client] -> [gateway (OAuth 2.1 + RBAC)] -> [research MCP server]
                                                      |
                                                      +- MCP tool: arxiv_search (pure)
                                                      +- MCP resource: notes://recent
                                                      +- MCP prompt: /research_topic
                                                      +- MCP task: generate_report (long)
                                                      +- MCP Apps UI: ui://report/current
                                                      +- A2A call: writer-agent (tasks/send)
                                                      |
                                                      +- OTel GenAI spans
```

### 트레이스 계층

```
agent.invoke_agent
 ├── llm.chat (kick off)
 ├── mcp.call -> tools/call arxiv_search
 ├── mcp.call -> resources/read notes://recent
 ├── mcp.call -> prompts/get research_topic
 ├── a2a.tasks/send -> writer-agent
 │    └── task transitions (opaque internals)
 ├── mcp.call -> tools/call generate_report (task-augmented)
 │    └── tasks/status polling
 │    └── tasks/result (completed, returns ui:// resource)
 └── llm.chat (final synthesis)
```

하나의 트레이스 id. 모든 스팬(span)이 올바른 `gen_ai.*` 속성을 가진다.

### 보안 태세

- 오디언스를 게이트웨이에 고정하는 리소스 인디케이터(resource indicator)와 함께하는 OAuth 2.1 + PKCE.
- 게이트웨이가 업스트림 자격 증명을 보유한다; 사용자는 그것들을 결코 보지 못한다.
- RBAC: `alice`는 `research:read`, `research:write`를 가지며, 모든 툴을 호출할 수 있다. `bob`은 `research:read`를 가지며, `generate_report`를 호출할 수 없다.
- 고정된 설명 매니페스트: 툴 해시가 바뀐 서버는 모두 떨어뜨렸다.
- 둘의 규칙(Rule of Two) 감사: 어떤 툴도 신뢰되지 않은 입력, 민감 데이터, 결과를 낳는 액션을 결합하지 않는다.

### 렌더링

최종 `generate_report` 태스크는 콘텐츠 블록과 `ui://report/current` 리소스를 반환한다. 클라이언트의 호스트(Claude Desktop 등)가 샌드박스 iframe에서 인터랙티브 대시보드를 렌더링한다. 대시보드는 정렬된 논문 목록, 인용 수, 그리고 사용자가 클릭한 어떤 논문에 대해서든 `host.callTool('summarize_paper', {arxiv_id})`를 호출하는 버튼을 담는다.

### 패키징

전체가 다음으로 출하된다:

```
research-system/
  AGENTS.md                     # project conventions
  skills/
    run-research/
      SKILL.md                  # the top-level workflow
  servers/
    research-mcp/               # the MCP server
      pyproject.toml
      src/
  agents/
    writer/                     # the A2A agent
  gateway/
    config.yaml                 # RBAC + pinned manifest
```

사용자는 `docker compose up`으로 배포한다. Claude Code, Cursor, Codex, opencode 사용자는 `run-research` 스킬을 호출해 시스템을 구동할 수 있다.

### 각 Phase 13 레슨이 기여한 것

| 레슨 | 캡스톤이 사용하는 것 |
|--------|------------------------|
| 01-05 | 툴 인터페이스, 제공자 이식성, 병렬 호출, 스키마, 린팅 |
| 06-10 | MCP 프리미티브, 서버, 클라이언트, 전송, 리소스 + 프롬프트 |
| 11-14 | 샘플링, 루트 + 엘리시테이션, 비동기 태스크, `ui://` 앱 |
| 15-17 | 툴 포이즈닝, OAuth 2.1, 게이트웨이 + 레지스트리 |
| 18 | A2A 하위 에이전트 위임 |
| 19 | OTel GenAI 추적 |
| 20 | LLM 계층을 위한 라우팅 게이트웨이 |
| 21 | SKILL.md + AGENTS.md 패키징 |

## 라이브러리로 써보기 (Use It)

`code/main.py`는 이전 레슨들의 패턴을 하나의 실행 가능한 데모로 꿰맨다. 모두 stdlib, 모두 인프로세스(in-process)라 종단 간으로 읽을 수 있다. 리서치 및 보고 시나리오의 전체 흐름을 실행한다: 게이트웨이와의 핸드셰이크, 시뮬레이션된 OAuth 2.1, 병합된 tools/list, 태스크로서의 generate_report, 작성 에이전트로의 A2A 호출, 반환된 ui:// 리소스, 방출된 OTel 스팬.

볼 것:

- 모든 홉(hop)에 걸친 하나의 트레이스 id.
- 게이트웨이 정책이 두 번째 사용자의 쓰기를 차단한다.
- 태스크 수명 주기가 working → completed로 가고 텍스트와 ui:// 콘텐츠를 둘 다 반환한다.
- A2A 호출의 내부 상태가 오케스트레이터(orchestrator)에 불투명하다.
- AGENTS.md와 SKILL.md는 다른 에이전트가 워크플로를 재현하기 위해 필요한 유일한 파일이다.

## 산출물 (Ship It)

이 레슨은 `outputs/skill-ecosystem-blueprint.md`를 만든다. 제품 요구(리서치, 요약, 자동화)가 주어지면, 이 스킬은 전체 아키텍처를 만들어낸다: 어떤 MCP 프리미티브, 어떤 게이트웨이 통제, 어떤 A2A 호출, 어떤 텔레메트리(telemetry), 어떤 패키징.

## 연습 문제 (Exercises)

1. `code/main.py`를 실행하라. 단일 트레이스 id와 스팬이 중첩되는 방식을 기록하라. 데모가 Phase 13의 프리미티브 중 몇 개를 건드리는지 세어라.

2. 데모를 확장하라: 두 번째 백엔드 MCP 서버(예: `bibliography`)를 추가하고 게이트웨이가 그 툴을 동일한 네임스페이스로 병합하는지 확인하라.

3. 가짜 A2A 작성 에이전트를 서브프로세스에서 실행되는 실제 것으로 교체하라. 레슨 19의 하니스를 사용하라.

4. 오케스트레이터와 LLM 사이의 라우팅 게이트웨이에 PII 마스킹 단계를 추가하라. 사용자 쿼리의 이메일이 정리되는지 확인하라.

5. 이 시스템을 유지할 팀원을 위한 AGENTS.md를 작성하라. 읽는 데 5분 미만이 걸리고, 그들이 Cursor나 Codex에서 캡스톤을 구동하는 데 필요한 모든 것을 줘야 한다.

## 핵심 용어 (Key Terms)

| 용어 | 사람들이 말하는 것 | 실제 의미 |
|------|----------------|------------------------|
| 캡스톤(Capstone) | "Phase 13 통합 데모" | 모든 프리미티브를 사용하는 종단 간 시스템 |
| 리서치 및 보고(Research and report) | "시나리오" | 검색, 요약, 렌더링 패턴 |
| 생태계(Ecosystem) | "모든 조각을 함께" | 서버 + 클라이언트 + 게이트웨이 + 하위 에이전트 + 텔레메트리 + 패키지 |
| 트레이스 계층(Trace hierarchy) | "단일 트레이스 id" | 모든 홉의 스팬이 트레이스를 공유한다; 스팬 id를 통한 부모-자식 |
| 게이트웨이 발급 토큰(Gateway-issued token) | "전이적 인증" | 클라이언트는 게이트웨이의 토큰만 본다; 게이트웨이가 업스트림 자격 증명을 보유한다 |
| 병합된 네임스페이스(Merged namespace) | "하나의 평면 목록 안의 모든 툴" | 게이트웨이에서의 멀티 서버 병합, 충돌 시 접두어 |
| 불투명성 경계(Opacity boundary) | "A2A 호출이 내부를 숨긴다" | 하위 에이전트의 추론이 오케스트레이터에 보이지 않는다 |
| 3계층 스택(Three-layer stack) | "AGENTS.md + SKILL.md + MCP" | 프로젝트 컨텍스트 + 워크플로 + 툴 |
| 심층 방어(Defense-in-depth) | "다중 보안 계층" | 고정된 해시, OAuth, RBAC, 둘의 규칙, 감사 로그 |
| 스펙 준수 매트릭스(Spec compliance matrix) | "스펙이 요구하는 것 중 우리가 출하하는 것" | 산출물을 2025-11-25 요구사항에 매핑하는 체크리스트 |

## 더 읽을거리 (Further Reading)

- [MCP — Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — 통합 레퍼런스
- [MCP blog — 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — 프로토콜이 향하는 곳
- [a2a-protocol.org](https://a2a-protocol.org/latest/) — A2A v1.0 레퍼런스
- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — 표준 추적 컨벤션
- [Anthropic — Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) — 프로덕션 에이전트 런타임 패턴
