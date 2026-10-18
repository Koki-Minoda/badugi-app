import hashlib
import importlib.util
from pathlib import Path
import stat
import re
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("mgx_prod_admin", ROOT / "scripts/deploy/mgx-prod-admin.py")
admin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(admin)


class DeployAdminTests(unittest.TestCase):
    def test_unknown_action_and_extra_arguments_never_execute_commands(self):
        for arguments in ([], ["shell"], ["workers", "/tmp/override"], ["nginx-ws", "--help"]):
            with self.subTest(arguments=arguments), patch.object(admin.subprocess, "run") as run:
                with self.assertRaises(RuntimeError):
                    admin.main(arguments)
                run.assert_not_called()

    def test_non_root_execution_is_rejected(self):
        with patch.object(admin.os, "geteuid", return_value=1000), patch.object(admin.subprocess, "run") as run:
            with self.assertRaisesRegex(RuntimeError, "sudo"):
                admin.main(["workers"])
            run.assert_not_called()

    def test_fixed_operations_clear_untrusted_environment(self):
        for action, filename in admin.ACTIONS.items():
            with self.subTest(action=action), patch.object(admin.os, "geteuid", return_value=0), \
                patch.object(admin, "verify_sources"), patch.object(admin.subprocess, "run") as run, \
                patch.dict(admin.os.environ, {"APP_DIR": "/tmp/attacker", "BASH_ENV": "/tmp/attacker.sh", "MGX_NGINX_TEST_MODE": "1"}):
                run.return_value.stdout = "mgx\n"
                admin.main([action])
                self.assertEqual(run.call_count, 2)
                args, kwargs = run.call_args
                self.assertEqual(args[0], ["/bin/bash", str(admin.ROOT / filename)])
                self.assertEqual(kwargs["env"]["APP_DIR"], "/home/mgx/badugi-app")
                self.assertNotIn("BASH_ENV", kwargs["env"])
                self.assertNotIn("MGX_NGINX_TEST_MODE", kwargs["env"])
                self.assertEqual(kwargs["cwd"], "/")

    def test_backend_must_not_run_repository_code_as_root(self):
        with patch.object(admin.os, "geteuid", return_value=0), patch.object(admin, "verify_sources"), \
            patch.object(admin.subprocess, "run") as run:
            run.return_value.stdout = "root\n"
            with self.assertRaisesRegex(RuntimeError, "does not run as mgx"):
                admin.main(["workers"])
            self.assertEqual(run.call_count, 1)

    def test_readiness_check_does_not_run_a_mutation(self):
        with patch.object(admin.os, "geteuid", return_value=0), patch.object(admin, "verify_sources"), \
            patch.object(admin.subprocess, "run") as run:
            run.return_value.stdout = "mgx\n"
            admin.main(["check"])
            self.assertEqual(run.call_count, 1)

    def test_pinned_sources_match_reviewed_repository_scripts(self):
        for name, digest in admin.SOURCES.items():
            self.assertEqual(hashlib.sha256((ROOT / "scripts/deploy" / name).read_bytes()).hexdigest(), digest)

    def test_installer_pins_every_privileged_file(self):
        installer = (ROOT / "scripts/deploy/install-mgx-prod-admin.sh").read_text()
        hashes = dict((name, digest) for digest, name in re.findall(r"^([a-f0-9]{64})  (\S+)$", installer, re.MULTILINE))
        self.assertEqual(set(hashes), {*admin.SOURCES, "mgx-prod-admin.py"})
        for name, digest in hashes.items():
            self.assertEqual(hashlib.sha256((ROOT / "scripts/deploy" / name).read_bytes()).hexdigest(), digest)

    def test_untrusted_ownership_writable_files_and_symlinks_are_rejected(self):
        for info in (SimpleNamespace(st_uid=1000, st_mode=stat.S_IFREG | 0o644),
                     SimpleNamespace(st_uid=0, st_mode=stat.S_IFREG | 0o666),
                     SimpleNamespace(st_uid=0, st_mode=stat.S_IFLNK | 0o777)):
            with patch.object(Path, "lstat", return_value=info):
                with self.assertRaisesRegex(RuntimeError, "ownership or permissions"):
                    admin.verify_sources()

    def test_modified_privileged_script_is_rejected_before_execution(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            for name in admin.SOURCES:
                (folder / name).write_bytes((ROOT / "scripts/deploy" / name).read_bytes())
            # Simulate the root-owned installation without requiring root in CI.
            root_owned = SimpleNamespace(st_uid=0, st_mode=stat.S_IFREG | 0o644)
            with patch.object(Path, "lstat", return_value=root_owned):
                admin.verify_sources(folder)
                (folder / next(iter(admin.SOURCES))).write_text("echo tampered\n")
                with self.assertRaisesRegex(RuntimeError, "source changed"):
                    admin.verify_sources(folder)


if __name__ == "__main__":
    unittest.main()
