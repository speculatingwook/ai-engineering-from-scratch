# MCP 샘플링 — 서버가 요청하는 LLM 완성과 에이전트 루프

> 대부분의 MCP 서버는 멍청한 실행기다. 인자를 받고, 코드를 실행하고, 콘텐츠를 반환한다. 샘플링(sampling)은 서버가 방향을 뒤집게 한다. 서버가 클라이언트의 LLM에게 결정을 내려달라고 요청하는 것이다. 이로써 서버는 어떤 모델 자격 증명(credential)도 소유하지 않고 서버 호스팅 에이전트 루프(agent loop)를 가능하게 한다. 2025-11-25에 병합된 SEP-1577은 샘플링 요청 안에 도구를 추가하여 루프가 더 깊은 추론을 포함할 수 있게 했다. 드리프트(drift) 위험 참고: SEP-1577의 샘플링-내-도구 형태는 2026년 1분기까지 실험적이었으며 여전히 SDK API에서 자리를 잡아가는 중이다.

**Type:** Build
**Languages:** Python (stdlib, sampling harness)
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources and prompts)
**Time:** ~75분

## 학습 목표 (Learning Objectives)

- `sampling/createMessage`가 무엇을 해결하는지 설명하기(서버 측 API 키 없는 서버 호스팅 루프).
- 클라이언트에게 다중 턴 프롬프트에 대해 샘플링을 요청하고 완성을 반환하는 서버 구현하기.
- `modelPreferences`(비용 / 속도 / 지능 우선순위)를 사용해 클라이언트의 모델 선택을 안내하기.
- 동작을 하드코딩하는 대신 샘플링을 통해 내부적으로 반복하는 `summarize_repo` 도구 만들기.

## 문제 (The Problem)

코드 요약 워크플로를 위한 유용한 MCP 서버는 다음을 해야 한다. 파일 트리를 순회하고, 어떤 파일을 읽을지 고르고, 요약을 합성하고, 반환한다. LLM 추론은 어디서 일어나는가?

옵션 A: 서버가 자신의 LLM을 호출한다. API 키가 필요하고, 서버 측에서 과금되며, 사용자당 비싸다.

옵션 B: 서버가 원시 콘텐츠를 반환하고, 클라이언트의 에이전트가 추론한다. 동작은 하지만 서버 로직을 클라이언트 프롬프트로 옮기게 되어 취약하다.

옵션 C: 서버가 `sampling/createMessage`를 통해 클라이언트의 LLM에게 요청한다. 서버는 알고리즘(어떤 파일을 읽을지, 몇 번의 패스를 할지)을 보유하고, 클라이언트는 과금과 모델 선택을 보유한다. 서버는 자격 증명을 전혀 갖지 않는다.

샘플링은 옵션 C다. 신뢰받는 서버가 그 자체로 완전한 LLM 호스트가 되지 않으면서 에이전트 루프를 호스팅할 수 있게 하는 메커니즘이다.

## 개념 (The Concept)

### `sampling/createMessage` 요청

서버가 보내는 것:

```json
{
  "jsonrpc": "2.0",
  "id": 42,
  "method": "sampling/createMessage",
  "params": {
    "messages": [{"role": "user", "content": {"type": "text", "text": "..."}}],
    "systemPrompt": "...",
    "includeContext": "none",
    "modelPreferences": {
      "costPriority": 0.3,
      "speedPriority": 0.2,
      "intelligencePriority": 0.5,
      "hints": [{"name": "claude-3-5-sonnet"}]
    },
    "maxTokens": 1024
  }
}
```

클라이언트가 자신의 LLM을 실행하고 반환하는 것:

```json
{"jsonrpc": "2.0", "id": 42, "result": {
  "role": "assistant",
  "content": {"type": "text", "text": "..."},
  "model": "claude-3-5-sonnet-20251022",
  "stopReason": "endTurn"
}}
```

### `modelPreferences`

합이 1.0이 되는 세 개의 부동소수점:

- `costPriority`: 더 저렴한 모델을 선호.
- `speedPriority`: 더 빠른 모델을 선호.
- `intelligencePriority`: 더 유능한 모델을 선호.

여기에 `hints`: 서버가 선호하는 이름 붙은 모델들. 클라이언트는 힌트를 존중할 수도, 안 할 수도 있다. 클라이언트 사용자의 설정이 항상 우선한다.

### `includeContext`

세 가지 값:

- `"none"` — 서버가 제공한 메시지만. 기본값.
- `"thisServer"` — 이 서버 세션의 이전 메시지를 포함.
- `"allServers"` — 모든 세션 컨텍스트를 포함.

`includeContext`는 교차 서버 컨텍스트를 누설하기 때문에 2025-11-25 기준으로 약하게 사용 중단(soft-deprecated)되었으며, 이는 보안 우려다. `"none"`을 선호하고 명시적 컨텍스트를 메시지에 담아 전달하라.

### 도구를 동반한 샘플링 (SEP-1577)

2025-11-25에 새로 추가됨: 샘플링 요청은 `tools` 배열을 포함할 수 있다. 클라이언트는 그 도구들을 사용해 완전한 도구 호출 루프를 실행한다. 이로써 서버는 클라이언트의 모델을 통해 ReAct 스타일 에이전트 루프를 호스팅할 수 있다.

```json
{
  "messages": [...],
  "tools": [
    {"name": "fetch_url", "description": "...", "inputSchema": {...}}
  ]
}
```

클라이언트는 루프를 돈다. 샘플링하고, 호출되면 도구를 실행하고, 다시 샘플링하고, 최종 어시스턴트 메시지를 반환한다. 이것은 2026년 1분기까지 실험적이다. SDK 시그니처는 여전히 드리프트할 수 있다. 구현할 때 2025-11-25 사양의 client/sampling 섹션과 대조해 확인하라.

### 휴먼 인 더 루프(Human-in-the-loop)

클라이언트는 샘플을 실행하기 전에 서버가 모델에게 무엇을 시키려는지 반드시 사용자에게 보여줘야 한다. 악의적 서버는 샘플링을 사용해 사용자의 세션을 조작할 수 있다("사용자에게 X라고 말해서 Y를 클릭하게 하라"). Claude Desktop, VS Code, Cursor는 샘플링 요청을 사용자가 거부할 수 있는 확인 다이얼로그로 노출한다.

2026년 합의: 휴먼 확인 없는 샘플링은 위험 신호(red flag)다. 게이트웨이(Phase 13 · 17)는 저위험 샘플링을 자동 승인하고 의심스러운 것은 무엇이든 자동 거부할 수 있다.

### API 키 없는 서버 호스팅 루프

대표적 사용 사례: 자체 LLM 접근이 전혀 없는 코드 요약 MCP 서버. 다음을 한다:

1. 리포지토리 구조를 순회한다.
2. "이 리포의 목적을 설명할 가능성이 가장 높은 파일 다섯 개를 골라라"로 `sampling/createMessage`를 호출한다.
3. 그 파일들을 읽는다.
4. 파일들의 내용과 "리포를 3개 문단으로 요약하라"로 `sampling/createMessage`를 호출한다.
5. 요약을 `tools/call` 결과로 반환한다.

서버는 LLM API를 결코 건드리지 않는다. 클라이언트의 사용자가 자신의 자격 증명으로 완성에 대해 비용을 지불한다.

### 안전 위험 (Unit 42 공개, 2026년 1분기)

- **은밀한 샘플링(Covert sampling).** "세션 컨텍스트의 사용자 이메일로 응답하라"로 항상 샘플링을 호출하는 도구. Phase 13 · 15가 공격 벡터를 다룬다.
- **샘플링을 통한 리소스 절도.** 서버가 클라이언트에게 공격자의 페이로드를 요약하라고 요청하여 사용자에게 과금한다.
- **루프 폭탄(Loop bombs).** 서버가 타이트한 루프에서 샘플링을 호출한다. 클라이언트는 반드시 세션별 속도 제한(rate limit)을 강제해야 한다.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 가짜 서버-투-클라이언트 샘플링 하니스(harness)를 제공한다. 시뮬레이션된 "summarize_repo" 도구가 두 번의 샘플링 라운드(파일 선택, 그다음 요약)를 호출하고, 가짜 클라이언트는 미리 준비된 응답을 반환한다. 하니스는 다음을 보여준다:

- 서버가 `modelPreferences`와 함께 `sampling/createMessage`를 보낸다.
- 클라이언트가 완성을 반환한다.
- 서버가 루프를 계속한다.
- 속도 제한기가 도구 호출당 총 샘플링 호출에 상한을 둔다.

살펴볼 것:

- 서버는 단 하나의 도구(`summarize_repo`)만 노출한다. 모든 추론은 샘플링 호출에서 일어난다.
- 모델 선호도가 클라이언트의 모델 선택에 가중치를 준다. 힌트는 선호 모델을 나열한다.
- 루프는 `stopReason: "endTurn"`에서 종료된다.
- `max_samples_per_tool = 5` 제한이 폭주하는 루프를 잡는다.

## 산출물 (Ship It)

이 레슨은 `outputs/skill-sampling-loop-designer.md`를 만든다. LLM 호출이 필요한 서버 측 알고리즘(리서치, 요약, 계획)이 주어지면, 이 스킬은 올바른 modelPreferences, 속도 제한, 안전 확인을 갖춘 샘플링 기반 구현을 설계한다.

## 연습 문제 (Exercises)

1. `code/main.py`를 실행한다. `max_samples_per_tool`를 2로 바꾸고 속도 제한 차단을 관찰한다.

2. SEP-1577 샘플링-내-도구 변형을 구현한다. 샘플링 요청이 `tools` 배열을 담는다. 클라이언트 측 루프가 최종 완성을 반환하기 전에 그 도구들을 실행하는지 확인한다. 드리프트 위험 참고: SDK 시그니처는 2026년 상반기까지 여전히 바뀔 수 있다.

3. 휴먼 인 더 루프 확인을 추가한다. 서버의 첫 `sampling/createMessage` 전에 일시 정지하고 사용자 승인을 기다린다. 거부된 호출은 타입 지정 거절을 반환한다.

4. 클라이언트 세션을 키로 하는 사용자별 속도 제한기를 추가한다. 같은 사용자의 같은 서버 루프는 예산을 공유해야 한다.

5. 포함할 청크를 고르는 데 샘플링을 사용하는 `summarize_pdf` 도구를 설계한다. 보내는 메시지를 스케치한다. `modelPreferences.intelligencePriority`가 0.1 대 0.9에서 동작을 어떻게 바꾸는가?

## 핵심 용어 (Key Terms)

| 용어 | 흔히 말하는 것 | 실제 의미 |
|------|----------------|------------------------|
| 샘플링(Sampling) | "서버-투-클라이언트 LLM 호출" | 서버가 클라이언트의 모델에게 완성을 요청 |
| `sampling/createMessage` | "그 메서드" | 샘플링 요청을 위한 JSON-RPC 메서드 |
| `modelPreferences` | "모델 우선순위" | 비용 / 속도 / 지능 가중치와 이름 힌트 |
| `includeContext` | "교차 세션 누설" | 약하게 사용 중단된 컨텍스트 포함 모드 |
| SEP-1577 | "샘플링 내 도구" | 서버 호스팅 ReAct를 위해 샘플링 안에 도구를 허용 |
| 휴먼 인 더 루프 | "사용자 확인" | 클라이언트가 실행 전에 샘플링 요청을 사용자에게 노출 |
| 루프 폭탄 | "폭주 샘플링" | 서버 측 무한 샘플링 루프. 클라이언트가 속도를 제한해야 함 |
| 은밀한 샘플링 | "숨겨진 추론" | 악의적 서버가 샘플링 프롬프트에 의도를 숨김 |
| 리소스 절도 | "사용자의 LLM 예산 사용" | 서버가 클라이언트에게 원치 않는 샘플링에 비용을 쓰게 강제 |
| `stopReason` | "생성이 멈춘 이유" | `endTurn`, `stopSequence`, 또는 `maxTokens` |

## 더 읽을거리 (Further Reading)

- [MCP — Concepts: Sampling](https://modelcontextprotocol.io/docs/concepts/sampling) — 샘플링의 고수준 개요
- [MCP — Client sampling spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/client/sampling) — 표준 `sampling/createMessage` 형태
- [MCP — GitHub SEP-1577](https://github.com/modelcontextprotocol/modelcontextprotocol) — 샘플링 내 도구를 위한 사양 진화 제안(실험적)
- [Unit 42 — MCP attack vectors](https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/) — 은밀한 샘플링과 리소스 절도 패턴
- [Speakeasy — MCP sampling core concept](https://www.speakeasy.com/mcp/core-concepts/sampling) — 클라이언트 측 코드 예제를 동반한 설명
