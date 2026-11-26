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


