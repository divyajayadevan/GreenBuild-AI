from fastapi.testclient import TestClient

from app.main import app


def test_admin_materials_endpoint_returns_metadata() -> None:
    client = TestClient(app)

    response = client.get("/admin/materials")

    assert response.status_code == 200
    body = response.json()
    assert "row_count" in body
    assert "regions" in body


def test_admin_upload_rejects_non_csv() -> None:
    client = TestClient(app)

    response = client.post(
        "/admin/materials/upload",
        files={"file": ("materials.txt", b"not,csv", "text/plain")},
    )

    assert response.status_code == 400
