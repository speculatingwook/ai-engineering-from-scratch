# 비동기 태스크 (SEP-1686) — 장기 실행 작업을 위한 호출-지금, 가져오기-나중에

> 실제 에이전트 작업은 수 분에서 수 시간이 걸린다. CI 실행, 딥 리서치 합성, 배치 내보내기가 그렇다. 동기(synchronous) 도구 호출은 연결을 끊거나 타임아웃되거나 UI를 막는다. 2025-11-25에 병합된 SEP-1686은 태스크(Task) 프리미티브(primitive)를 추가한다. 어떤 요청이든 태스크가 되도록 증강(augment)할 수 있고, 결과는 나중에 가져오거나 상태 알림(state notification)으로 스트리밍한다. 드리프트(drift) 위험을 짚어두자면, 태스크는 2026년 상반기까지 실험적이다. SDK 표면도 아직 사양을 중심으로 설계하는 중이다.

**Type:** Build
**Languages:** Python (stdlib, async task state machine)
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 09 (transports)
**Time:** ~75분

## 학습 목표 (Learning Objectives)

- 도구를 동기에서 태스크 증강으로 승격해야 할 때를 식별하기(서버 측 작업 30초 초과).
- 태스크 생명주기를 따라가기: `working` → `input_required` → `completed` / `failed` / `cancelled`.
- 크래시가 진행 중인 작업을 잃지 않도록 태스크 상태를 영속화(persist)하기.
- `tasks/status`를 폴링하고 `tasks/result`를 올바르게 가져오기.

## 문제 (The Problem)

`generate_report` 도구가 수 분짜리 추출 파이프라인(pipeline)을 실행한다. 동기 모델에서의 옵션:

1. 3분 동안 연결을 열어둔다. 원격 트랜스포트가 이를 끊고, 클라이언트가 타임아웃되고, UI가 멈춘다.
2. 플레이스홀더와 함께 즉시 반환하고, 클라이언트가 커스텀 엔드포인트를 폴링하도록 요구한다. MCP 균일성을 깬다.
3. 발사 후 망각(fire-and-forget). 결과 없음.

어느 것도 좋지 않다. SEP-1686은 네 번째를 추가한다. 태스크 증강이다. 어떤 요청이든(보통 `tools/call`) 태스크로 태깅할 수 있다. 서버는 태스크 id를 즉시 반환한다. 클라이언트는 `tasks/status`를 폴링하고 완료되면 `tasks/result`를 가져온다. 서버 측 상태는 재시작에서도 살아남는다.

## 개념 (The Concept)

### 태스크 증강

요청은 `params._meta.task.required: true`(또는 `optional: true`, 서버가 결정)를 설정하여 태스크가 된다. 서버는 다음과 함께 즉시 응답한다:

```json
{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "_meta": {
      "task": {
        "id": "tsk_9f7b...",
        "state": "working",
        "ttl": 900000
      }
    }
  }
}
```

`ttl`은 상태를 유지하겠다는 서버의 약속이다. ttl이 지나면 태스크 결과는 폐기된다.

### 도구별 옵트인(opt-in)

도구 어노테이션(annotation)은 태스크 지원을 선언할 수 있다:

- `taskSupport: "forbidden"` — 이 도구는 항상 동기로 실행된다. 빠른 도구에 안전하다.
- `taskSupport: "optional"` — 클라이언트가 태스크 증강을 요청할 수 있다.
- `taskSupport: "required"` — 클라이언트가 반드시 태스크 증강을 써야 한다.

`generate_report` 도구는 `required`일 것이다. `notes_search` 도구는 `forbidden`일 것이다.

### 상태

```
working  -> input_required -> working  (loop via elicitation)
working  -> completed
working  -> failed
working  -> cancelled
```

상태 기계(state machine)는 추가 전용(append-only)이다. 일단 `completed`, `failed`, 또는 `cancelled`가 되면 태스크는 종단(terminal)이다.

### 메서드

- `tasks/status {taskId}` — 현재 상태와 진행 힌트를 반환한다.
- `tasks/result {taskId}` — 아직 완료되지 않았으면 블로킹하거나 404를 반환한다.
- `tasks/cancel {taskId}` — 멱등(idempotent). 종단 상태는 무시한다.
- `tasks/list` — 선택적. 활성 및 최근 완료된 태스크를 열거한다.

### 상태 변경 스트리밍

서버가 지원하면, 클라이언트는 상태 알림을 구독할 수 있다:

```
server -> notifications/tasks/updated {taskId, state, progress?}
```

폴링 대신 스트리밍하는 클라이언트는 더 나은 UX를 얻는다. 폴링은 최소 표면으로서 항상 지원된다.

### 내구성 있는 상태

사양은 태스크 지원을 선언한 서버가 상태를 영속화하도록 요구한다. 크래시가 ttl 내의 완료된 결과를 잃어서는 안 된다. 저장소는 SQLite부터 Redis, 파일 시스템까지 다양하다. Lesson 13 하니스(harness)는 파일 시스템을 사용한다.

### 취소 의미론

`tasks/cancel`은 멱등이다. 태스크가 실행 중이면 서버가 중단을 시도한다(실행자 협력 취소(executor-cooperative cancellation)를 확인하라). 이미 종단이면 요청은 무연산(no-op)이다.

### 크래시 복구

서버 프로세스가 재시작할 때:

1. 영속화된 모든 태스크 상태를 로드한다.
2. 프로세스가 죽은 `working` 태스크를 오류 `CRASH_RECOVERY`와 함께 `failed`로 표시한다.
3. `completed` / `failed` / `cancelled`를 그 ttl 동안 보존한다.

### 비동기 태스크와 샘플링

태스크는 그 자체로 `sampling/createMessage`를 호출할 수 있다. 장기 실행 리서치 태스크가 바로 이렇게 동작한다. 서버의 태스크 스레드가 필요에 따라 클라이언트의 모델을 샘플링(sampling)하는 동안, 클라이언트의 UI는 주기적 진행 업데이트와 함께 태스크를 `working`으로 표시한다.

### 이것이 실험적인 이유

SEP-1686은 2025-11-25에 출시되었지만 더 넓은 로드맵은 세 가지 미해결 이슈를 짚는다. 내구성 있는 구독 프리미티브, 서브태스크(subtask, 부모-자식 태스크 관계), 그리고 결과-TTL 표준화다. 사양은 2026년 내내 진화할 테니 그렇게 예상하라. 프로덕션 코드는 태스크를 흔한 경우에만 안정적으로 취급하고 서브태스크에 대한 미래 SDK 변경에 대비해야 한다.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 내구성 있는 태스크 저장소(파일 시스템 기반)와 백그라운드 스레드에서 실행되는 `generate_report` 도구를 구현한다. 클라이언트는 도구를 호출하고, 태스크 id를 즉시 받고, 워커(worker)가 진행을 업데이트하는 동안 `tasks/status`를 폴링하고, 완료되면 `tasks/result`를 가져온다. 취소가 동작한다. 크래시 복구는 워커 스레드를 죽이고 상태를 다시 로드하여 시뮬레이션한다.

살펴볼 것:

- `/tmp/lesson-13-tasks/<id>.json`에 영속화된 태스크 상태 JSON.
- 워커 스레드가 `progress` 필드를 업데이트한다. 폴링하면 그것이 전진하는 것을 볼 수 있다.
- 클라이언트 측 취소가 이벤트를 설정한다. 워커가 이를 확인하고 일찍 종료한다.
- "크래시" 시 상태 재로드가 진행 중 태스크를 `CRASH_RECOVERY`와 함께 `failed`로 표시한다.

## 산출물 (Ship It)

이 레슨은 `outputs/skill-task-store-designer.md`를 만든다. 장기 실행 도구(리서치, 빌드, 내보내기)가 주어지면, 이 스킬은 태스크 저장소(상태 형태, ttl, 내구성)를 설계하고, 올바른 taskSupport 플래그를 고르고, 진행 알림을 스케치한다.

## 연습 문제 (Exercises)

1. `code/main.py`를 실행한다. `generate_report` 태스크를 시작하고, 상태를 폴링한 뒤, 결과를 가져온다.

2. 실행 도중 `tasks/cancel` 호출을 추가한다. 워커가 이를 존중하고 상태가 `cancelled`가 되는지 확인한다.

3. 크래시 복구를 시뮬레이션한다. 워커 스레드를 죽이고, 로더를 재시작하고, `CRASH_RECOVERY` 실패 모드를 관찰한다.

4. 저장소를 SQLite로 확장한다. 내구성 이득은 같다. 질의 옵션이 열린다(세션 X의 모든 태스크 나열).

5. 2026년 MCP 로드맵 게시물을 읽는다. 내년에 SDK API 설계에 영향을 미칠 가능성이 가장 높은 태스크 관련 미해결 이슈 하나를 식별한다.

## 핵심 용어 (Key Terms)

| 용어 | 흔히 말하는 것 | 실제 의미 |
|------|----------------|------------------------|
| 태스크(Task) | "장기 실행 도구 호출" | 비동기 실행을 위해 `_meta.task`로 증강된 요청 |
| SEP-1686 | "태스크 사양" | 2025-11-25에 태스크를 추가한 사양 진화 제안 |
| `_meta.task` | "태스크 봉투" | id, state, ttl을 담은 요청별 메타데이터 |
| taskSupport | "도구 플래그" | 도구별 `forbidden` / `optional` / `required` |
| `tasks/status` | "폴링 메서드" | 현재 상태와 선택적 진행 힌트를 가져옴 |
| `tasks/result` | "결과 가져오기" | 완료된 페이로드를 반환하거나 아직 미완료면 404 |
| `tasks/cancel` | "중단" | 멱등 취소 요청 |
| ttl | "유지 예산" | 서버가 태스크 상태를 유지하겠다고 약속한 밀리초 |
| `notifications/tasks/updated` | "상태 푸시" | 서버 발의 상태 변경 이벤트 |
| 내구성 있는 저장소 | "크래시 안전 상태" | 파일 시스템 / SQLite / Redis 영속화 계층 |

## 더 읽을거리 (Further Reading)

- [MCP — GitHub SEP-1686 issue](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/1686) — 발단이 된 제안과 전체 토론
- [WorkOS — MCP async tasks for AI agent workflows](https://workos.com/blog/mcp-async-tasks-ai-agent-workflows) — 근거를 동반한 설계 설명
- [DeepWiki — MCP task system and async operations](https://deepwiki.com/modelcontextprotocol/modelcontextprotocol/2.7-task-system-and-async-operations) — 메커니즘과 상태 기계
- [FastMCP — Tasks](https://gofastmcp.com/servers/tasks) — SDK 수준 태스크 구현 패턴
- [MCP blog — 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — 서브태스크를 포함한 미해결 이슈와 2026년 우선순위
