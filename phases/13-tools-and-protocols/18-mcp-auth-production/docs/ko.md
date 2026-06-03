# 프로덕션에서의 MCP 인증 — iii 프리미티브 위에서 DCR, JWKS 회전, 오디언스 고정 토큰

> 레슨 16은 OAuth 2.1 상태 머신(state machine)을 메모리에 세웠다. 2026년에는 실제 조직에 출하하는 모든 MCP 서버가 프로덕션(production) 인증 뒤에 자리한다. 동적 클라이언트 등록(dynamic client registration)(RFC 7591), 인가 서버 메타데이터 디스커버리(RFC 8414), 새벽 3시의 토큰 검증을 깨뜨리지 않는 JWKS 회전, 혼동된 대리자(confused-deputy) 재사용을 거부하는 오디언스 고정(audience-pinned) 토큰이 그것이다. 이 레슨은 이 모든 것을 iii 프리미티브로 연결한다. HTTP와 cron을 위한 `iii.registerTrigger`, 인증 로직을 위한 `iii.registerFunction`, 캐시된 키를 위한 `state::set/get`을 엮어, 인증 표면이 엔진의 다른 모든 워크로드처럼 관찰 가능하고 재시작 가능하며 재생 가능하도록 만든다.

**Type:** Build
**Languages:** Python (stdlib, iii primitives mocked for the lesson environment)
**Prerequisites:** Phase 13 · 16 (OAuth 2.1 state machine), Phase 13 · 17 (gateways)
**Time:** ~90분

## 학습 목표 (Learning Objectives)

- RFC 8414 메타데이터로 인가 서버를 디스커버리하고 계약(contract)을 검증하기.
- MCP 클라이언트가 관리자 개입 없이 등록되도록 RFC 7591 동적 클라이언트 등록 구현하기.
- 서명 검증이 키 롤오버(roll-over)에서 살아남도록 cron 트리거로 JWKS 키를 캐싱하고 회전하기.
- RFC 8707 리소스 인디케이터(resource indicator)로 토큰을 단일 MCP 리소스에 고정하고 혼동된 대리자 재사용을 거부하기.
- 모든 엔드포인트와 백그라운드 작업을 iii 프리미티브로 연결하기 — HTTP 트리거, cron 트리거, 명명된 함수, `state::*` 읽기 — 그래서 단 한 번의 재시작이 인증 표면을 재구축한다.
- IdP 역량 매트릭스를 읽고, IdP가 MCP의 인증 프로파일(profile)을 만족하지 못할 때 배포를 거부하기.

## 문제 (The Problem)

레슨 16의 시뮬레이터는 OAuth 2.1을 메모리에서 실행한다. 프로덕션에는 메모리 전용 시뮬레이터가 보지 못하는 세 가지 운영상의 빈틈이 있다.

첫 번째 빈틈은 등록(enrollment)이다. 실제 조직은 수백 개의 MCP 서버와 수천 개의 MCP 클라이언트를 운영한다. 운영자는 모든 Cursor 사용자를 OAuth 클라이언트로 일일이 손으로 등록하지 않는다. RFC 7591 동적 클라이언트 등록은 클라이언트가 인가 서버에 대해 `POST /register`를 하고 그 자리에서 `client_id`(그리고 선택적으로 `client_secret`)를 받게 해준다. 서버는 RFC 8414 메타데이터에 `registration_endpoint`를 게시하고, 클라이언트는 대역 외(out-of-band) 구성 없이 그것을 디스커버리한다.

두 번째 빈틈은 키 회전이다. JWT 검증은 인가 서버의 서명 키에 의존하며, 이 키는 JSON Web Key Set(JWKS)으로 게시된다. 인가 서버는 이를 일정에 따라 회전한다(종종 매시간, 사고 대응 중에는 더 빠르게). 부팅 시 JWKS를 한 번만 가져오는 MCP 서버는 회전 윈도우 전까지는 잘 검증하다가, 그 이후로는 재시작할 때까지 모든 요청이 실패한다. 프로덕션은 JWKS를 캐시된 값으로 연결하고, 이전 키가 만료되기 전에 캐시를 덮어쓰는 갱신 작업을 두며, 캐시보다 새로운 키로 서명된 토큰이 도착하는 경우를 위해 캐시 미스(cache miss) 시 폴백(fall-back) 가져오기를 추가한다.

세 번째 빈틈은 오디언스 바인딩(audience binding)이다. 레슨 16은 RFC 8707 리소스 인디케이터를 소개했다. 프로덕션에서는 그 인디케이터가 모든 요청에 대한 강력한 클레임(claim) 검사가 된다. MCP 서버는 `token.aud`를 자신의 표준(canonical) 리소스 URL과 비교하고 불일치를 HTTP 401로 거부한다. 이것은 동일한 신뢰 메시(trust mesh) 안에서 한 서버용으로 발급된 토큰을 다른 서버에 대해 재생하는 업스트림 MCP 서버(또는 한 서버용 토큰을 쥔 악성 클라이언트)에 대한 유일한 방어다.

이 레슨은 그 빈틈 하나하나를 iii 프리미티브로 다룬다. 메타데이터 문서는 어떤 함수의 출력을 반환하는 HTTP 트리거다. JWKS 회전은 `auth::rotate-jwks`를 호출하는 cron 트리거이며, 이는 `state::set("auth/jwks/<issuer>", ...)`에 기록한다. JWT 검증은 다른 곳에서 `iii.trigger("auth::validate-jwt", token)`로 호출하는 함수다. MCP 서버 자체는 디스패치(dispatch) 전에 검증을 호출하는 또 하나의 HTTP 트리거일 뿐이다. 엔진을 재시작하면 트리거 레지스트리가 재구축되고, 상태가 살아남으며, 인증 표면은 수동 조정 없이 작동한다.

## 개념 (The Concept)

### RFC 8414 — OAuth 인가 서버 메타데이터

`/.well-known/oauth-authorization-server`에 있는 문서가 클라이언트에 필요한 모든 것을 기술한다:

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "registration_endpoint": "https://auth.example.com/register",
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code", "refresh_token"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["mcp:tools.read", "mcp:tools.invoke"],
  "token_endpoint_auth_methods_supported": ["none", "private_key_jwt"]
}
```

MCP 리소스 URL을 받은 클라이언트는 디스커버리를 연쇄한다. RFC 9728의 `oauth-protected-resource`(리소스 서버의 문서)가 발급자(issuer)를 명명하고, 그다음 `oauth-authorization-server`(이 RFC)가 모든 엔드포인트를 명명한다. 클라이언트는 인가 URL을 결코 하드코딩하지 않는다.

MCP를 위해 IdP를 신뢰하기 전에 검증하는 계약:

- `code_challenge_methods_supported`가 `S256`을 포함한다(RFC 7636에 따른 PKCE).
- `grant_types_supported`가 `authorization_code`를 포함하고 `password`와 `implicit`를 거부한다.
- `registration_endpoint`가 존재한다(RFC 7591 지원).
- `response_types_supported`가 OAuth 2.1에 대해 정확히 `["code"]`이다.

이 중 하나라도 빠지면, MCP 서버는 이 IdP에 대한 배포를 거부한다. 잘못된 것은 코드가 아니라 배포 매니페스트다.

### RFC 9728 (복습) — 보호된 리소스 메타데이터

레슨 16이 RFC 9728을 다뤘다. 프로덕션에서의 차이: 이 문서는 클라이언트가 *이* MCP 서버가 신뢰하는 인가 서버를 찾기 위해 보는 유일한 곳이다. 단일 MCP 서버가 여러 IdP의 토큰을 받아들일 수 있다(직원용 하나, 파트너용 하나). RFC 9728은 그 집합을 선언하고, RFC 8414는 각 IdP가 무엇을 지원하는지 문서화한다.

```json
{
  "resource": "https://notes.example.com",
  "authorization_servers": ["https://auth.example.com", "https://partners.example.com"],
  "scopes_supported": ["mcp:tools.invoke"],
  "bearer_methods_supported": ["header"],
  "resource_documentation": "https://notes.example.com/docs"
}
```

### RFC 7591 — 동적 클라이언트 등록

DCR이 없으면, 모든 MCP 클라이언트(Cursor, Claude Desktop, 커스텀 에이전트)는 IdP 관리자와의 대역 외 교환이 필요하다. DCR이 있으면, 클라이언트는 다음을 게시한다:

```json
POST /register
Content-Type: application/json

{
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code"],
  "token_endpoint_auth_method": "none",
  "scope": "mcp:tools.invoke",
  "client_name": "Cursor",
  "software_id": "com.cursor.cursor",
  "software_version": "0.42.0"
}
```

서버는 `client_id`와 나중에 업데이트하기 위한 `registration_access_token`으로 응답한다:

```json
{
  "client_id": "c_3e7f1a",
  "client_id_issued_at": 1769472000,
  "redirect_uris": ["http://127.0.0.1:7333/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "registration_access_token": "regt_b2...",
  "registration_client_uri": "https://auth.example.com/register/c_3e7f1a"
}
```

`token_endpoint_auth_method: none`은 사용자의 기기에서 실행되는 MCP 클라이언트에 올바른 기본값이다. 이들은 `client_id`만 받으며, 유출될 `client_secret`이 없다. PKCE가 퍼블릭 클라이언트(public client)에 필요한 소유 증명(proof-of-possession)을 제공한다.

세 가지 프로덕션 함정:

- 등록 엔드포인트는 출처 IP별로 속도 제한을 해야 한다. 그렇지 않으면 적대적 행위자가 수백만 개의 가짜 등록을 스크립트로 만들어 `client_id` 네임스페이스를 고갈시킨다. iii는 이를 간단하게 만든다. 등록 HTTP 트리거가 등록기(registrar)로 디스패치하기 전에 `auth::rate-limit` 함수를 호출한다.
- `software_statement`(클라이언트를 보증하는 서명된 JWT)는 일부 엔터프라이즈 IdP에서 요구된다. 레슨의 목(mock)은 이를 건너뛰고, 프로덕션은 localhost 리다이렉트 URI가 아닌 곳에서 온 서명되지 않은 등록을 거부하는 검증 단계를 연결한다.
- `registration_access_token`은 평문이 아니라 해시로 저장해야 한다. 이 토큰을 도난당하면 공격자가 클라이언트의 리다이렉트 URI를 다시 쓸 수 있다.

### RFC 8707 (복습) — 리소스 인디케이터

레슨 16이 형태를 확립했다. 프로덕션 규칙: 모든 토큰 요청이 `resource=<canonical-mcp-url>`을 포함하고, MCP 서버는 모든 호출에서 `token.aud`가 자신의 리소스 URL과 일치하는지 검증한다. MCP 서버가 `https://notes.example.com/mcp`에서 도달 가능하다면, 표준 URL은 `https://notes.example.com`이다. 경로 컴포넌트는 제외되어 단일 서버가 하나의 오디언스 아래 여러 경로를 호스팅한다.

### RFC 7636 (복습) — PKCE

PKCE는 OAuth 2.1에서 필수다. 레슨의 인가 코드(authorization-code) 흐름은 항상 `code_challenge`와 `code_verifier`를 운반한다. 서버는 검증자(verifier)가 없거나 저장된 챌린지로 해시되지 않는 검증자를 가진 토큰 요청을 모두 거부한다.

### MCP 스펙 2025-11-25 인증 프로파일

MCP 스펙(2025-11-25)은 MCP 서버의 인가 계층이 무엇을 해야 하는지에 대해 정밀하다:

- `/.well-known/oauth-protected-resource`(RFC 9728)를 게시한다.
- 토큰을 `Authorization: Bearer ...`를 통해서만 받아들인다.
- 요청마다 `aud`, `iss`, `exp`, 그리고 필요한 스코프를 검증한다.
- 모든 401과 403에 대해 `Bearer error=...`를 운반하는 `WWW-Authenticate`로 응답하며, 해당하는 경우 `scope=`와 `resource=` 파라미터를 포함한다.
- `aud`가 표준 리소스와 일치하지 않는 토큰을 거부한다.
- `iss`가 보호된 리소스 메타데이터의 `authorization_servers` 목록에 없는 토큰을 거부한다.

OAuth 2.1 초안이 기반(substrate)이고, RFC 8414/7591/8707/9728 + RFC 7636이 표면(surface)이며, MCP 스펙이 프로파일이다.

### IdP 역량 매트릭스

모든 IdP가 전체 MCP 프로파일을 지원하지는 않는다. 아래 매트릭스는 2025-11-25 스펙 기준 사실적인 역량 진술을 문서화한다. 이는 추천이 아니라 *배포 게이트(deployment gate)*다.

| IdP 범주 | RFC 8414 메타데이터 | RFC 7591 DCR | RFC 8707 리소스 | RFC 7636 S256 PKCE | 비고 |
|---|---|---|---|---|---|
| 셀프 호스팅(Keycloak) | yes | yes | yes (24.x부터) | yes | 이 레슨에서 MCP 프로파일의 레퍼런스 IdP; 모든 RFC를 종단 간 지원한다. |
| 엔터프라이즈 SSO(Microsoft Entra ID) | yes | yes (프리미엄 티어) | yes | yes | DCR 가용성은 테넌트 티어별로 다르다; 배포 전 대상 테넌트에서 검증하라. |
| 엔터프라이즈 SSO(Okta) | yes | yes (Okta CIC / Auth0) | yes | yes | DCR은 Auth0(현재 Okta CIC)에서 가능하다; 클래식 Okta 조직은 관리자 사전 등록을 요구한다. |
| 소셜 로그인 IdP(일반) | 가변 | 드묾 | 드묾 | yes | 대부분의 소셜 IdP는 클라이언트를 정적 파트너로 취급한다; DCR에 의존하지 말라. ID 출처로만 쓰고, 그 위에 자체 MCP 인식 인가 서버를 얹어라. |
| 커스텀 / 자체 제작 | 경우에 따라 | 경우에 따라 | 경우에 따라 | 경우에 따라 | 자체적으로 출하한다면, 전체 프로파일을 출하하라. 위 네 RFC 중 하나라도 건너뛰면 MCP 인증 계약이 깨진다. |

배포 매니페스트에 대한 거부 규칙: 선택된 IdP가 `registration_endpoint`를 반환하지 않고 `code_challenge_methods_supported`에 `S256`을 나열하지 않으면, MCP 서버는 시작을 거부한다. 저하된 모드(degraded mode)는 없다.

### iii를 사용한 JWKS 회전 패턴

프로덕션 실패 모드는 오래된(stale) JWKS 캐시다. cron 트리거와 `state::*` 캐시로 이를 해결한다:

```python
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *", "name": "auth::jwks-refresh"},
    "auth::rotate-jwks",
)
```

6시간마다 cron 트리거가 `auth::rotate-jwks`를 호출하고, 이는 `<issuer>/.well-known/jwks.json`을 가져와 `state::set("auth/jwks/<issuer>", {keys, fetched_at})`에 기록한다. 검증자는 `state::get`에서 읽는다. `kid`가 캐시에서 누락된 토큰은 폴백으로 동기적 `auth::rotate-jwks` 호출을 촉발한다. 이렇게 예약된 회전(cron)과 키 중첩 윈도우(동기 폴백)라는 두 경우를 한 번에 처리한다.

상태 형태:

```json
{
  "auth/jwks/https://auth.example.com": {
    "keys": [
      {"kid": "k_2026_03", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"},
      {"kid": "k_2026_04", "kty": "RSA", "n": "...", "e": "AQAB", "alg": "RS256", "use": "sig"}
    ],
    "fetched_at": 1772668800
  }
}
```

한 번에 두 개의 키가 정상 상태(steady state)다. 인가 서버는 이전 키(`k_2026_03`)를 폐기하기 전에 다음 키(`k_2026_04`)를 도입하는 방식으로 회전하므로, 옛 키로 발급된 토큰은 만료될 때까지 유효하게 유지된다. 캐시는 합집합을 보유하고, 검증자는 `kid`로 선택한다.

### iii 프리미티브 연결 (이 레슨이 실제로 다루는 부분)

다섯 개의 프리미티브가 인증 표면을 구성한다:

```python
# 1. RFC 8414 metadata document
iii.registerTrigger(
    "http",
    {"path": "/.well-known/oauth-authorization-server", "method": "GET"},
    "auth::serve-asm",
)

# 2. RFC 7591 dynamic client registration
iii.registerTrigger(
    "http",
    {"path": "/register", "method": "POST"},
    "auth::register-client",
)

# 3. JWT validation as a callable function (the resource server triggers it)
iii.registerFunction("auth::validate-jwt", validate_jwt_handler)

# 4. Step-up issuance for incremental scope (SEP-835 from L16)
iii.registerFunction("auth::issue-step-up", issue_step_up_handler)

# 5. Cron-driven JWKS rotation
iii.registerTrigger(
    "cron",
    {"schedule": "0 */6 * * *"},
    "auth::rotate-jwks",
)
iii.registerFunction("auth::rotate-jwks", rotate_jwks_handler)
```

MCP 서버 자체는 검증을 직접 호출하지 않는다. 다음을 한다:

```python
result = iii.trigger("auth::validate-jwt", {"token": bearer_token, "resource": self.resource})
if not result["valid"]:
    return {"status": 401, "WWW-Authenticate": result["www_authenticate"]}
```

이 간접화(indirection)가 iii의 베팅이다. 내일 검증자를 두 IdP를 병렬로 참조하는 팬아웃(fanout)으로 바꾸거나, 스팬 방출기를 추가하거나, 긍정 검증을 캐시한다. MCP 서버는 바뀌지 않는다.

### 오디언스 바인딩을 사용한 혼동된 대리자 시연

서버 A(`notes.example.com`)와 서버 B(`tasks.example.com`)가 모두 동일한 인가 서버에 등록한다. 서버 A가 침해된다. 공격자가 사용자의 notes 토큰을 가져다 서버 B에 대해 재생한다.

서버 B의 검증자:

1. JWT를 디코드하고, `kid`로 JWKS를 가져와 서명을 검증한다.
2. `iss`를 자신의 보호된 리소스 메타데이터의 `authorization_servers`와 대조한다. (통과 — 동일한 IdP.)
3. `aud == "https://tasks.example.com"`을 확인한다. (실패 — 토큰의 `aud`는 `https://notes.example.com`이다.)
4. `WWW-Authenticate: Bearer error="invalid_token", error_description="audience mismatch"`와 함께 401을 반환한다.

오디언스 클레임은 프로토콜 계층에서 이 공격에 대한 유일한 방어다. 성능을 위해 이를 건너뛰는 것이 가장 흔한 프로덕션 실수다. 검증자는 세션 시작 시점뿐 아니라 모든 요청에서 실행되어야 한다.

### 실패 모드

- **오래된 JWKS.** 검증자가 키 회전 후 유효한 토큰을 거부한다. 해결책은 위의 cron+폴백 패턴이다. 갱신 작업 없이 JWKS를 절대 캐시하지 말라.
- **누락된 `aud` 클레임.** 일부 IdP는 토큰 요청에 `resource`가 없으면 기본적으로 `aud`를 생략한다. 검증자는 `aud`가 누락된 토큰을 거부해야 하며, 부재를 와일드카드로 취급해서는 안 된다.
- **스코프 업그레이드 레이스.** 동일 사용자에 대한 두 개의 동시 스텝업(step-up) 흐름이 둘 다 성공해 서로 다른 스코프를 가진 두 개의 액세스 토큰을 만들 수 있다. 검증자는 "사용자의 현재 스코프"를 조회하지 말고 요청에 제시된 토큰을 사용해야 한다 — 전자는 TOCTOU 윈도우를 만든다.
- **등록 토큰 도난.** 유출된 `registration_access_token`은 공격자가 리다이렉트 URI를 다시 쓰게 한다. 저장 시 해시하고, 모든 업데이트에서 클라이언트가 평문을 제시하도록 요구하고, 의심 시 회전하라.
- **`iss` 미고정.** 임의의 `iss`를 받아들이는 검증자는 공격자가 자신의 인가 서버를 세우고, 대상 오디언스용 클라이언트를 등록하고, 토큰을 발급하게 한다. 보호된 리소스 메타데이터의 `authorization_servers` 목록이 허용 목록(allow-list)이다; 이를 강제하라.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 stdlib Python과 `iii.registerFunction`, `iii.registerTrigger`, `iii.trigger`, `state::set/get`을 모방하는 작은 `iii_mock` 레지스트리로 전체 프로덕션 흐름을 따라간다. 흐름:

1. 인가 서버가 `/.well-known/oauth-authorization-server`에 RFC 8414 메타데이터를 게시한다.
2. MCP 클라이언트가 메타데이터 엔드포인트를 호출해 등록 엔드포인트를 디스커버리한다.
3. MCP 클라이언트가 `/register`(RFC 7591)에 게시하고 `client_id`를 받는다.
4. MCP 클라이언트가 `resource` 인디케이터(RFC 8707)와 함께 PKCE 보호 인가 코드 흐름(RFC 7636)을 실행한다.
5. MCP 클라이언트가 `Authorization: Bearer ...`로 MCP 서버의 툴을 호출한다.
6. MCP 서버가 `auth::validate-jwt`를 트리거하고, 이는 `state::get`에서 JWKS를 읽는다.
7. cron 트리거가 `auth::rotate-jwks`를 발사해 상태의 JWKS를 교체한다.
8. 다음 호출이 재시작 없이 새 키로 검증한다.
9. 다른 MCP 리소스에 대한 혼동된 대리자 시도가 오디언스 불일치로 401을 받는다.

여기 목 JWT는 공유 비밀(shared secret)과 함께 HS256을 사용한다(그래서 레슨이 stdlib만으로 실행된다). 프로덕션은 위의 JWKS 패턴과 함께 RS256 또는 EdDSA를 사용하며, 그 외 검증 로직은 동일하다.

## 산출물 (Ship It)

이 레슨은 `outputs/skill-mcp-auth-iii.md`를 만든다. MCP 서버 구성과 IdP 역량 집합이 주어지면, 이 스킬은 등록할 iii 프리미티브, JWKS 회전 일정, 스코프 매핑, 그리고 IdP가 전체 RFC 프로파일을 지원하지 않을 때 적용할 거부 규칙을 방출한다.

## 연습 문제 (Exercises)

1. `code/main.py`를 실행하라. 9단계 흐름을 추적하라. `auth::rotate-jwks`가 덮어쓰기 직전에 `state::get`이 오래된 데이터를 반환하는 지점과, 다음 요청이 이제 새 키로 검증하는 방식을 기록하라.

2. 보호된 리소스 메타데이터의 `authorization_servers` 목록에 새 IdP를 추가하라. 새 IdP로 서명된 토큰을 발급하고 검증자가 그것을 받아들이는지 확인하라. 목록에 없는 IdP로 서명된 토큰을 발급하고 검증자가 `WWW-Authenticate: Bearer error="invalid_token", error_description="iss not allowed"`로 거부하는지 확인하라.

3. `auth::rate-limit`을 iii 함수로 구현하고 등록기가 실행되기 전에 등록 HTTP 트리거 안에서 호출하라. `state::set("auth/ratelimit/<ip>", ...)`에 보유된 출처 IP별 토큰 버킷을 사용하라.

4. RFC 7591을 읽고 레슨의 `/register` 핸들러가 검증하지 않는 두 필드를 식별하라. 검증을 추가하라. (힌트: `software_statement`와 `redirect_uris` URI 스킴.)

5. MCP 스펙 2025-11-25 인가 섹션을 읽어라. 레슨의 검증자가 현재 방출하지 않는, `WWW-Authenticate` 헤더에 대한 규범적(normative) 요구사항 하나를 찾아라. 추가하라.

## 핵심 용어 (Key Terms)

| 용어 | 사람들이 말하는 것 | 실제 의미 |
|------|----------------|------------------------|
| ASM | "OAuth 메타데이터 문서" | RFC 8414 `/.well-known/oauth-authorization-server` JSON |
| DCR | "셀프 서비스 클라이언트 등록" | RFC 7591 `POST /register` 흐름 |
| JWKS | "JWT 검증용 공개 키" | `jwks_uri`에서 가져와 `kid`로 인덱싱되는 JSON Web Key Set |
| 리소스 인디케이터(Resource indicator) | "오디언스 파라미터" | 토큰을 한 서버에 고정하는 RFC 8707 `resource` 파라미터 |
| `aud` 클레임 | "오디언스" | 검증자가 표준 리소스 URL과 비교하는 JWT 클레임 |
| 혼동된 대리자(Confused deputy) | "토큰 재생" | 서버 A용으로 발급된 토큰을 서버 B에 제시하는 공격 |
| `iss` 허용 목록 | "신뢰하는 인가 서버" | 보호된 리소스 메타데이터의 `authorization_servers`에 명명된 집합 |
| 키 회전(Key rotation) | "롤링 JWKS" | 중첩 윈도우를 둔 서명 키의 주기적 교체 |
| 퍼블릭 클라이언트(Public client) | "네이티브 또는 브라우저 클라이언트" | `client_secret`이 없는 OAuth 클라이언트; PKCE가 보완한다 |
| `WWW-Authenticate` | "401/403 응답 헤더" | 클라이언트 복구를 이끄는 `Bearer error=...` 지시문을 운반한다 |

## 더 읽을거리 (Further Reading)

- [MCP — Authorization spec (2025-11-25)](https://modelcontextprotocol.io/specification/draft/basic/authorization) — 이 레슨이 구현하는 MCP 인증 프로파일
- [RFC 8414 — OAuth 2.0 Authorization Server Metadata](https://datatracker.ietf.org/doc/html/rfc8414) — 디스커버리 계약
- [RFC 7591 — OAuth 2.0 Dynamic Client Registration Protocol](https://datatracker.ietf.org/doc/html/rfc7591) — DCR
- [RFC 7636 — Proof Key for Code Exchange (PKCE)](https://datatracker.ietf.org/doc/html/rfc7636) — 퍼블릭 클라이언트 소유 증명
- [RFC 8707 — Resource Indicators for OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc8707) — 오디언스 고정
- [RFC 9728 — OAuth 2.0 Protected Resource Metadata](https://datatracker.ietf.org/doc/html/rfc9728) — 리소스 서버 디스커버리
- [OAuth 2.1 draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1) — 통합된 OAuth 기반
