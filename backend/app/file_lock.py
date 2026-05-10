from pathlib import Path
import os
import socket
import time


class VaultLock:
    def __init__(self, data_root: Path):
        self.path = data_root / "run.lock"
        self.acquired = False

    def acquire(self) -> None:
        payload = f"pid={os.getpid()}\nhost={socket.gethostname()}\ntime={int(time.time())}\n"
        try:
            fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            # Lock file exists but process may have crashed - clean it up
            self.path.unlink(missing_ok=True)
            fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(payload)
        self.acquired = True

    def release(self) -> None:
        if self.acquired:
            self.path.unlink(missing_ok=True)
            self.acquired = False

