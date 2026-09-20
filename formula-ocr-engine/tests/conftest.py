from __future__ import annotations

from collections.abc import Mapping


class FakeModelManager:
    def __init__(self) -> None:
        self.load_calls = 0

    def statuses(self) -> Mapping[str, str]:
        return {
            "formula": "not_loaded",
            "detection": "not_loaded",
            "document": "not_loaded",
        }

    def assert_not_loaded(self) -> None:
        assert self.load_calls == 0
