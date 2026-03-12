import pytest
from unittest.mock import patch, MagicMock
from app import app

def test_api_tickets_get(client, mocker):
    """Test fetching all tickets."""
    mock_tickets = [{"ticket_id": "TKT001", "status": "Pending"}]
    # Mock the database function called by the endpoint
    mocker.patch('app.get_all_tickets', return_value=mock_tickets)
    
    response = client.get('/api/tickets')
    
    assert response.status_code == 200
    assert response.json == mock_tickets


def test_api_status_get(client, mocker):
    """Test fetching status for a single ticket."""
    mock_ticket = {"ticket_id": "TKT001", "status": "Approved"}
    mocker.patch('app.get_ticket_by_id', return_value=mock_ticket)
    
    response = client.get('/api/status/TKT001')
    
    assert response.status_code == 200
    assert response.json == mock_ticket


def test_api_status_get_not_found(client, mocker):
    """Test fetching status for a non-existent ticket."""
    mocker.patch('app.get_ticket_by_id', return_value=None)
    
    response = client.get('/api/status/TKT999')
    
    assert response.status_code == 404
def test_api_login_success(client, mocker):
    """Test admin login success."""
    mock_user = {"id": 1, "name": "Admin", "email": "admin@example.com"}
    mocker.patch('database.verify_admin_login', return_value=mock_user)
    
    response = client.post('/api/login', json={
        "email": "admin@example.com",
        "password": "correctpassword"
    })
    
    assert response.status_code == 200
    assert response.json.get("success") is True
    assert response.json.get("user") == mock_user


def test_api_login_failure(client, mocker):
    """Test admin login failure."""
    mocker.patch('database.verify_admin_login', return_value=None)
    
    response = client.post('/api/login', json={
        "email": "admin@example.com",
        "password": "wrongpassword"
    })
    
    assert response.status_code == 401
    assert response.json.get("success") is False


def test_api_submit_ticket(client, mocker):
    """Test ticket submission endpoint."""
    mocker.patch('database.get_max_sequential_id', return_value=99)
    # The endpoint internally uses append_to_sheet to insert into the db
    mocker.patch('app.append_to_sheet', return_value={"success": True})
    
    # We send form data, and no file to simulate basic submission
    form_data = {
        "fullName": "Test User",
        "mobile": "+91 98765 43210",
        "category": "Software",
        "description": "Test submit issue"
    }
    
    response = client.post('/api/submit', data=form_data)
    
    assert response.status_code == 200
    assert response.json.get("message") == "Ticket submitted successfully"
    # ticket id should be TKT100 since max id was mocked as 99
    assert response.json.get("ticket_id") == "TKT100"
