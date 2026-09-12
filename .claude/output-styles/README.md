# Korean output style

This directory holds the [fluent-korean](https://github.com/snflkd/fluent-korean)
output style (MIT), vendored rather than installed as a plugin.

Turn it on with `/output-style fluent-korean` when you are working on the
Korean translation, and the session writes Korean that keeps its particles,
endings, and sentence structure intact. That matters here because the Korean
lesson translations under `phases/*/*/docs/ko.md`, `glossary/terms.ko.md`, and
the Korean UI strings in `site/i18n.js` are themselves the deliverable: a model
writing telegraphic Korean in a session produces telegraphic Korean in the files.

To make it the default for your own sessions, put it in
`.claude/settings.local.json`, which is gitignored:

```json
{ "outputStyle": "fluent-korean" }
```

It deliberately does not live in a committed `settings.json`, because that would
switch the output style for everyone who clones the repository, including people
who never touch the translation.

## Why vendored instead of `/plugin install`

The upstream README documents both routes. The plugin route (`/plugin marketplace
add snflkd/fluent-korean`) installs per user, so it would not follow a clone of
this repository, and a plugin update overwrites the file. Files placed in
`.claude/output-styles/` are committed with the repository, are offered to
everyone who clones it, and can carry local additions. Two such additions are
appended to both styles here, taken verbatim from the upstream README's optional
blocks:

- apply the guidelines to every Korean output, not only to chat replies, so they
  reach the translated lesson files;
- re-check the reply against the guidelines before sending it.

## The two variants

- `fluent-korean.md` keeps Claude Code's coding instructions. This is the default.
- `fluent-korean-not-coding.md` drops them, for sessions that only write prose.

Switch with `/output-style`, or by editing `.claude/settings.local.json`. An
output style is read when a session starts, so run `/clear` or open a new session
after changing it.

## Updating

Copy the files from `plugins/fluent-korean/output-styles/` in the upstream
repository and re-append the "이 저장소에서 추가로 적용하는 사항" section.
