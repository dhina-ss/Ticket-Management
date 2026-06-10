import sys
import os
import uuid

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import append_to_sheet, update_ticket_details, get_ticket_by_id, init_db

def test_user_rejection_moves_to_pending():
    init_db()
    
    ticket_id = f"TEST{uuid.uuid4().hex[:6].upper()}"
    data = {
        "ticket_id": ticket_id,
        "fullName": "Test User",
        "mobile": "1234567890",
        "category": "Test",
        "mode": "Test",
        "description": "Test ticket"
    }
    
    # 1. Create ticket
    append_to_sheet(data)
    
    # 2. Mark as Completed
    update_ticket_details(ticket_id, {"status": "Completed"})
    ticket = get_ticket_by_id(ticket_id)
    assert ticket["status"] == "Completed"
    
    # 3. User marks "No"
    update_ticket_details(ticket_id, {"user_confirmation": "No"})
    
    # 4. Verify status changed to Pending
    ticket = get_ticket_by_id(ticket_id)
    assert ticket["status"] == "Pending"
    assert ticket["userConfirmation"] == "No"
    assert ticket["pendingTime"] != ""
    
    print(f"Successfully verified ticket {ticket_id} moved to Pending on rejection.")

if __name__ == "__main__":
    test_user_rejection_moves_to_pending()
