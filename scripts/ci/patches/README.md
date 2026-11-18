# Temporary picomatch security patches

The locked picomatch 2.3.2 and 4.0.7 copies are build and test dependencies.
[GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) affects
both versions. Until fixed releases are available, the patches reject the two
repeating extglob operators before the parser emits a regular expression.
Filename globs used by the build and the other extglob operators remain supported.

`npm ci` patches every installed copy after checking the original hashes. The
dependency audit verifies the patched hashes and runs the parser policy tests
before accepting the remediation for this advisory. Remove the corresponding
patch when upgrading each dependency line to an upstream fixed release.
