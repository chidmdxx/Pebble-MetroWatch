# Contributing

Propose changes through a pull request to `main`. Check the calendar tests and
build both supported targets as described in the README. For layout changes,
include emulator screenshots for both supported watches.

The intended repository safeguards mirror the companion watchface project:
pull requests are required for `main`, bypass is disabled, review conversations
must be resolved, only squash merges are allowed, and `secrets`, `tests`, and
`build` checks must pass. The owner alone may update `main` through pull
requests and create tags; existing tags must not be changed or deleted.

These are intended rules, not currently enforced: the private repository's
account plan does not support private-repository rulesets. Enable and verify
them when the plan supports them; never represent them as active before then.
The checks are defined in `.github/workflows/checks.yml`.

Do not commit credentials, private calendar data, or personal contact details.
Use a neutral no-reply commit identity and review the commit metadata before
pushing. An emulator does not establish physical-watch or live-provider behavior.
