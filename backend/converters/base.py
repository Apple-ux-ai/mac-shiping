from abc import ABC, abstractmethod
from typing import Dict, Any
import os
import json
import hashlib


class BaseConverter(ABC):
    """Base Converter Abstract Class"""

    def __init__(self):
        self.supported_formats = []
        if not hasattr(self.__class__, "_version_cache"):
            self.__class__._version_cache = {}

    @abstractmethod
    def convert(self, input_path: str, output_dir: str, **options) -> Dict[str, Any]:
        """
        Execute conversion (Subclasses must implement)

        Args:
            input_path: Input file path
            output_dir: Output directory path
            **options: Conversion options

        Returns:
            Conversion result dictionary
        """
        pass

    def validate_input(self, input_path: str) -> bool:
        """Validate input file (Common method)"""
        # Common validation logic could go here
        return True

    def cleanup_on_error(self, output_path: str):
        """Cleanup on error (Common method)"""
        # Common cleanup logic could go here
        pass

    def resolve_output_path(
        self,
        output_dir: str,
        filename: str,
        extension: str,
        options: Dict[str, Any],
    ) -> str:
        options = options or {}
        serialized = json.dumps(
            options,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            default=str,
        )
        signature = hashlib.md5(serialized.encode("utf-8")).hexdigest()

        try:
            os.makedirs(output_dir, exist_ok=True)
        except Exception:
            pass

        key = os.path.join(output_dir, f"{filename}{extension}")
        versions: Dict[str, str] = getattr(self.__class__, "_version_cache", {}).get(
            key, {}
        )

        for index_str, sig in versions.items():
            if not sig or sig != signature:
                continue
            try:
                index = int(index_str)
            except ValueError:
                continue
            if index <= 1:
                name = f"{filename}{extension}"
            else:
                name = f"{filename}_{index}{extension}"
            return os.path.join(output_dir, name)

        existing_indices = set()
        base_name = f"{filename}{extension}"
        base_path = os.path.join(output_dir, base_name)
        if os.path.exists(base_path):
            existing_indices.add(1)
        try:
            for entry in os.listdir(output_dir):
                if not entry.lower().endswith(extension.lower()):
                    continue
                name_without_ext = entry[: -len(extension)]
                if name_without_ext == filename:
                    existing_indices.add(1)
                    continue
                prefix = f"{filename}_"
                if not name_without_ext.startswith(prefix):
                    continue
                suffix = name_without_ext[len(prefix) :]
                if not suffix.isdigit():
                    continue
                existing_indices.add(int(suffix))
        except Exception:
            pass

        for idx in sorted(existing_indices):
            versions.setdefault(str(idx), "")

        if versions:
            numeric_indices = []
            for index_str in versions.keys():
                try:
                    numeric_indices.append(int(index_str))
                except ValueError:
                    continue
            next_index = max(numeric_indices) + 1 if numeric_indices else 1
        else:
            next_index = 1

        versions[str(next_index)] = signature
        self.__class__._version_cache[key] = versions

        if next_index <= 1:
            name = f"{filename}{extension}"
        else:
            name = f"{filename}_{next_index}{extension}"

        return os.path.join(output_dir, name)
