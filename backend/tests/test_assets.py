import pytest
from unittest.mock import patch, MagicMock
from app import app
import io

def test_api_assets_get_all(client, mocker):
    """Test fetching all assets."""
    mock_assets = [
        {
            "id": 1,
            "assetId": "LPT260001",
            "category": "Laptop",
            "brand": "Lenovo",
            "model": "ThinkPad",
            "serial": "123456",
            "assignee": "Alice",
            "empCode": "E001",
            "cug": "9876543210",
            "email": "alice@example.com",
            "group": "IT",
            "department": "Engineering",
            "branch": "Cotton Concepts HO, Coimbatore",
            "purchaseDate": "2026-01-01",
            "warranty": "1 Year",
            "condition": "Excellent",
            "remarks": "Assigned to Alice",
            "qrCode": "/api/assets/LPT260001/qr"
        }
    ]
    mocker.patch('database.get_all_assets', return_value=mock_assets)
    
    response = client.get('/api/assets')
    
    assert response.status_code == 200
    assert response.json == mock_assets

def test_api_assets_post_success(client, mocker):
    """Test creating an asset with auto-generating assetId."""
    mock_existing_assets = []
    mock_create_result = {"success": True, "assetId": "LPT260001"}
    
    mocker.patch('database.get_all_assets', return_value=mock_existing_assets)
    mocker.patch('database.create_asset', return_value=mock_create_result)
    
    payload = {
        "category": "laptop",
        "brand": "Lenovo",
        "model": "ThinkPad",
        "serial": "123456",
        "assignee": "Alice",
        "empCode": "E001",
        "cug": "9876543210",
        "email": "alice@example.com",
        "group": "IT",
        "department": "Engineering",
        "branch": "Cotton Concepts HO_ Coimbatore",
        "purchaseDate": "2026-01-01",
        "warranty": "1 Year",
        "condition": "Excellent",
        "remarks": "Assigned to Alice"
    }
    
    response = client.post('/api/assets', json=payload)
    
    assert response.status_code == 201
    assert response.json.get("success") is True
    assert response.json.get("assetId") == "LPT260001"

def test_api_assets_get_single_success(client, mocker):
    """Test fetching a single asset by alphanumeric ID."""
    mock_asset = {
        "id": 1,
        "assetId": "LPT260001",
        "category": "Laptop",
        "brand": "Lenovo"
    }
    mocker.patch('database.get_all_assets', return_value=[mock_asset])
    
    response = client.get('/api/assets/LPT260001')
    
    assert response.status_code == 200
    assert response.json == mock_asset

def test_api_assets_get_single_not_found(client, mocker):
    """Test fetching a non-existent asset."""
    mocker.patch('database.get_all_assets', return_value=[])
    
    response = client.get('/api/assets/NONEXISTENT')
    
    assert response.status_code == 404
    assert "error" in response.json

def test_api_assets_update_success(client, mocker):
    """Test updating an asset details."""
    mocker.patch('database.update_asset', return_value={"success": True})
    
    payload = {"brand": "Dell"}
    response = client.put('/api/assets/1', json=payload)
    
    assert response.status_code == 200
    assert response.json.get("message") == "Asset updated."

def test_api_assets_update_not_found(client, mocker):
    """Test updating a non-existent asset."""
    mocker.patch('database.update_asset', return_value={"success": False})
    
    payload = {"brand": "Dell"}
    response = client.put('/api/assets/999', json=payload)
    
    assert response.status_code == 404
    assert "error" in response.json

def test_api_assets_delete_success(client, mocker):
    """Test deleting an asset."""
    mocker.patch('database.delete_asset', return_value={"success": True})
    
    response = client.delete('/api/assets/1')
    
    assert response.status_code == 200
    assert response.json.get("message") == "Asset deleted."

def test_api_assets_delete_not_found(client, mocker):
    """Test deleting a non-existent asset."""
    mocker.patch('database.delete_asset', return_value={"success": False})
    
    response = client.delete('/api/assets/999')
    
    assert response.status_code == 404
    assert "error" in response.json

def test_api_assets_qr_code_success(client, mocker):
    """Test generating asset QR code image."""
    mock_asset = {
        "assetId": "LPT260001",
        "branch": "Cotton Concepts HO_ Coimbatore"
    }
    mocker.patch('database.get_all_assets', return_value=[mock_asset])
    
    response = client.get('/api/assets/LPT260001/qr')
    
    assert response.status_code == 200
    assert response.headers['Content-Type'] == 'image/png'

def test_api_assets_bulk_delete_success(client, mocker):
    """Test bulk deleting assets successfully."""
    mocker.patch('database.delete_asset', return_value={"success": True})
    
    payload = {
        "admin_email": "admin@support.com",
        "asset_ids": [1, 2, 3]
    }
    response = client.post('/api/bulk-delete-assets', json=payload)
    
    assert response.status_code == 200
    assert response.json.get("success_count") == 3
    assert response.json.get("message") == "Successfully deleted 3 assets"

def test_api_assets_bulk_delete_unauthorized(client):
    """Test bulk deleting assets as a non-super-admin."""
    payload = {
        "admin_email": "notadmin@support.com",
        "asset_ids": [1, 2]
    }
    response = client.post('/api/bulk-delete-assets', json=payload)
    
    assert response.status_code == 403
    assert "error" in response.json


def test_row_to_admin_asset_includes_images_and_qr():
    """Verify _row_to_admin_asset parses stored images JSON and includes qrCode."""
    import database
    row = {
        "id": 10,
        "asset_id": "FUR260001",
        "asset_name": "Office Chair",
        "department": "ADMIN",
        "serial_number": "SN-1",
        "assignee": "Unassigned",
        "location": "Floor 1",
        "group": "Admin",
        "type": "Furniture",
        "quantity": "2",
        "status": "Active",
        "branch": "Cotton Concepts HO, Coimbatore",
        "warranty_expiry": "",
        "purchase_cost": "4500",
        "category": "Chair",
        "brand_model": "Godrej",
        "remarks": "New",
        "images": '["data:image/jpeg;base64,abc123"]'
    }
    asset = database._row_to_admin_asset(row)
    assert asset["images"] == ["data:image/jpeg;base64,abc123"]
    assert asset["qrCode"] == "/api/assets/FUR260001/qr"
    assert asset["brandModel"] == "Godrej"

    # Malformed or empty images must safely fall back to empty list
    assert database._row_to_admin_asset({**row, "images": ""})["images"] == []
    assert database._row_to_admin_asset({**row, "images": "not-json"})["images"] == []


def test_create_and_update_admin_asset_persists_images(mocker):
    """Verify create_admin_asset and update_admin_asset persist the images column."""
    import database

    mock_cur = MagicMock()
    mock_cur.fetchone.return_value = (15, "FUR260005")
    mock_cur.rowcount = 1
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_conn.__enter__.return_value = mock_conn
    mocker.patch('database._get_conn', return_value=mock_conn)

    res = database.create_admin_asset({
        "assetId": "FUR260005",
        "assetName": "Desk",
        "type": "Furniture",
        "images": ["data:image/jpeg;base64,img1"]
    })
    assert res == {"success": True, "id": 15, "assetId": "FUR260005"}
    insert_sql, insert_params = mock_cur.execute.call_args[0]
    assert "images" in insert_sql
    assert insert_params[-1] == '["data:image/jpeg;base64,img1"]'

    mocker.patch('database.get_admin_asset_by_id', return_value={
        "assetId": "FUR260005",
        "images": ["data:image/jpeg;base64,img1"]
    })
    mocker.patch('database.compare_and_log_changes')

    upd = database.update_admin_asset(15, {
        "assetId": "FUR260005",
        "assetName": "Desk",
        "images": ["data:image/jpeg;base64,img2"]
    })
    assert upd == {"success": True}
    update_sql, update_params = mock_cur.execute.call_args[0]
    assert "images = %s" in update_sql
    assert update_params[-2] == '["data:image/jpeg;base64,img2"]'

    # Partial update without 'images' preserves existing images
    database.update_admin_asset(15, {
        "assetId": "FUR260005",
        "assetName": "Desk Updated"
    })
    _, preserve_params = mock_cur.execute.call_args[0]
    assert preserve_params[-2] == '["data:image/jpeg;base64,img1"]'


def test_api_admin_assets_images_and_json_errors(client, mocker):
    """Verify /api/admin-assets handles images, serves images, and returns JSON on errors."""
    mocker.patch('database.get_all_admin_assets', return_value=[])
    create_mock = mocker.patch('database.create_admin_asset', return_value={"success": True, "id": 1, "assetId": "ADM260001"})

    payload = {
        "assetName": "Conference Table",
        "type": "Furniture",
        "category": "Furniture",
        "department": "ADMIN",
        "status": "Active",
        "images": ["data:image/jpeg;base64,AAAA"]
    }
    resp = client.post('/api/admin-assets', json=payload)
    assert resp.status_code == 201
    assert create_mock.call_args[0][0]["images"] == ["data:image/jpeg;base64,AAAA"]

    # Malformed JSON body returns clean 400 JSON instead of HTML error page
    bad_resp = client.post('/api/admin-assets', data='{bad json', content_type='application/json')
    assert bad_resp.status_code == 400
    assert "error" in bad_resp.json

    # Unknown API route returns JSON 404 instead of SPA HTML
    not_found_resp = client.get('/api/does-not-exist')
    assert not_found_resp.status_code == 404
    assert "error" in not_found_resp.json


def test_api_admin_asset_image_route(client, mocker):
    """Verify GET /api/admin-assets/<id>/image serves base64 image and handles invalid JSON."""
    import base64
    sample_b64 = base64.b64encode(b"fake-png-bytes").decode("ascii")
    mock_cur = MagicMock()
    mock_cur.fetchone.return_value = (f'["data:image/png;base64,{sample_b64}"]',)
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mocker.patch('database._get_conn', return_value=mock_conn)

    resp = client.get('/api/admin-assets/ADM260001/image/0')
    assert resp.status_code == 200
    assert resp.mimetype == 'image/png'
    assert resp.data == b"fake-png-bytes"

    # Corrupted stored JSON returns 404 JSON cleanly instead of 500
    mock_cur.fetchone.return_value = ('{corrupted',)
    bad_img_resp = client.get('/api/admin-assets/ADM260001/image/0')
    assert bad_img_resp.status_code == 404
    assert "error" in bad_img_resp.json


def test_update_admin_asset_preserves_asset_id_when_missing_or_null(client, mocker):
    """Verify update_admin_asset never overwrites asset_id with NULL/empty when omitted."""
    import database

    mock_cur = MagicMock()
    mock_cur.rowcount = 1
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_conn.__enter__.return_value = mock_conn
    mocker.patch('database._get_conn', return_value=mock_conn)
    mocker.patch('database.compare_and_log_changes')

    # Case 1: payload omits assetId (AssetDetails edit flow) -> uses old_asset['assetId']
    mocker.patch('database.get_admin_asset_by_id', return_value={
        "id": 231,
        "assetId": "FUR260010",
        "images": []
    })
    res = database.update_admin_asset(231, {
        "assetName": "Rolling Chair",
        "department": "ACCOUNTS",
        "assignee": "Karthikeyan E",
        "type": "Furniture",
        "status": "Active",
        "images": ["data:image/jpeg;base64,img1"]
    })
    assert res == {"success": True}
    sql, params = mock_cur.execute.call_args[0]
    assert "COALESCE(NULLIF(%s, ''), asset_id)" in sql
    assert params[2] == "FUR260010"

    # Case 2: explicit assetId=None -> still falls back cleanly and never passes None
    database.update_admin_asset(231, {"assetId": None, "assetName": "Rolling Chair"})
    _, null_params = mock_cur.execute.call_args[0]
    assert null_params[2] == "FUR260010"

    # Case 3: even if old_asset lookup returns None, param is '' (never None) for COALESCE
    mocker.patch('database.get_admin_asset_by_id', return_value=None)
    database.update_admin_asset(231, {"assetName": "Rolling Chair"})
    _, missing_old_params = mock_cur.execute.call_args[0]
    assert missing_old_params[2] == ""

    # Case 4: PUT /api/admin-assets/231 without assetId succeeds with 200
    mocker.patch('database.get_admin_asset_by_id', return_value={"id": 231, "assetId": "FUR260010", "images": []})
    resp = client.put('/api/admin-assets/231', json={"assetName": "Rolling Chair", "images": ["data:image/jpeg;base64,img1"]})
    assert resp.status_code == 200


def test_admin_assets_nullable_optional_fields_and_group_normalization(client, mocker):
    """Verify only mandatory Admin Asset fields are required; optional fields accept None/null."""
    import database

    # _row_to_admin_asset normalizes lowercase group and SQL None optional fields
    normalized = database._row_to_admin_asset({
        "id": 21,
        "asset_id": "FUR260021",
        "asset_name": "Guest Chair",
        "department": "ACCOUNTS",
        "serial_number": None,
        "assignee": None,
        "location": None,
        "group": "admin",
        "type": "Furniture",
        "quantity": "2",
        "status": "Active",
        "branch": "Doctor Towels HO",
        "warranty_expiry": None,
        "purchase_cost": None,
        "category": None,
        "brand_model": None,
        "remarks": None,
        "images": None
    })
    assert normalized["group"] == "Admin"
    assert normalized["serial"] == ""
    assert normalized["category"] == ""
    assert normalized["brandModel"] == ""
    assert normalized["assignee"] == ""

    mock_cur = MagicMock()
    mock_cur.fetchone.return_value = (21, "FUR260021")
    mock_cur.rowcount = 1
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mock_conn.__enter__.return_value = mock_conn
    mocker.patch('database._get_conn', return_value=mock_conn)
    mocker.patch('database.compare_and_log_changes')

    # create_admin_asset stores None/NULL cleanly for optional fields
    create_res = database.create_admin_asset({
        "assetId": "FUR260021",
        "assetName": "Guest Chair",
        "type": "Furniture",
        "quantity": "2",
        "status": "Active",
        "department": "ACCOUNTS",
        "branch": "Doctor Towels HO",
        "group": "admin",
        "category": None,
        "brandModel": None,
        "serial": None,
        "assignee": None,
        "location": None,
        "purchaseCost": None,
        "warrantyExpiry": None,
        "remarks": None,
        "images": None
    })
    assert create_res == {"success": True, "id": 21, "assetId": "FUR260021"}
    _, create_params = mock_cur.execute.call_args[0]
    assert create_params[6] == "Admin"  # normalized group
    assert create_params[3] is None     # serial_number
    assert create_params[4] is None     # assignee
    assert create_params[5] is None     # location
    assert create_params[13] is None    # category
    assert create_params[14] is None    # brand_model
    assert create_params[15] is None    # remarks

    # update_admin_asset clears optional fields to None when explicitly passed null/empty
    mocker.patch('database.get_admin_asset_by_id', return_value={
        "id": 21,
        "assetId": "FUR260021",
        "assetName": "Guest Chair",
        "department": "ACCOUNTS",
        "type": "Furniture",
        "quantity": "2",
        "status": "Active",
        "branch": "Doctor Towels HO",
        "group": "admin",
        "remarks": "Old",
        "images": []
    })
    upd_res = database.update_admin_asset(21, {
        "assetName": "Guest Chair",
        "type": "Furniture",
        "quantity": "4",
        "status": "Active",
        "department": "ACCOUNTS",
        "branch": "Doctor Towels HO",
        "group": "admin",
        "category": None,
        "brandModel": "",
        "serial": None,
        "assignee": None,
        "location": None,
        "purchaseCost": None,
        "warrantyExpiry": None,
        "remarks": None,
        "images": ["data:image/jpeg;base64,img1"]
    })
    assert upd_res == {"success": True}
    _, upd_params = mock_cur.execute.call_args[0]
    assert upd_params[2] == "FUR260021"
    assert upd_params[6] == "Admin"
    assert upd_params[14] is None  # brand_model
    assert upd_params[15] is None  # remarks

    # POST /api/admin-assets handles null category even when existing items have null category
    mocker.patch('database.get_all_admin_assets', return_value=[{"assetId": "FUR260001", "category": None}])
    create_mock = mocker.patch('database.create_admin_asset', return_value={"success": True, "id": 22, "assetId": "ADM260001"})
    post_resp = client.post('/api/admin-assets', json={
        "assetName": "Office Table",
        "type": "Furniture",
        "quantity": "1",
        "status": "Active",
        "department": "ACCOUNTS",
        "branch": "Doctor Towels HO",
        "category": None,
        "assignee": None,
        "remarks": None
    })
    assert post_resp.status_code == 201
    assert create_mock.call_args[0][0]["category"] is None


def test_api_admin_assets_cors_credentials(client, mocker):
    """Verify cross-origin requests to admin assets allow credentials cleanly."""
    mocker.patch('database.update_admin_asset', return_value={"success": True})
    resp = client.put(
        '/api/admin-assets/231',
        json={"assetName": "Chair"},
        headers={"Origin": "http://122.165.253.167:443"}
    )
    assert resp.status_code == 200
    assert resp.headers.get("Access-Control-Allow-Credentials") == "true"


def test_get_all_admin_assets_deduplicates_filter_options(mocker):
    """Verify get_all_admin_assets deduplicates case/whitespace variants in filter_options."""
    import database

    mock_cur = MagicMock()
    mock_cur.fetchone.return_value = {"count": 0}
    mock_cur.fetchall.side_effect = [
        [],  # paginated rows
        [{"type": "FURNITURE"}, {"type": "Furniture"}, {"type": " furniture "}],
        [{"branch": "Doctor Towels HO"}, {"branch": "doctor towels ho "}],
        [{"department": "ACCOUNTS"}, {"department": "Accounts"}, {"department": " Accounts "}],
        [{"status": "ACTIVE"}, {"status": "Active"}],
    ]
    mock_conn = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur
    mocker.patch('database._get_conn', return_value=mock_conn)

    res = database.get_all_admin_assets(page=1, limit=20)
    assert res["filter_options"]["departments"] == ["Accounts"]
    assert res["filter_options"]["types"] == ["Furniture"]
    assert res["filter_options"]["branches"] == ["Doctor Towels HO"]
    assert res["filter_options"]["statuses"] == ["Active"]






