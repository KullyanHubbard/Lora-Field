import sqlite3
from typing import Literal, cast


Language = Literal["id", "en"]
DEFAULT_LANGUAGE: Language = "en"
SUPPORTED_LANGUAGES = {"id", "en"}


def resolve_language(
    stored_language: str | None,
    browser_language: Language | None = None,
) -> Language:
    if stored_language in SUPPORTED_LANGUAGES:
        return cast(Language, stored_language)
    return browser_language or DEFAULT_LANGUAGE


def ensure_user_language(
    connection: sqlite3.Connection,
    user_id: str,
    stored_language: str | None,
    browser_language: Language | None = None,
) -> Language:
    language = resolve_language(stored_language, browser_language)
    if stored_language != language:
        connection.execute(
            "UPDATE users SET language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (language, user_id),
        )
    return language


def set_user_language(
    connection: sqlite3.Connection,
    user_id: str,
    language: Language,
) -> None:
    connection.execute(
        "UPDATE users SET language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        (language, user_id),
    )
