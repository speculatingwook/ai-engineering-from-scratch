# 스킬과 에이전트 SDK — Anthropic Skills, AGENTS.md, OpenAI Apps SDK

> MCP는 "어떤 툴이 존재하는가"를 말한다. 스킬(skill)은 "태스크를 어떻게 하는가"를 말한다. 2026년 스택은 둘 다 계층화한다. Anthropic의 Agent Skills(오픈 표준, 2025년 12월)는 점진적 공개(progressive disclosure)를 갖춘 SKILL.md로 배포된다. OpenAI의 Apps SDK는 MCP에 위젯 메타데이터를 더한 것이다. AGENTS.md(현재 60,000개 이상의 레포에 있음)는 프로젝트 수준 에이전트 컨텍스트로 레포 루트에 자리한다. 이 레슨은 각각이 무엇을 다루는지 짚고, 여러 에이전트를 가로질러 이동하는 최소 SKILL.md + AGENTS.md 번들을 구축한다.

**Type:** Learn
**Languages:** Python (stdlib, SKILL.md parser and loader)
**Prerequisites:** Phase 13 · 07 (MCP server)
**Time:** ~45분

## 학습 목표 (Learning Objectives)

- 세 계층을 구별하기: AGENTS.md(프로젝트 컨텍스트), SKILL.md(재사용 가능한 노하우), MCP(툴).
- YAML 프론트매터(frontmatter)와 점진적 공개를 갖춘 SKILL.md 작성하기.
- 스킬을 파일시스템 방식으로 에이전트 런타임에 로드하기.
- 하나의 패키지가 Claude Code, Cursor, Codex에서 작동하도록 스킬을 MCP 서버 및 AGENTS.md와 결합하기.

## 문제 (The Problem)

어느 엔지니어가 릴리스 노트 작성 워크플로를 다단계 프롬프트로 압축한다: "최근 머지된 PR을 읽어라. 영역별로 그룹화하라. 각각을 요약하라. 팀의 스타일을 따르는 체인지로그 항목을 작성하라. Slack 초안에 게시하라." 그는 이것을 팀을 위해 Notion 문서에 넣는다.

이제 그는 이 워크플로를 Claude Code, Cursor, Codex CLI에서 쓰고 싶다. 에이전트마다 명령을 로드하는 방식이 다르다: Claude Code 슬래시 명령, Cursor 규칙, Codex `.codex.md`. 엔지니어는 워크플로를 세 번 복사하고 세 사본을 유지한다.

AGENTS.md와 SKILL.md가 함께 이를 해결한다:

- **AGENTS.md**는 레포 루트에 자리한다. 모든 호환 에이전트가 세션 시작 시 이를 읽는다. "이 프로젝트는 어떻게 작동하는가? 컨벤션은 무엇인가? 어떤 명령이 테스트를 실행하는가?"
- **SKILL.md**는 이식 가능한 번들이다: YAML 프론트매터(name, description) + 마크다운 본문 + 선택적 리소스. 스킬을 지원하는 에이전트가 필요할 때 이름으로 로드한다.
- **MCP**(Phase 13 · 06-14)는 스킬이 호출해야 하는 툴을 처리한다.

세 계층, 하나의 이식 가능한 아티팩트.

## 개념 (The Concept)

### AGENTS.md (agents.md)

2025년 말 출범했고, 2026년 4월까지 60,000개 이상의 레포가 채택했다. 레포 루트의 파일 하나다. 형식:

```markdown
# Project: my-service

## Conventions
- TypeScript with strict mode.
- Use Pydantic for models on the Python side.
- Tests run with `pnpm test`.

## Build and run
- `pnpm dev` for local dev server.
- `pnpm build` for production bundle.
```

에이전트는 세션 시작 시 이를 읽고 그 프로젝트에 맞게 자기 행동을 보정한다. 2026년의 코딩 에이전트는 모두 AGENTS.md를 지원한다: Claude Code, Cursor, Codex, Copilot Workspace, opencode, Windsurf, Zed.

### SKILL.md 형식

Anthropic의 Agent Skills(2025년 12월 오픈 표준으로 공개):

```markdown
---
name: release-notes-writer
description: Write a changelog entry for the latest merged PRs following this project's style.
---

# Release notes writer

When invoked, run these steps:

1. List PRs merged since the last tag. Use `gh pr list --base main --state merged`.
2. Group by label: feature, fix, chore, docs.
3. For each PR in each group, write one line: `- <title> (#<num>)`.
4. Draft the release notes and stage them in CHANGELOG.md.

If the user says "ship", run `git tag vX.Y.Z` and `gh release create`.

## Notes

- Never include commits without a PR.
- Skip "chore" entries from the public changelog.
```

프론트매터는 스킬의 정체성을 선언한다. 본문은 스킬이 로드될 때 모델에 보이는 프롬프트다.

### 점진적 공개 (Progressive disclosure)

스킬은 에이전트가 필요할 때만 가져오는 하위 리소스를 참조할 수 있다. 예시:

```
skills/
  release-notes-writer/
    SKILL.md
    style-guide.md
    template.md
    scripts/
      generate.sh
```

SKILL.md는 "스타일 규칙은 style-guide.md를 보라"고 말한다. 에이전트는 스킬이 활발히 실행될 때만 style-guide.md를 가져온다. 이렇게 하면 모델이 필요로 하지 않을 수도 있는 세부 사항으로 프롬프트를 부풀리지 않는다.

### 파일시스템 디스커버리

에이전트 런타임은 알려진 디렉터리에서 SKILL.md 파일을 스캔한다:

- `~/.anthropic/skills/*/SKILL.md`
- 프로젝트 `./skills/*/SKILL.md`
- `~/.claude/skills/*/SKILL.md`

로딩은 폴더 이름과 프론트매터 `name`으로 한다. Claude Code, Anthropic Claude Agent SDK, SkillKit(크로스 에이전트)이 모두 이 패턴을 따른다.

### Anthropic Claude Agent SDK

`@anthropic-ai/claude-agent-sdk`(TypeScript)와 `claude-agent-sdk`(Python)는 세션 시작 시 스킬을 로드하고, 런타임 안에서 호출 가능한 "에이전트"로 노출한다. 사용자가 스킬을 호출하면 에이전트 루프가 그것으로 디스패치한다.

### OpenAI Apps SDK

2025년 10월 출범했고, MCP 위에 직접 구축되었다. OpenAI의 이전 Connectors와 Custom GPT Actions를 단일 개발자 표면 아래로 통합한다. Apps SDK 앱은 다음으로 이뤄진다:

- MCP 서버(툴, 리소스, 프롬프트).
- 여기에 ChatGPT UI를 위한 위젯 메타데이터.
- 여기에 인터랙티브 표면을 위한 선택적 MCP Apps `ui://` 리소스.

같은 프로토콜, 더 풍부한 UX.

### SkillKit을 통한 크로스 에이전트 이식성

SkillKit 같은 도구와 유사한 크로스 에이전트 배포 계층은 단일 SKILL.md를 32개 이상의 AI 에이전트(Claude Code, Cursor, Codex, Gemini CLI, OpenCode 등) 각각의 네이티브 형식으로 변환한다. 하나의 진실 소스, 다수의 소비자.

### 3계층 스택

| 계층 | 파일 | 로드되는 시점 | 목적 |
|-------|------|-------------|---------|
| AGENTS.md | 레포 루트 | 세션 시작 | 프로젝트 수준 컨벤션 |
| SKILL.md | 스킬 디렉터리 | 스킬 호출 시 | 재사용 가능한 워크플로 |
| MCP 서버 | 외부 프로세스 | 툴 필요 시 | 호출 가능한 액션 |

셋은 모두 결합한다: 에이전트가 세션 시작 시 AGENTS.md를 읽고, 사용자가 스킬을 호출하고, 스킬의 명령이 MCP 툴 호출을 포함하고, 에이전트가 MCP 클라이언트로 디스패치한다.

## 라이브러리로 써보기 (Use It)

`code/main.py`는 stdlib SKILL.md 파서와 로더를 담고 있다. `./skills/` 아래에서 스킬을 디스커버리하고, YAML 프론트매터와 마크다운 본문을 파싱하고, 스킬 이름을 키로 하는 딕셔너리를 만든다. 그런 다음 `release-notes-writer`를 이름으로 호출하는 에이전트 루프를 시뮬레이션한다.

볼 것:

- 최소 stdlib 파서로 파싱된 YAML 프론트매터(`pyyaml` 의존성 없음).
- 스킬 본문은 그대로 저장된다. 에이전트가 호출할 때 그것을 시스템 프롬프트 앞에 붙인다.
- 참조된 파일을 필요할 때 가져오는 `read_subresource` 함수로 시연하는 점진적 공개.

## 산출물 (Ship It)

이 레슨은 `outputs/skill-agent-bundle.md`를 만든다. 워크플로가 주어지면, 이 스킬은 여러 에이전트를 가로질러 이식 가능한, 결합된 SKILL.md + AGENTS.md + MCP 서버 청사진 번들을 만들어낸다.

## 연습 문제 (Exercises)

1. `code/main.py`를 실행하라. `skills/` 아래에 두 번째 스킬을 추가하고 로더가 그것을 집어내는지 확인하라.

2. 이 코스 레포를 위한 AGENTS.md를 작성하라. 테스트 명령, 스타일 컨벤션, Phase 13 멘탈 모델을 포함하라.

3. 팀의 내부 문서에서 다단계 워크플로를 SKILL.md로 이식하라. Claude Code에서 로드되는지 검증하라.

4. 스킬을 Cursor와 Codex의 네이티브 규칙 형식으로 손으로 번역하라. 형식 간 차이를 세어라 — 이것이 SkillKit이 자동화하는 번역 표면이다.

5. Anthropic Agent Skills 블로그 글을 읽어라. 이 레슨의 로더가 다루지 않는 Claude Agent SDK 기능 하나를 식별하라. (힌트: 에이전트 하위 호출.)

## 핵심 용어 (Key Terms)

| 용어 | 사람들이 말하는 것 | 실제 의미 |
|------|----------------|------------------------|
| SKILL.md | "스킬 파일" | 에이전트 런타임이 로드하는 YAML 프론트매터와 마크다운 본문 |
| AGENTS.md | "레포 루트 에이전트 컨텍스트" | 세션 시작 시 읽는 프로젝트 수준 컨벤션 파일 |
| 점진적 공개(Progressive disclosure) | "하위 리소스 지연 로드" | 스킬 본문이 필요할 때만 가져오는 파일을 참조한다 |
| 프론트매터(Frontmatter) | "상단의 YAML 블록" | `---` 구분자 안의 메타데이터(name, description) |
| Claude Agent SDK | "Anthropic의 스킬 런타임" | `@anthropic-ai/claude-agent-sdk`, 스킬을 로드하고 라우팅한다 |
| OpenAI Apps SDK | "MCP + 위젯 메타" | MCP에 ChatGPT UI 훅을 더한 OpenAI 개발 표면 |
| 스킬 디스커버리(Skill discovery) | "파일시스템 스캔" | 알려진 디렉터리를 돌며 SKILL.md를 찾아 이름으로 키 지정 |
| 크로스 에이전트 이식성(Cross-agent portability) | "하나의 스킬 다수의 에이전트" | SkillKit 스타일 도구로 하나의 SKILL.md를 32개 이상 에이전트로 변환 |
| 에이전트 스킬(Agent Skill) | "이식 가능한 노하우" | MCP의 툴 개념 밖에 있는 재사용 가능한 태스크 템플릿 |
| Apps SDK | "MCP 더하기 ChatGPT UI" | MCP 위에 통합된 Connectors와 Custom GPTs |

## 더 읽을거리 (Further Reading)

- [Anthropic — Agent Skills announcement](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills) — 2025년 12월 출범
- [Anthropic — Agent Skills docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) — SKILL.md 형식 레퍼런스
- [OpenAI — Apps SDK](https://developers.openai.com/apps-sdk) — ChatGPT를 위한 MCP 기반 개발자 플랫폼
- [agents.md](https://agents.md/) — AGENTS.md 형식과 채택 목록
- [Anthropic — anthropics/skills GitHub](https://github.com/anthropics/skills) — 공식 스킬 예제
