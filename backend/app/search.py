from typing import Annotated

from fastapi import Query

SearchText = Annotated[str | None, Query(max_length=80, pattern=r"^[^\x00]*$")]
