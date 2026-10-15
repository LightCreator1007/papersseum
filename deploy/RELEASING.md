# Releasing the library to PyPI

Releases are published by GitHub Actions (`.github/workflows/release.yml`) using
PyPI Trusted Publishing, so no API token is stored anywhere. A published version
can never be changed or re-uploaded (you can only yank it and release a new one),
so rehearse on TestPyPI first.

## One-time setup

1. Create accounts on <https://pypi.org> and <https://test.pypi.org> (turn on 2FA).
2. On each site: *Your account > Publishing > Add a new pending publisher*, with
   - PyPI project name: `papersseum`
   - Owner: `dhairya-pandya`
   - Repository name: `papersseum`
   - Workflow name: `release.yml`
   - Environment name: `pypi` on pypi.org, `testpypi` on test.pypi.org
3. On GitHub: *Settings > Environments*, create `pypi` and `testpypi`. On `pypi`,
   add yourself under *Required reviewers*, so every real release waits for a
   manual approval click.

## Rehearsal (TestPyPI)

*Actions > release > Run workflow* on `main`. Then check:

```bash
pip install -i https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple papersseum
papersseum version
```

## Release

1. Bump `version` in `pyproject.toml` and `papersseum/__init__.py`, run `uv lock`, merge to `main`.
2. Tag and push (the tag must equal the version, with a leading `v`):

   ```bash
   git tag v0.5.0 && git push origin v0.5.0
   ```
3. The workflow runs the tests, builds, waits for your approval on the `pypi`
   environment, publishes, then creates a GitHub release with the files attached.

If the engine changed in the release, also set `season.engine_hash` in Supabase
(`papersseum version` prints it) and run `deploy/vm/update.sh` on every worker.
