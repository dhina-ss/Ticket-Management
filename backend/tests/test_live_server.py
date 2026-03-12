import pytest
import requests
import json
import uuid

# Base URL for the production server
# We use localhost for backend E2E testing because hairpin NAT (loopback) might fail 
# when accessing the public IP from inside the same network.
BASE_URL = "http://127.0.0.1:443"

# Note: We must disable SSL warnings if the server is technically HTTPS but doesn't have a valid cert,
# or simply if the IP mapping triggers warnings. For now, testing generic HTTP connectivity.
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def test_frontend_loads():
    """Verify that the base URL serves the React index.html."""
    response = requests.get(BASE_URL, verify=False, timeout=10)
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
    assert "Ticket Raise" in response.text or "vite" in response.text.lower() or "<div id=\"root\">" in response.text, "Index HTML not rendered"


def test_api_login_failure():
    """Verify that the login endpoint rejects invalid credentials."""
    response = requests.post(
        f"{BASE_URL}/api/login",
        json={"email": "invalid@example.com", "password": "wrongpassword"},
        verify=False,
        timeout=10
    )
    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"
    data = response.json()
    assert data.get("success") is False
    assert "error" in data


def test_api_submit_ticket_and_check_status():
    """
    Verify complete E2E flow for a normal user:
    1. Submit a new ticket.
    2. Check that the ticket appears in the status check.
    """
    # Create unique mobile and name to prevent collision
    unique_mobile = "+91 99999 " + str(uuid.uuid4().int)[:5]
    
    submit_payload = {
        "fullName": "Integration Test User",
        "mobile": unique_mobile,
        "category": "System issue",
        "department": "Admin & IT",
        "description": "This is an automated integration test."
    }

    # 1. Submit Ticket
    submit_resp = requests.post(
        f"{BASE_URL}/api/submit",
        data=submit_payload,
        verify=False,
        timeout=10
    )
    assert submit_resp.status_code == 200, f"Submit failed: {submit_resp.text}"
    submit_data = submit_resp.json()
    assert submit_data.get("message") == "Ticket submitted successfully"
    ticket_id = submit_data.get("ticket_id")
    assert ticket_id is not None

    # 2. Check Status by Mobile
    # Since normalizing logic removes spaces/pluses, we pass the raw exactly as we would in the browser.
    status_resp_mobile = requests.get(
        f"{BASE_URL}/api/status/mobile/{unique_mobile}",
        verify=False,
        timeout=10
    )
    assert status_resp_mobile.status_code == 200, f"Mobile status check failed: {status_resp_mobile.text}"
    mobile_data = status_resp_mobile.json()
    assert isinstance(mobile_data, list)
    assert len(mobile_data) >= 1
    
    # Ensure our newly created ticket is in the list
    found = any(t.get("ticket_id") == ticket_id for t in mobile_data)
    assert found is True, "Newly created ticket not found in mobile status check"

    # 3. Check Status by Ticket ID
    status_resp_id = requests.get(
        f"{BASE_URL}/api/status/{ticket_id}",
        verify=False,
        timeout=10
    )
    assert status_resp_id.status_code == 200, f"ID status check failed: {status_resp_id.text}"
    id_data = status_resp_id.json()
    assert id_data.get("ticket_id") == ticket_id
    assert id_data.get("fullName") == "Integration Test User"
