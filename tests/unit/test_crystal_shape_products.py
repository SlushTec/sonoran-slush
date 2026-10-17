import pytest
from pydantic import ValidationError
from services.commerce.app.workflows import Item


def test_heart_product_accepts_its_large_size_and_binds_its_shape():
    item = Item(product_slug="photo-crystal-heart", quantity=1, options={"Size": "Large"})
    assert item.options == {"Size": "Large", "Crystal shape": "Heart"}


@pytest.mark.parametrize("slug,options", [
    ("photo-crystal-heart", {"Size": "Mini Mantel (6 × 4 in)"}),
    ("photo-crystal-prestige", {"Size": "Large"}),
    ("photo-crystal-rectangle-tall", {"Size": "Large Mantel"}),
    ("photo-crystal-heart", {"Size": "Small", "Crystal shape": "Rectangle tall"}),
    ("photo-crystal-dog-bone", {"Size": "6 × 4 in", "Orientation": "Diagonal"}),
])
def test_unproducible_or_cross_product_crystal_options_are_rejected(slug, options):
    with pytest.raises(ValidationError):
        Item(product_slug=slug, quantity=1, options=options)


def test_legacy_crystal_request_keeps_its_original_shape_and_size():
    item = Item(product_slug="photo-crystal-collection", quantity=2,
                options={"Crystal shape": "Heart", "Size": "Large"}, text="Keep this memory")
    assert item.product_slug == "photo-crystal-collection"
    assert item.options == {"Crystal shape": "Heart", "Size": "Large"}
    assert item.text == "Keep this memory"
