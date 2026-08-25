"""Shared response shapes."""

from __future__ import annotations

import math
from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")


class PageParams:
    """Shared pagination query params (FastAPI "classes as dependencies").

    ``offset`` centralizes the off-by-one math. Uses the ``= Query(...)``
    default-value form, not ``Annotated[int, Query(...)]`` — the Annotated
    form on an ``__init__`` parameter does not resolve correctly here under
    ``from __future__ import annotations`` (FastAPI wraps the still-string
    annotation in a second ``Annotated`` instead of evaluating it).
    """

    def __init__(
        self, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)
    ) -> None:
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def build(cls, items: list[T], total: int, page: int, page_size: int) -> Page[T]:
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=max(1, math.ceil(total / page_size)) if page_size else 1,
        )
