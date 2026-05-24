# Contributing to Limner

Thanks for your interest. Limner is in pre-v1 active development; the contribution flow will tighten as the codebase matures.

## Developer Certificate of Origin (DCO)

This project requires all commits to be signed off under the Developer Certificate of Origin, version 1.1. The DCO is a lightweight way to certify that you wrote (or have the right to submit) the code you're contributing.

The full DCO text lives at https://developercertificate.org.

To sign off a commit, add the `-s` flag:

```bash
git commit -s -m "fix: handle null project context"
```

This appends a `Signed-off-by: Your Name <email>` line to the commit message. The DCO GitHub App enforces this on every PR.

If you have a commit history without sign-offs, re-sign with:

```bash
git rebase --signoff HEAD~N  # N = number of commits to amend
```

## Submitting changes

1. Fork the repo
2. Create a feature branch from `main`
3. Make focused, incremental commits
4. Sign off every commit (`-s`)
5. Open a PR with a clear description

## Code style

TBD. Coming when the codebase has lint and format tooling in place.

## Issues

Bug reports and feature requests welcome. For significant changes, open an issue before sending a PR so scope can be discussed.

## Code of conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). Be civil.

## License

By contributing, you agree your contributions are licensed under Apache 2.0, the project's license.
