import pytest

from app.services.public_reviews import reviewer_label


@pytest.mark.parametrize(
    ("full_name", "expected"),
    [
        ("Maya Patel", "Maya P."),
        ("Maya", "Maya"),
        ("Maya van der Berg", "Maya B."),
        ("  Maya   Patel  ", "Maya P."),
        ("maya patel", "maya P."),
        ("Maya\tPatel", "Maya P."),
        ("Maya patel", "Maya P."),
        ("Zoë Émile", "Zoë É."),
        ("", "A CampusBite customer"),
        ("   ", "A CampusBite customer"),
    ],
)
def test_reviewer_label(full_name, expected):
    assert reviewer_label(full_name) == expected


def test_reviewer_label_never_includes_the_full_surname():
    assert "atel" not in reviewer_label("Maya Patel")
