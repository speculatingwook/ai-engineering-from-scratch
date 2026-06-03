# MCP 보안 II — OAuth 2.1, 리소스 표시자, 점진적 스코프

> 원격 MCP 서버는 인증(authentication)만이 아니라 인가(authorization)가 필요하다. 2025-11-25 사양은 OAuth 2.1 + PKCE + 리소스 표시자(resource indicator, RFC 8707) + 보호된 리소스 메타데이터(protected-resource metadata, RFC 9728)와 정렬된다. SEP-835는 403 WWW-Authenticate에 대한 단계 상승 인가(step-up authorization)와 함께 점진적 스코프 동의를 추가한다. 이 레슨은 단계 상승 플로(flow)를 상태 기계(state machine)로 구현해 모든 홉(hop)을 볼 수 있게 한다.

**Type:** Build
**Languages:** Python (stdlib, OAuth state machine simulator)
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 15 (security I)
**Time:** ~75분

## 학습 목표 (Learning Objectives)

- 리소스 서버(resource server)와 인가 서버(authorization server)의 책임을 구분하기.
- PKCE로 보호된 OAuth 2.1 인가 코드 플로를 따라가기.
- 혼동된 대리자(confused-deputy) 공격을 막기 위해 `resource`(RFC 8707)와 보호된 리소스 메타데이터(RFC 9728)를 사용하기.
- 단계 상승 인가 구현하기: 서버가 더 높은 스코프를 요청하는 WWW-Authenticate와 함께 403으로 응답하면, 클라이언트가 사용자 동의를 다시 받아 재시도한다.

## 문제 (The Problem)

초기 MCP(2025년 이전)는 임시 API 키나 심지어 인증 없이 원격 서버를 출시했다. 2025-11-25 사양은 완전한 OAuth 2.1 프로파일로 그 격차를 메운다.

세 가지 실세계 필요:

- **평범한 원격 서버.** 사용자가 자신의 Notion / GitHub / Gmail에 접근하는 원격 MCP 서버를 설치한다. PKCE를 동반한 OAuth 2.1이 올바른 형태다.
- **스코프 에스컬레이션.** `notes:read`를 부여받은 노트 서버가 나중에 특정 동작을 위해 `notes:write`가 필요해질 수 있다. 전체 플로를 다시 하는 대신, 단계 상승(SEP-835)이 추가 스코프를 요청한다.
- **혼동된 대리자 방지.** 클라이언트가 서버 A에 대상(audience) 범위가 지정된 토큰을 보유한다. 악의적인 서버 A가 그 토큰을 서버 B에 제시하려 한다. 리소스 표시자(RFC 8707)는 토큰을 의도된 대상에 고정한다.

OAuth 2.1은 새롭지 않다. 새로운 것은 MCP의 프로파일이다. 특정 필수 플로(인가 코드 + PKCE만. implicit 없음, 기본적으로 client credentials 없음), 모든 토큰 요청에 필수인 리소스 표시자, 그리고 클라이언트가 어디로 가야 할지 알도록 발행되는 보호된 리소스 메타데이터.

## 개념 (The Concept)

### 역할

- **클라이언트.** MCP 클라이언트(Claude Desktop, Cursor 등).
- **리소스 서버.** MCP 서버(노트, GitHub, Postgres, 무엇이든).
- **인가 서버.** 토큰을 발행한다. 리소스 서버와 같은 서비스일 수도, 별도의 IdP(Auth0, Keycloak, Cognito)일 수도 있다.

MCP의 프로파일에서 리소스 서버와 인가 서버는 같은 호스트일 수 있지만 URL로 구분되어야 한다.

### 인가 코드 + PKCE

플로:

1. 클라이언트가 `code_verifier`(무작위)와 `code_challenge`(SHA256)를 생성한다.
2. 클라이언트가 사용자를 `/authorize?response_type=code&client_id=...&redirect_uri=...&scope=notes:read&code_challenge=...&resource=https://notes.example.com`로 리다이렉트한다.
3. 사용자가 동의한다. 인가 서버가 `redirect_uri?code=...`로 리다이렉트한다.
4. 클라이언트가 `/token?grant_type=authorization_code&code=...&code_verifier=...&resource=...`로 POST한다.
5. 인가 서버가 검증자(verifier)의 해시를 저장된 챌린지에 대해 검증하고 액세스 토큰을 발행한다.
6. 클라이언트가 토큰을 사용한다: 리소스 서버로의 모든 요청에 `Authorization: Bearer ...`.

PKCE는 인가 코드 가로채기 공격을 막는다. 리소스 표시자는 토큰이 다른 곳에서 유효해지는 것을 막는다.

### 보호된 리소스 메타데이터 (RFC 9728)

리소스 서버가 `.well-known/oauth-protected-resource` 문서를 발행한다:

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com"],
  "scopes_supported": ["notes:read", "notes:write", "notes:delete"]
}
```

클라이언트는 리소스 서버로부터 인가 서버를 발견한다. 구성이 줄어든다. 클라이언트에 필요한 것은 리소스 URL뿐이다.

### 리소스 표시자 (RFC 8707)

토큰 요청의 `resource` 매개변수는 토큰의 의도된 대상을 고정한다. 발행된 토큰은 `aud: "https://notes.example.com"`를 담는다. 이 토큰을 받는 다른 MCP 서버는 `aud`를 검사하고 거부한다.

### 스코프 모델

스코프는 공백으로 구분된 문자열이다. 흔한 MCP 규약:

- `notes:read`, `notes:write`, `notes:delete`
- 관리자 기능을 위한 `admin:*`(아껴서 사용)
- 신원을 위한 `profile:read`

스코프 선택은 최소 권한(least-privilege)이어야 한다. 지금 필요한 것을 요청하고, 더 필요할 때 단계 상승한다.

### 단계 상승 인가 (SEP-835)

사용자가 `notes:read`를 부여한다. 그러다 나중에 에이전트에게 노트를 삭제하라고 요청한다. 서버가 응답한다:

```
HTTP/1.1 403 Forbidden
WWW-Authenticate: Bearer error="insufficient_scope",
    scope="notes:delete", resource="https://notes.example.com"
```

클라이언트는 insufficient_scope 오류를 보고 추가 스코프에 대한 동의 다이얼로그로 사용자에게 요청한 뒤, 그것을 위한 미니 OAuth 플로를 수행하고 새 토큰으로 요청을 재시도한다.

### 토큰 대상 검증

모든 요청에서: 서버가 `token.aud == self.resource_url`을 검사한다. 불일치 = 401. 이것은 교차 서버 토큰 재사용을 막는다.

### 단명 토큰과 회전

액세스 토큰은 단명(short-lived)이어야 한다(기본 1시간). 리프레시 토큰은 매 갱신마다 회전한다. 클라이언트가 백그라운드에서 조용한 갱신을 처리한다.

### 토큰 통과 금지

샘플링 서버(Phase 13 · 11)는 클라이언트의 토큰을 다른 서비스로 통과(passthrough)시켜서는 안 된다. 샘플링 요청이 경계다.

### 혼동된 대리자 방지

토큰은 `aud`에 바인딩된다. 클라이언트는 `client_id`에 바인딩된다. 모든 요청이 둘 다에 대해 검증된다. 사양은 MCP 이전 원격 도구 생태계에서 흔했던 옛 "토큰 전달(pass-the-token)" 패턴을 명시적으로 금지한다.

### 클라이언트 ID 발견

각 MCP 클라이언트는 고정된 URL에 자신의 메타데이터를 발행한다. 인가 서버는 클라이언트의 메타데이터 문서를 가져와 리다이렉트 URI와 연락처 정보를 발견할 수 있다. 이렇게 하면 수동 클라이언트 등록이 없어진다.

### 게이트웨이와 OAuth

Phase 13 · 17은 엔터프라이즈 게이트웨이가 OAuth를 어떻게 처리하는지 보여준다. 게이트웨이가 업스트림 서버에 대한 자격 증명을 보유하고, 클라이언트로의 토큰은 게이트웨이가 발행하며, 업스트림 토큰은 게이트웨이를 결코 떠나지 않는다. 이것은 신뢰 모델을 뒤집는다. 사용자는 게이트웨이와 한 번 인증하고, 게이트웨이가 N개의 서버 인가를 처리한다.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 완전한 OAuth 2.1 단계 상승 플로를 상태 기계로 시뮬레이션한다. 다음을 구현한다:

- PKCE 코드 검증자 / 챌린지 생성.
- 리소스 표시자를 동반한 인가 코드 플로.
- 보호된 리소스 메타데이터 엔드포인트.
- 대상 검사를 동반한 토큰 검증.
- `insufficient_scope`에 대한 단계 상승.

이 레슨에는 HTTP 서버가 없다. 상태 기계가 메모리에서 실행되어 모든 홉을 추적할 수 있다. Phase 13 · 17의 게이트웨이 레슨이 이를 실제 트랜스포트에 연결한다.

## 산출물 (Ship It)

이 레슨은 `outputs/skill-oauth-scope-planner.md`를 만든다. 도구를 가진 원격 MCP 서버가 주어지면, 이 스킬은 스코프 집합, 고정 규칙, 단계 상승 정책을 설계한다.

## 연습 문제 (Exercises)

1. `code/main.py`를 실행한다. 두-스코프 단계 상승 플로를 추적한다. 단계 상승 시 어떤 홉이 반복되는지 적는다.

2. 리프레시 토큰 회전을 추가한다. 매 갱신마다 새 리프레시 토큰을 발행하고 옛것을 무효화한다. 회전 후 탈취된 리프레시 토큰이 사용되는 것을 시뮬레이션하고 실패하는지 확인한다.

3. stdlib http.server를 사용해 보호된 리소스 메타데이터 엔드포인트를 실제 HTTP 응답으로 구현한다. Lesson 09의 /mcp 엔드포인트를 반영한다.

4. GitHub MCP 서버를 위한 스코프 계층을 설계한다: 리포 읽기, PR 쓰기, PR 승인, PR 머지, 관리자. 각 수준 사이에 단계 상승을 사용한다.

5. RFC 8707과 RFC 9728을 읽는다. MCP가 RFC의 예제와 다르게 사용하는 9728의 필드 하나를 식별한다. (힌트: `scopes_supported`에 관한 것이다.)

## 핵심 용어 (Key Terms)

| 용어 | 흔히 말하는 것 | 실제 의미 |
|------|----------------|------------------------|
| OAuth 2.1 | "현대 OAuth" | PKCE를 의무화하고 implicit 플로를 금지하는 통합 RFC |
| PKCE | "소유 증명" | 인가 코드 가로채기를 막는 코드 검증자 + 챌린지 |
| 리소스 표시자 | "토큰 대상" | 토큰을 한 서버에 고정하는 RFC 8707 `resource` 매개변수 |
| 보호된 리소스 메타데이터 | "발견 문서" | RFC 9728 `.well-known/oauth-protected-resource` |
| 단계 상승 인가 | "점진적 동의" | 필요 시 스코프를 추가하는 SEP-835 플로 |
| `insufficient_scope` | "WWW-Authenticate를 동반한 403" | 더 큰 스코프에 재동의하라는 서버 신호 |
| 혼동된 대리자 | "서비스 간 토큰 재사용" | 신뢰받는 보유자가 토큰을 부적절하게 전달하는 공격 |
| 단명 토큰 | "액세스 토큰 TTL" | 빠르게 만료되는 Bearer. 리프레시 토큰이 갱신 |
| 스코프 계층 | "최소 권한 스택" | 수준 사이에 단계 상승이 있는 점진적 스코프 집합 |
| 클라이언트 ID 메타데이터 | "클라이언트 발견 문서" | 클라이언트가 자신의 OAuth 메타데이터를 발행하는 URL |

## 더 읽을거리 (Further Reading)

- [MCP — Authorization spec](https://modelcontextprotocol.io/specification/draft/basic/authorization) — 표준 MCP OAuth 프로파일
- [den.dev — MCP November authorization spec](https://den.dev/blog/mcp-november-authorization-spec/) — 2025-11-25 변경 사항 설명
- [RFC 8707 — Resource indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) — 대상 고정 RFC
- [RFC 9728 — OAuth 2.0 protected resource metadata](https://datatracker.ietf.org/doc/html/rfc9728) — 발견 문서 RFC
- [Aembit — MCP OAuth 2.1, PKCE and the future of AI authorization](https://aembit.io/blog/mcp-oauth-2-1-pkce-and-the-future-of-ai-authorization/) — 실용적 단계 상승 플로 설명
