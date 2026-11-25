"""Run the commands a colleague receives in the checked-in River Kiln download."""

from hashlib import sha256
from io import BytesIO
from os import environ
from pathlib import Path, PurePosixPath
import re
import subprocess
from tempfile import TemporaryDirectory
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
KIT = ROOT / "docs/examples/river-kiln-colleague-kit.zip"


def extract(kit, name, root, prefix):
    with ZipFile(BytesIO(kit.read(name))) as archive:
        for entry in archive.infolist():
            path = PurePosixPath(entry.filename)
            assert path.parts[0] == prefix and ".." not in path.parts, entry.filename
            if not entry.is_dir():
                dest = root / path
                dest.parent.mkdir(exist_ok=True, parents=True)
                with dest.open("xb") as file:
                    file.write(archive.read(entry))


def files(project):
    return {p.relative_to(project): p.read_bytes() for p in project.rglob("*") if p.is_file()}


def rehearse(project, proposal, guide):
    blocks = re.findall(r"```sh\n(.+?)\n```", (proposal / guide).read_text(), re.S)
    commands = {}
    for direction in ("forward", "rollback"):
        matches = [block for block in blocks if f'/{direction}.patch"' in block]
        assert len(matches) == 1, (guide, direction)
        commands[direction] = matches[0].replace(
            "/absolute/path/to/isolated-project", "$KIT_PROJECT"
        ).replace("/absolute/path/to/focus-source-trial", "$KIT_PROPOSAL")

    def paste(direction, *, success):
        result = subprocess.run(
            ["sh", "-c", commands[direction]],
            cwd=proposal,
            env={
                "PATH": environ["PATH"],
                "KIT_PROJECT": str(project),
                "KIT_PROPOSAL": str(proposal),
                "GIT_CONFIG_NOSYSTEM": "1",
                "GIT_CONFIG_GLOBAL": "/dev/null",
            },
            capture_output=True,
            text=True,
            timeout=15,
        )
        assert (result.returncode == 0) == success, (guide, direction, result.stderr)

    def refuse_drift(direction):
        for name in ("src/Booking.tsx", "src/Booking.module.css"):
            target = project / name
            clean = target.read_bytes()
            # A later edit outside the patch's context can still pass git apply --check.
            target.write_bytes(clean + b"\n/* Local work after the rehearsal. */\n")
            pending = files(project)
            paste(direction, success=False)
            assert files(project) == pending, f"{guide} changed files on refused {direction}"
            target.write_bytes(clean)

    original = files(project)
    refuse_drift("forward")
    paste("forward", success=True)
    assert (project / "src/Booking.tsx").read_bytes() != original[Path("src/Booking.tsx")]
    note = Path("studio-notes.txt")
    original[note] = b"Keep the colleague's later booking notes.\n"
    (project / note).write_bytes(original[note])
    refuse_drift("rollback")
    paste("rollback", success=True)
    assert files(project) == original, f"{guide} failed selective undo"
    print(f"{guide} passed exact apply, selective undo and four refused writes.")


with ZipFile(KIT) as kit:
    manifest = {}
    for line in kit.read("SHA256SUMS").decode().splitlines():
        digest, name = line.split("  ", 1)
        assert name not in manifest, name
        manifest[name] = digest
    assert set(manifest) == {n for n in kit.namelist() if n != "SHA256SUMS" and not n.endswith("/")}
    for name, digest in manifest.items():
        assert sha256(kit.read(name)).hexdigest() == digest, name
    for guide in ("START-HERE.md", "AGENT-HANDOFF.md"):
        with TemporaryDirectory(prefix="river kiln release ") as temp:
            root = Path(temp)
            extract(kit, "01-original.zip", root, "river-kiln")
            extract(kit, "02-focus-proposal.zip", root, "focus-source-trial")
            rehearse(root / "river-kiln", root / "focus-source-trial", guide)
