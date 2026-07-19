import os
import sys
import json
import hashlib
import asyncio
import logging
from typing import Optional, Dict, List, Any, Tuple
from datetime import datetime
from enum import Enum
from abc import ABC, abstractmethod

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class HttpMethod(Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"


class ApiResponse:
    def __init__(self, status: int, data: Any, message: str):
        self.status = status
        self.data = data
        self.message = message
        self.timestamp = int(datetime.now().timestamp())

    def to_dict(self) -> Dict:
        return {
            "status": self.status,
            "data": self.data,
            "message": self.message,
            "timestamp": self.timestamp,
        }


class UserConfig:
    def __init__(self, name: str, email: str, role: str = "viewer"):
        self.name = name
        self.email = email
        self.role = role
        self.created_at = datetime.now()

    def validate(self) -> bool:
        if not self.name or len(self.name) < 2:
            return False
        if "@" not in self.email:
            return False
        if self.role not in ("admin", "user", "viewer"):
            return False
        return True

    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat(),
        }


class BaseService(ABC):
    def __init__(self, base_url: str, timeout: int = 5000):
        self.base_url = base_url
        self.timeout = timeout

    @abstractmethod
    async def handle(self, data: Any) -> ApiResponse:
        pass

    def _log(self, method: str, path: str) -> None:
        logger.info(f"[{method}] {path}")


class UserService(BaseService):
    def __init__(self):
        super().__init__("https://api.example.com/users")
        self._users: Dict[str, UserConfig] = {}

    async def handle(self, data: Any) -> ApiResponse:
        return await self.get_user(str(data))

    async def get_user(self, user_id: str) -> ApiResponse:
        user = self._users.get(user_id)
        if not user:
            return ApiResponse(404, None, "Not found")
        return ApiResponse(200, user.to_dict(), "OK")

    async def create_user(self, config: UserConfig) -> ApiResponse:
        if not config.validate():
            return ApiResponse(400, None, "Invalid config")
        user_id = hashlib.sha256(os.urandom(32)).hexdigest()
        self._users[user_id] = config
        return ApiResponse(201, config.to_dict(), "Created")

    async def update_user(self, user_id: str, updates: Dict) -> ApiResponse:
        existing = self._users.get(user_id)
        if not existing:
            return ApiResponse(404, None, "Not found")
        for key, value in updates.items():
            setattr(existing, key, value)
        return ApiResponse(200, existing.to_dict(), "Updated")

    async def delete_user(self, user_id: str) -> ApiResponse:
        if user_id not in self._users:
            return ApiResponse(404, None, "Not found")
        del self._users[user_id]
        return ApiResponse(200, None, "Deleted")

    def list_users(self) -> List[UserConfig]:
        return list(self._users.values())


class SearchEngine:
    def __init__(self, index_dir: str):
        self.index_dir = index_dir
        self.documents: Dict[str, str] = {}

    def index_file(self, filepath: str) -> None:
        if not os.path.exists(filepath):
            return
        with open(filepath, "r") as f:
            content = f.read()
        doc_id = hashlib.md5(filepath.encode()).hexdigest()
        self.documents[doc_id] = content

    def search(self, query: str) -> List[Tuple[str, float]]:
        results = []
        query = query.lower()
        for doc_id, content in self.documents.items():
            if query in content.lower():
                score = content.lower().count(query) / len(content)
                results.append((doc_id, score))
        return sorted(results, key=lambda x: x[1], reverse=True)[:10]


def calculate_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def validate_email(email: str) -> bool:
    import re
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email))


def paginate(items: List[Any], page: int, per_page: int) -> Dict:
    start = (page - 1) * per_page
    end = start + per_page
    return {
        "items": items[start:end],
        "total": len(items),
        "pages": -(-len(items) // per_page),
    }


async def retry(fn, retries: int, delay: float):
    for i in range(retries):
        try:
            return await fn()
        except Exception as e:
            if i == retries - 1:
                raise
            await asyncio.sleep(delay)
