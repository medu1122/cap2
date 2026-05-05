from routers.calendar import _extract_copy_text


def test_extract_copy_text_combines_known_keys():
    payload = {
        "subject": "Khuyen mai moi",
        "body": "Noi dung chi tiet",
        "cta": "Mua ngay",
    }
    text = _extract_copy_text(payload)
    assert "Khuyen mai moi" in text
    assert "Noi dung chi tiet" in text
    assert "Mua ngay" in text
