import requests
import pytest
import os
import time

BASE_URL = "http://localhost:443" # Adjust if needed

@pytest.fixture(autouse=True)
def setup_test_mode():
    os.environ['APP_ENV'] = 'local'
    # Clear last email state
    requests.post(f"{BASE_URL}/api/test/clear-last-email")

def test_full_ticket_lifecycle():
    # 1. Create Ticket (Form Data)
    ticket_payload = {
        "fullName": "API Test User",
        "mobile": "1234567890",
        "email": "api-test@example.com",
        "category": "Software/IT",
        "subCategory": "Software Installation",
        "branch": "Main Office",
        "department": "IT",
        "priority": "Medium",
        "description": "API test ticket description"
    }
    
    response = requests.post(f"{BASE_URL}/api/submit", data=ticket_payload)
    assert response.status_code == 200
    data = response.json()
    ticket_id = data['ticket_id']
    assert ticket_id.startswith('TKT')

    # 2. Verify Email Notification (Creation)
    time.sleep(1)
    mail_response = requests.get(f"{BASE_URL}/api/test/last-email")
    assert mail_response.status_code == 200
    last_mail = mail_response.json()
    assert last_mail['to'] == 'itcottonconcepts@gmail.com'
    assert f"New Ticket {ticket_id}" in last_mail['subject']

    # 3. Check Initial Status
    response = requests.get(f"{BASE_URL}/api/status/{ticket_id}")
    assert response.status_code == 200
    assert response.json()['status'] == "Not Started"

    # 4. Admin Update (Assign & In-Progress)
    update_payload = {
        "status": "In Progress",
        "assignee": "Ruban",
        "internal_comments": "Working on it"
    }
    response = requests.put(f"{BASE_URL}/api/tickets/{ticket_id}", json=update_payload)
    assert response.status_code == 200

    # 5. Admin Complete
    complete_payload = {
        "status": "Completed",
        "resolution_comments": "Fixed via API test"
    }
    response = requests.put(f"{BASE_URL}/api/tickets/{ticket_id}", json=complete_payload)
    assert response.status_code == 200

    # 6. Verify Final Status and Completion Email
    response = requests.get(f"{BASE_URL}/api/status/{ticket_id}")
    assert response.json()['status'] == "Completed"
    
    time.sleep(1)
    mail_response = requests.get(f"{BASE_URL}/api/test/last-email")
    last_mail = mail_response.json()
    assert last_mail['to'] == 'api-test@example.com'
    assert f"Ticket Resolved: {ticket_id}" in last_mail['subject']
    assert "Fixed via API test" in last_mail['body']

def test_named_approvals_and_voting():
    # 1. Create Ticket requiring approvals
    ticket_payload = {
        "fullName": "Approval Test User",
        "mobile": "0987654321",
        "email": "approval-test@example.com",
        "category": "Hardware/Assets", # Triggers Manager + Management
        "branch": "Test Branch",
        "department": "IT",
        "description": "Approval test ticket"
    }
    
    response = requests.post(f"{BASE_URL}/api/submit", data=ticket_payload)
    assert response.status_code == 200
    ticket_id = response.json()['ticket_id']

    # 2. Manager Approval (Named)
    # The process_approval route expects form-data
    approval_data = {
        "action": "Approve",
        "comments": "Manager likes it",
        "receiver_name": "Balaji Manager"
    }
    response = requests.post(f"{BASE_URL}/api/approval/action/{ticket_id}/Admin-Manager", data=approval_data)
    if response.status_code != 200:
        print(f"DEBUG: Approval failed: {response.text}")
    assert response.status_code == 200

    # Verify status
    response = requests.get(f"{BASE_URL}/api/status/{ticket_id}")
    status_data = response.json()
    if status_data.get('adminManagerStatus') != "Balaji Manager: Approved":
        print(f"DEBUG: adminManagerStatus match failed. Actual: {status_data.get('adminManagerStatus')}")
    assert status_data['adminManagerStatus'] == "Balaji Manager: Approved"
    assert "Balaji Manager: Manager likes it" in status_data['adminManagerComments']

    # 3. Management Approval 1
    approval_data = {
        "action": "Approve",
        "comments": "Management 1 OK",
        "receiver_name": "Annie"
    }
    response = requests.post(f"{BASE_URL}/api/approval/action/{ticket_id}/Management", data=approval_data)
    assert response.status_code == 200

    # 4. Management Approval 2
    approval_data = {
        "action": "Approve",
        "comments": "Management 2 OK",
        "receiver_name": "Vanjinathan"
    }
    response = requests.post(f"{BASE_URL}/api/approval/action/{ticket_id}/Management", data=approval_data)
    assert response.status_code == 200

    # Verify status and appending
    response = requests.get(f"{BASE_URL}/api/status/{ticket_id}")
    status_data = response.json()
    # Should be comma-separated list
    assert "Annie: Approved" in status_data['managementStatus']
    assert "Vanjinathan: Approved" in status_data['managementStatus']
    # Comments should be timestamped and appended
    assert "Annie: Management 1 OK" in status_data['managementComments']
    assert "Vanjinathan: Management 2 OK" in status_data['managementComments']

    # 5. Verify Overall Status calculation (should be "In Progress" or "Not Started" but NOT "Rejected")
    assert status_data['status'] != "Rejected"

if __name__ == "__main__":
    test_full_ticket_lifecycle()
    test_named_approvals_and_voting()
