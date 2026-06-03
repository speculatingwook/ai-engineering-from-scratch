# 루트와 유도 — 범위 지정과 작업 중간의 사용자 입력

> 하드코딩된 경로는 사용자가 다른 프로젝트를 여는 순간 깨진다. 미리 채워진 도구 인자는 사용자가 충분히 명시하지 않으면 깨진다. 루트(root)는 서버가 다룰 범위를 사용자가 제어하는 URI 집합으로 한정한다. 유도(elicitation)는 도구 호출 중간에 일시 정지하여 폼이나 URL로 사용자에게 구조화된 입력을 요청한다. 이 두 클라이언트 프리미티브(primitive)는 흔한 MCP 실패 모드에 대한 두 가지 해결책이다. SEP-1036(URL 모드 유도, 2025-11-25)은 2026년 상반기까지 실험적이다. 여기에 의존하기 전에 SDK 버전을 확인하라.

**Type:** Build
**Languages:** Python (stdlib, roots + elicitation demo)
**Prerequisites:** Phase 13 · 07 (MCP server)
**Time:** ~45분

## 학습 목표 (Learning Objectives)

- `roots`를 선언하고 `notifications/roots/list_changed`에 응답하기.
- 서버 파일 작업을 선언된 루트 집합 내부의 URI로 제한하기.
- `elicitation/create`를 사용해 도구 호출 중간에 사용자에게 확인이나 구조화된 입력을 요청하기.
- 폼 모드와 URL 모드 유도 중에서 선택하기(후자는 실험적이며 드리프트 위험이 명시됨).

## 문제 (The Problem)

노트 MCP 서버가 프로덕션(production)에서 부딪히는 두 가지 구체적 실패.

**깨진 경로 가정.** 서버가 `~/notes`를 기준으로 작성되었다. 노트가 `~/Documents/Notes`에 있는 다른 머신의 사용자는 조용히 실패하거나(파일을 찾지 못함) 더 나쁘게는 잘못된 곳에 쓴 도구 호출을 받는다.

**사용자는 알지만 빠진 인자.** 사용자가 "오래된 TPS 리포트 노트를 삭제해줘"라고 요청한다. 모델이 `notes_delete(title: "TPS report")`를 호출하지만 2023, 2024, 2025년의 일치하는 노트가 세 개 있다. 도구는 추측할 수 없다. "모호함"으로 실패하면 짜증나고, 세 개 모두에 실행하면 재앙이다.

루트는 첫 번째를 고친다. 클라이언트가 `initialize`에서 서버가 건드릴 수 있는 URI 집합을 선언한다. 유도는 두 번째를 고친다. 서버가 도구 호출을 일시 정지하고 `elicitation/create`를 보내 사용자에게 어느 것을 고를지 묻는다.

## 개념 (The Concept)

### 루트

클라이언트가 `initialize`에서 루트 목록을 선언한다:

```json
{
  "capabilities": {"roots": {"listChanged": true}}
}
```

그러면 서버는 `roots/list`를 호출할 수 있다:

```json
{"roots": [{"uri": "file:///Users/alice/Documents/Notes", "name": "Notes"}]}
```

서버는 반드시 루트를 경계로 취급해야 한다. 루트 집합 외부의 파일 읽기나 쓰기는 거부된다. 클라이언트가 이를 강제하지는 않지만(서버는 여전히 사용자가 신뢰한 코드다), 사양을 준수하는 서버는 이를 존중한다.

사용자가 루트를 추가하거나 제거하면 클라이언트는 `notifications/roots/list_changed`를 보낸다. 서버는 `roots/list`를 다시 호출하고 경계를 업데이트한다.

### 루트가 클라이언트 프리미티브인 이유

루트는 사용자의 동의 모델을 나타내므로 클라이언트가 선언한다. 사용자가 Claude Desktop에게 "이 노트 서버에게 이 두 디렉터리에 대한 접근을 줘"라고 말한 것이다. 서버는 그 범위를 넓힐 수 없다.

### 유도: 폼 모드 기본값

`elicitation/create`는 폼 스키마와 자연어 프롬프트를 받는다:

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "Delete 'TPS report'? Multiple notes match; pick one.",
    "requestedSchema": {
      "type": "object",
      "properties": {
        "note_id": {
          "type": "string",
          "enum": ["note-3", "note-7", "note-14"]
        },
        "confirm": {"type": "boolean"}
      },
      "required": ["note_id", "confirm"]
    }
  }
}
```

클라이언트가 폼을 렌더링하고 사용자의 답을 수집하여 반환한다:

```json
{
  "action": "accept",
  "content": {"note_id": "note-14", "confirm": true}
}
```

가능한 세 가지 액션: `accept`(사용자가 채움), `decline`(사용자가 닫음), `cancel`(사용자가 전체 도구 호출을 중단함).

폼 스키마는 평평하다(flat). 중첩 객체는 v1에서 지원되지 않는다. SDK는 보통 단일 계층보다 복잡한 것은 무엇이든 거부한다.

### 유도: URL 모드 (SEP-1036, 실험적)

2025-11-25에 새로 추가됨. 스키마 대신 서버가 URL을 보낸다:

```json
{
  "method": "elicitation/create",
  "params": {
    "message": "Sign in to GitHub",
    "url": "https://github.com/login/oauth/authorize?client_id=..."
  }
}
```

클라이언트가 브라우저에서 URL을 열고, 완료를 기다리며, 사용자가 돌아오면 반환한다. 폼으로는 부족한 OAuth 플로(flow), 결제 인증, 문서 서명에 유용하다.

드리프트 위험 참고: SEP-1036 응답 형태는 여전히 자리를 잡아가는 중이다. 어떤 SDK는 콜백 URL을 반환하고, 어떤 것은 완료 토큰을 반환한다. 프로덕션에서 URL 모드를 쓰기 전에 SDK의 릴리스 노트를 읽어라.

### 유도가 올바른 도구일 때

- 파괴적 동작 전 사용자 확인(파괴적 힌트(destructive hint) + 유도).
- 명확화(N개 일치 중 하나 선택).
- 첫 실행 설정(API 키, 디렉터리, 환경설정).
- OAuth 스타일 플로(URL 모드).

### 유도가 틀린 경우

- 모델이 산문으로 물어볼 수 있었던 도구의 필수 인자를 채우는 것. 유도 다이얼로그가 아니라 일반적인 재프롬프트를 사용하라.
- 고빈도 호출. 유도는 대화를 중단시킨다. 루프 안에서 발사하지 말라.
- 서버가 사후에 검증할 수 있는 모든 것. 검증하고, 오류를 반환하고, 모델이 텍스트로 사용자에게 묻게 하라.

### 휴먼 인 더 루프(human-in-the-loop) 다리

유도와 샘플링(sampling)을 함께 쓰면 MCP의 "휴먼 인 더 루프" 모델이 가능해진다. 서버의 에이전트 루프는 사용자 입력(유도)이나 모델 추론(샘플링)을 위해 일시 정지할 수 있다. Phase 13 · 11이 샘플링을 다뤘고, 이 레슨이 유도를 다룬다. 완전한 루프 중간 제어를 위해 둘을 함께 두라.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 노트 서버를 다음으로 확장한다:

- root-list-changed 알림 후 서버가 다시 질의하는 `roots/list` 응답.
- 여러 노트가 일치할 때 `elicitation/create`를 사용해 명확화하는 `notes_delete` 도구.
- 첫 실행 구성 페이지를 여는 데 URL 모드 유도를 사용하는 `notes_setup` 도구(시뮬레이션됨).
- 선언된 루트 외부의 URI에 대한 작업을 거부하는 경계 검사.

데모는 세 가지 시나리오를 실행한다: 정상 경로(일치 하나), 명확화(일치 셋, 유도 발사), 루트 외부 쓰기(거부됨).

## 산출물 (Ship It)

이 레슨은 `outputs/skill-elicitation-form-designer.md`를 만든다. 사용자 확인이나 명확화가 필요할 수 있는 도구가 주어지면, 이 스킬은 유도 폼 스키마와 메시지 템플릿을 설계한다.

## 연습 문제 (Exercises)

1. `code/main.py`를 실행한다. 명확화 경로를 트리거하고, 시뮬레이션된 사용자 답변이 도구로 다시 라우팅되는지 확인한다.

2. 매번 유도 확인이 필요한 새 도구 `notes_archive`를 추가한다(파괴적 힌트). UX를 점검한다. 모델이 텍스트로 다시 묻는 것과 어떻게 비교되는가?

3. 첫 실행 OAuth 플로를 위한 URL 모드 유도를 구현한다. 드리프트 위험을 명심하고 SDK 버전 가드를 추가한다.

4. `roots/list` 처리를 확장한다. 알림이 도착하면 서버는 이제 범위 밖일 수 있는 열린 파일 핸들을 원자적으로 다시 읽고 다시 스캔해야 한다.

5. GitHub의 SEP-1036 이슈 토론 스레드를 읽는다. 서버가 URL 모드 콜백을 어떻게 처리해야 하는지에 영향을 미치는 미해결 질문 하나를 식별한다.

## 핵심 용어 (Key Terms)

| 용어 | 흔히 말하는 것 | 실제 의미 |
|------|----------------|------------------------|
| 루트(Root) | "동의 경계" | 클라이언트가 서버에게 건드리도록 허용한 URI |
| `roots/list` | "서버가 범위를 요청" | 클라이언트가 현재 루트 집합을 반환 |
| `notifications/roots/list_changed` | "사용자가 범위를 변경" | 클라이언트가 루트 집합이 변경되었음을 신호 |
| 유도(Elicitation) | "호출 중간에 사용자에게 질문" | 구조화된 사용자 입력을 위한 서버 발의 요청 |
| `elicitation/create` | "그 메서드" | 유도 요청을 위한 JSON-RPC 메서드 |
| 폼 모드 | "스키마 주도 폼" | 클라이언트 UI에서 폼으로 렌더링되는 평평한 JSON Schema |
| URL 모드 | "브라우저 리다이렉트" | SEP-1036 실험적. URL을 열고 기다림 |
| `accept` / `decline` / `cancel` | "사용자 응답 결과" | 서버가 처리하는 세 가지 분기 |
| 명확화(Disambiguation) | "하나 선택" | 도구에 N개 후보가 있을 때 흔한 유도 사용 사례 |
| 평평한 폼 | "최상위 속성만" | 유도 스키마는 중첩될 수 없음 |

## 더 읽을거리 (Further Reading)

- [MCP — Client roots spec](https://modelcontextprotocol.io/specification/draft/client/roots) — 표준 루트 레퍼런스
- [MCP — Client elicitation spec](https://modelcontextprotocol.io/specification/draft/client/elicitation) — 표준 유도 레퍼런스
- [Cisco — What's new in MCP elicitation, structured content, OAuth enhancements](https://blogs.cisco.com/developer/whats-new-in-mcp-elicitation-structured-content-and-oauth-enhancements) — 2025-11-25 추가분 설명
- [MCP — GitHub SEP-1036](https://github.com/modelcontextprotocol/modelcontextprotocol) — URL 모드 유도 제안(실험적, 드리프트 위험)
- [The New Stack — How elicitation brings human-in-the-loop to AI tools](https://thenewstack.io/how-elicitation-in-mcp-brings-human-in-the-loop-to-ai-tools/) — UX 설명
