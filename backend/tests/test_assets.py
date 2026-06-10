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
            "branch": "Cotton Concepts HO_ Coimbatore",
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
