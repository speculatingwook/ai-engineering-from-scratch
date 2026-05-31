# MCP 앱 — `ui://`를 통한 상호작용형 UI 리소스

> 텍스트 전용 도구 출력은 에이전트가 보여줄 수 있는 것을 제한한다. MCP 앱(MCP Apps, SEP-1724, 2026년 1월 26일 공식화)은 도구가 샌드박스(sandbox) 처리된 상호작용형 HTML을 반환하여 Claude Desktop, ChatGPT, Cursor, Goose, VS Code에서 인라인으로 렌더링되게 한다. 대시보드, 폼, 지도, 3D 장면, 모두 하나의 확장(extension)을 통해서다. 이 레슨은 `ui://` 리소스 스킴, `text/html;profile=mcp-app` MIME, iframe 샌드박스 postMessage 프로토콜, 그리고 서버가 HTML을 렌더링하게 함으로써 따라오는 보안 표면을 따라간다.

**Type:** Build
**Languages:** Python (stdlib, UI resource emitter), HTML (sample app)
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 10 (resources)
**Time:** ~75분

## 학습 목표 (Learning Objectives)

- 도구 호출에서 `ui://` 리소스를 반환하고 올바른 MIME과 메타데이터를 설정하기.
- `_meta.ui.resourceUri`, `_meta.ui.csp`, `_meta.ui.permissions`로 도구의 연관 UI를 선언하기.
- UI-투-호스트 통신을 위한 iframe 샌드박스 postMessage JSON-RPC를 구현하기.
- UI 발(發) 공격을 방어하는 CSP와 permissions-policy 기본값을 적용하기.

## 문제 (The Problem)

2025년대의 `visualize_timeline` 도구는 "다음은 시간순으로 정리된 14개 노트입니다: ..."를 반환할 수 있다. 그것은 한 문단이다. 사용자가 실제로 원하는 것은 상호작용형 타임라인이다. MCP 앱 이전에는 옵션이 이러했다. 클라이언트별 위젯 API(Claude 아티팩트, OpenAI Custom GPT HTML), 또는 UI 전무.

MCP 앱(SEP-1724, 2026년 1월 26일 출시)은 그 계약을 표준화한다. 도구 결과는 URI가 `ui://...`이고 MIME이 `text/html;profile=mcp-app`인 `resource`를 담는다. 호스트는 제한된 CSP를 가진 샌드박스 iframe에서, 명시적으로 부여되지 않는 한 네트워크 접근 없이 이를 렌더링한다. iframe 내부의 UI는 작은 postMessage JSON-RPC 방언을 통해 호스트에 메시지를 보낸다.

모든 호환 클라이언트(Claude Desktop, ChatGPT, Goose, VS Code)는 같은 `ui://` 리소스를 같은 방식으로 렌더링한다. 하나의 서버, 하나의 HTML 번들, 보편적 UI.

## 개념 (The Concept)

### `ui://` 리소스 스킴

도구가 반환하는 것:

```json
{
  "content": [
    {"type": "text", "text": "Here is your notes timeline:"},
    {"type": "ui_resource", "uri": "ui://notes/timeline"}
  ],
  "_meta": {
    "ui": {
      "resourceUri": "ui://notes/timeline",
      "csp": {
        "defaultSrc": "'self'",
        "scriptSrc": "'self' 'unsafe-inline'",
        "connectSrc": "'self'"
      },
      "permissions": []
    }
  }
}
```

그러면 호스트는 `ui://notes/timeline` URI에 대해 `resources/read`를 호출하고 다음을 돌려받는다:

```json
{
  "contents": [{
    "uri": "ui://notes/timeline",
    "mimeType": "text/html;profile=mcp-app",
    "text": "<!doctype html>..."
  }]
}
```

### iframe 샌드박스

호스트는 HTML을 다음을 가진 샌드박스 `<iframe>` 안에서 렌더링한다:

- `sandbox="allow-scripts allow-same-origin"` (또는 서버 선언에 따라 더 엄격하게)
- 응답 헤더를 통해 적용되는 서버 선언 CSP.
- 호스트 출처의 쿠키 없음, localStorage 없음.
- CSP의 `connectSrc`로 제한된 네트워크 접근.

### postMessage 프로토콜

iframe은 `window.postMessage`를 통해 호스트와 통신한다. 작은 JSON-RPC 2.0 방언:

`targetOrigin`을 항상 상대방의 정확한 출처로 고정하고, 수신 측에서는 어떤 페이로드든 처리하기 전에 `event.origin`을 허용 목록(allowlist)에 대해 검증하라. 이 채널의 어느 쪽에도 절대 `"*"`를 쓰지 말라. 본문이 도구 호출과 리소스 읽기를 운반한다.

```js
// iframe to host  (pin to host origin)
window.parent.postMessage({
  jsonrpc: "2.0",
  id: 1,
  method: "host.callTool",
  params: { name: "notes_update", arguments: { id: "note-14", title: "..." } }
}, "https://host.example.com");

// host to iframe  (pin to iframe origin)
iframe.contentWindow.postMessage({
  jsonrpc: "2.0",
  id: 1,
  result: { content: [...] }
}, "https://iframe.example.com");

// receiver on both sides
window.addEventListener("message", (event) => {
  if (event.origin !== "https://expected-peer.example.com") return;
  // safe to process event.data
});
```

UI가 호출할 수 있는 호스트 측 메서드:

- `host.callTool(name, arguments)` — 서버 도구를 호출한다.
- `host.readResource(uri)` — MCP 리소스를 읽는다.
- `host.getPrompt(name, arguments)` — 프롬프트 템플릿을 가져온다.
- `host.close()` — UI를 닫는다.

모든 호출은 여전히 MCP 프로토콜을 거치고 서버의 권한을 상속한다.

### 권한

`_meta.ui.permissions` 목록은 추가 기능을 요청한다:

- `camera` — 사용자의 카메라에 접근(문서 스캔 UI에 사용).
- `microphone` — 음성 입력.
- `geolocation` — 위치.
- `network:*` — `connectSrc`만으로 허용되는 것보다 넓은 네트워크 접근.

각 권한은 UI가 렌더링되기 전에 사용자가 보는 프롬프트다.

### 보안 위험

iframe 안의 HTML은 여전히 HTML이다. 새로운 공격 표면:

- **UI를 통한 프롬프트 주입(Prompt-injection).** 악의적 서버 UI가 시스템 메시지처럼 보이는 텍스트를 보여 사용자를 속일 수 있다. 호스트 렌더링은 서버 UI와 호스트 UI를 시각적으로 구분해야 한다.
- **`connectSrc`를 통한 유출(Exfiltration).** CSP가 `connect-src: *`를 허용하면 UI가 데이터를 어디로든 보낼 수 있다. 기본값은 엄격해야 한다.
- **클릭재킹(Clickjacking).** UI가 호스트 크롬(chrome)을 덮는다. 호스트는 z-index 조작을 막고 불투명도 규칙을 강제해야 한다.
- **포커스 탈취.** UI가 키보드 포커스를 가져가 다음 메시지를 캡처한다. 호스트가 가로채야 한다.

Phase 13 · 15가 이를 MCP 보안의 일부로 깊이 다룬다. 이 레슨은 이를 소개한다.

### `ui/initialize` 핸드셰이크

iframe이 로드된 후, postMessage로 `ui/initialize`를 보낸다:

```json
{"jsonrpc": "2.0", "id": 0, "method": "ui/initialize",
 "params": {"theme": "dark", "locale": "en-US", "sessionId": "..."}}
```

호스트는 기능과 세션 토큰으로 응답한다. UI는 이후 모든 호스트 호출에서 세션 토큰을 사용한다.

### AppRenderer / AppFrame SDK 프리미티브

ext-apps SDK는 두 가지 편의 프리미티브(primitive)를 노출한다:

- `AppRenderer`(서버 측) — React / Vue / Solid 컴포넌트를 감싸 올바른 MIME과 메타데이터를 가진 `ui://` 리소스를 내보낸다.
- `AppFrame`(클라이언트 측) — 리소스를 받아 iframe을 마운트하고 postMessage를 중재한다.

이것들을 쓰거나 HTML과 JSON-RPC를 직접 작성할 수 있다.

### 생태계 현황

MCP 앱은 2026년 1월 26일에 출시되었다. 2026년 4월 기준 클라이언트 지원:

- **Claude Desktop.** 2026년 1월부터 완전 지원.
- **ChatGPT.** Apps SDK를 통한 완전 지원(같은 기저 MCP 앱 프로토콜).
- **Cursor.** 베타. 설정으로 활성화.
- **VS Code.** 인사이더 빌드만.
- **Goose.** 완전 지원.
- **Zed, Windsurf.** 로드맵에 있음.

프로덕션의 서버: 대시보드, 지도 시각화, 데이터 테이블, 차트 빌더, 샌드박스 IDE 미리보기.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 노트 서버를 `ui://notes/timeline` 리소스를 반환하는 `visualize_timeline` 도구로 확장하고, 그 URI에 대한 `resources/read` 핸들러를 더한다. 이 핸들러는 SVG 타임라인이 있는 작지만 완전한 HTML 번들을 반환한다. HTML은 stdlib로 템플릿화된다. 빌드 시스템 없음. stdlib는 브라우저를 구동할 수 없으므로 postMessage는 JS 주석으로 스케치된다.

살펴볼 것:

- 도구 응답의 `_meta.ui`가 resourceUri, CSP, permissions를 운반한다.
- HTML은 네트워크 접근 없이 렌더링된다. 모든 데이터가 인라인이다.
- JS가 `window.parent.postMessage`를 통해 `host.callTool`을 호출한다(문서화되었지만 이 stdlib 데모에서는 비활성).

## 산출물 (Ship It)

이 레슨은 `outputs/skill-mcp-apps-spec.md`를 만든다. 상호작용형 UI의 이득을 볼 수 있는 도구가 주어지면, 이 스킬은 완전한 MCP 앱 계약을 생성한다. `ui://` URI, CSP, permissions, postMessage 진입점, 그리고 보안 체크리스트.

## 연습 문제 (Exercises)

1. `code/main.py`를 실행하고 내보내진 HTML을 검사한다. HTML을 브라우저에서 직접 열고 SVG가 렌더링되는지 확인한다. 그런 다음 UI가 `host.callTool("notes_update", ...)`를 호출하는 데 쓸 postMessage 계약을 스케치한다.

2. CSP를 조인다. `'unsafe-inline'`을 제거하고 논스(nonce) 기반 스크립트 정책을 쓴다. HTML 생성 코드에서 무엇이 바뀌는가?

3. 노트를 제자리에서 편집하는 폼이 있는 두 번째 UI 리소스 `ui://notes/editor`를 추가한다. 사용자가 제출하면 iframe이 `host.callTool("notes_update", ...)`를 호출한다.

4. UI의 공격 표면을 감사한다. 악의적 서버가 어디서 콘텐츠를 주입할 수 있는가? iframe 샌드박스가 무엇을 방어하고 무엇을 방어하지 못하는가?

5. SEP-1724 사양을 읽고 이 장난감 구현이 사용하지 않는 MCP 앱 SDK의 기능 하나를 식별한다. (힌트: 컴포넌트 수준 상태 동기화.)

## 핵심 용어 (Key Terms)

| 용어 | 흔히 말하는 것 | 실제 의미 |
|------|----------------|------------------------|
| MCP 앱(MCP Apps) | "상호작용형 UI 리소스" | 2026-01-26에 출시된 SEP-1724 확장 |
| `ui://` | "앱 URI 스킴" | UI 번들을 위한 리소스 스킴 |
| `text/html;profile=mcp-app` | "그 MIME" | MCP 앱 HTML을 위한 콘텐츠 타입 |
| iframe 샌드박스 | "렌더링 컨테이너" | CSP와 권한으로 UI를 브라우저 샌드박싱 |
| postMessage JSON-RPC | "UI-투-호스트 와이어" | 호스트 호출을 위한 작은 JSON-RPC-오버-postMessage 방언 |
| `_meta.ui` | "도구-UI 바인딩" | 도구 결과를 UI 리소스에 연결하는 메타데이터 |
| CSP | "Content-Security-Policy" | 스크립트, 네트워크, 스타일의 허용 출처를 선언 |
| AppRenderer | "서버 SDK 프리미티브" | 프레임워크 컴포넌트를 `ui://` 리소스로 변환 |
| AppFrame | "클라이언트 SDK 프리미티브" | postMessage를 중재하는 iframe 마운트 헬퍼 |
| `ui/initialize` | "핸드셰이크" | UI에서 호스트로 가는 첫 postMessage |

## 더 읽을거리 (Further Reading)

- [MCP ext-apps — GitHub](https://github.com/modelcontextprotocol/ext-apps) — 레퍼런스 구현과 SDK
- [MCP Apps specification 2026-01-26](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx) — 공식 사양 문서
- [MCP — Apps extension overview](https://modelcontextprotocol.io/extensions/apps/overview) — 고수준 문서
- [MCP blog — MCP Apps launch](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/) — 2026년 1월 출시 게시물
- [MCP Apps API reference](https://apps.extensions.modelcontextprotocol.io/api/) — JSDoc 스타일 SDK 레퍼런스
