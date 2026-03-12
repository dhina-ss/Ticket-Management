import os.path
from datetime import datetime, timedelta
from google.auth.transport.requests import Request
from google.oauth2.service_account import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

# The ID and range of a sample spreadsheet.
# TODO: User needs to update this with their own Spreadsheet ID
SPREADSHEET_ID = '1vCxoHn9P3W32Cg4LkvTq90EbFarh8mH4z8yx_jNrnoI' 

def append_to_sheet(data):
    """
    Appends the data to the Google Sheet.
    data: dict containing ticket info
    """
    creds = None
    
    if os.path.exists('ticket-raise-test-568fbe873bcd.json'):
        try:
            creds = Credentials.from_service_account_file('ticket-raise-test-568fbe873bcd.json', scopes=SCOPES)
        except Exception as e:
            return {'success': False, 'error': f"Error loading credentials: {str(e)}"}
    else:
        return {'success': False, 'error': "ticket-raise-test-568fbe873bcd.json not found. Please place your Service Account JSON key in the backend folder."}

    try:
        service = build('sheets', 'v4', credentials=creds)

        # Get current row count for S.No
        result_a = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='Sheet1!A:A'
        ).execute()
        rows_a = result_a.get('values', [])
        next_s_no = len(rows_a)

        # Prepare values
        # IST is UTC + 5 hours 30 minutes
        ist_time = datetime.utcnow() + timedelta(hours=5, minutes=30)
        timestamp = ist_time.strftime("%Y-%m-%d %H:%M:%S")
        values = [
            [
                str(next_s_no), # S.No (0)
                data.get('ticket_id', ''), # (1)
                timestamp, # (2)
                data.get('fullName', ''), # (3)
                data.get('mobile', ''), # (4) - Changed from email
                data.get('category', ''), # (5)
                data.get('mode', ''), # (6) - New Mode Field
                data.get('subject', ''), # (7)
                data.get('description', ''), # (8)
                data.get('attachment', ''), # (9)
                data.get('assignee', ''), # (10) - Assignee
                'Not Started', # (11) - Status
                data.get('subCategory', '') # (12) - Sub Category
            ]
        ]
        
        body = {
            'values': values
        }
        
        # Append to Sheet1 (default)
        result = service.spreadsheets().values().append(
            spreadsheetId=SPREADSHEET_ID, 
            range='Sheet1!A:M', # Extended range to M
            valueInputOption='USER_ENTERED', 
            body=body
        ).execute()

        return {'success': True, 'updates': result.get('updates')}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def get_existing_ids():
    """
    Fetches all existing ticket IDs from Column B.
    """
    creds = None
    if os.path.exists('ticket-raise-test-568fbe873bcd.json'):
        try:
            creds = Credentials.from_service_account_file('ticket-raise-test-568fbe873bcd.json', scopes=SCOPES)
        except Exception as e:
            print(f"Error loading credentials: {e}")
            return []
    else:
        print("ticket-raise-test-568fbe873bcd.json not found")
        return []

    try:
        service = build('sheets', 'v4', credentials=creds)
        
        # Read Column B (Ticket IDs)
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='Sheet1!B:B'
        ).execute()
        
        rows = result.get('values', [])
        ids = [row[0] for row in rows if row]
        return ids
        
    except Exception as e:
        print(f"Error fetching IDs: {e}")
        return []

def get_ticket_by_id(ticket_id):
    """
    Fetches ticket details by Ticket ID.
    """
    creds = None
    if os.path.exists('ticket-raise-test-568fbe873bcd.json'):
        try:
            creds = Credentials.from_service_account_file('ticket-raise-test-568fbe873bcd.json', scopes=SCOPES)
        except Exception as e:
            print(f"Error loading credentials: {e}")
            return None
    else:
        print("ticket-raise-test-568fbe873bcd.json not found")
        return None

    try:
        service = build('sheets', 'v4', credentials=creds)
        
        # Read all data (up to Column P)
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='Sheet1!A:P' 
        ).execute()
        
        rows = result.get('values', [])
        
        for row in rows:
            # Check Column B for Ticket ID (index 1)
            if len(row) > 1 and row[1] == ticket_id:
                # Return mapped data
                return {
                    "ticket_id": row[1],
                    "timestamp": row[2] if len(row) > 2 else "",
                    "fullName": row[3] if len(row) > 3 else "",
                    "mobile": row[4] if len(row) > 4 else "",
                    "category": row[5] if len(row) > 5 else "",
                    "mode": row[6] if len(row) > 6 else "",
                    "subject": row[7] if len(row) > 7 else "",
                    "description": row[8] if len(row) > 8 else "",
                    "attachment": row[9] if len(row) > 9 else "",
                    "assignee": row[10] if len(row) > 10 else "",
                    "status": row[11] if len(row) > 11 else "Not Started",
                    "subCategory": row[12] if len(row) > 12 else "",
                    "hrStatus": row[13] if len(row) > 13 else "Pending", # N
                    "managerStatus": row[14] if len(row) > 14 else "Pending", # O
                    "approvalComments": row[15] if len(row) > 15 else "" # P
                }
        
        return None
        
    except Exception as e:
        print(f"Error fetching ticket: {e}")
        return None

def get_all_tickets():
    """
    Fetches all tickets from the sheet.
    """
    creds = None
    if os.path.exists('ticket-raise-test-568fbe873bcd.json'):
        try:
            creds = Credentials.from_service_account_file('ticket-raise-test-568fbe873bcd.json', scopes=SCOPES)
        except Exception as e:
            print(f"Error loading credentials: {e}")
            return []
    else:
        print("ticket-raise-test-568fbe873bcd.json not found")
        return []

    try:
        service = build('sheets', 'v4', credentials=creds)
        
        # Read all data (up to Column P)
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='Sheet1!A:P' 
        ).execute()
        
        rows = result.get('values', [])
        tickets = []
        
        # Skip header explicitly if it exists
        # In this implementation, we rely on checking if column 1 matches a ticket ID pattern or just skipping the first row if it says "Ticket ID"
        
        for row in rows:
            if len(row) > 1: # Ensure enough columns
                # Basic check to skip potential header: check if ID column is "Ticket ID" (case insensitive)
                if str(row[1]).lower() == "ticket id":
                    continue
                    
                tickets.append({
                    "ticket_id": row[1],
                    "timestamp": row[2] if len(row) > 2 else "",
                    "fullName": row[3] if len(row) > 3 else "",
                    "mobile": row[4] if len(row) > 4 else "",
                    "category": row[5] if len(row) > 5 else "",
                    "mode": row[6] if len(row) > 6 else "",
                    "subject": row[7] if len(row) > 7 else "",
                    "description": row[8] if len(row) > 8 else "",
                    "attachment": row[9] if len(row) > 9 else "",
                    "assignee": row[10] if len(row) > 10 else "",
                    "status": row[11] if len(row) > 11 else "Not Started",
                    "subCategory": row[12] if len(row) > 12 else "",
                    "hrStatus": row[13] if len(row) > 13 else "Pending", # N
                    "managerStatus": row[14] if len(row) > 14 else "Pending", # O
                    "approvalComments": row[15] if len(row) > 15 else "" # P
                })
        
        # Sort by timestamp descending (newest first)
        # Assuming timestamp format "%Y-%m-%d %H:%M:%S"
        try:
            tickets.sort(key=lambda x: datetime.strptime(x['timestamp'], "%Y-%m-%d %H:%M:%S"), reverse=True)
        except:
            pass # Keep original order if parsing fails
            
        print(f"DEBUG: Fetched {len(tickets)} tickets. Sample: {tickets[0] if tickets else 'None'}")
        return tickets
        
    except Exception as e:
        print(f"Error fetching tickets: {e}")
        return []

def update_ticket_details(ticket_id, updates):
    """
    Updates the details of a ticket in the Google Sheet.
    updates: dict containing fields to update (status, assignee)
    """
    print(f"DEBUG: update_ticket_details called for {ticket_id} with updates: {updates}")
    creds = None
    if os.path.exists('ticket-raise-test-568fbe873bcd.json'):
        try:
            creds = Credentials.from_service_account_file('ticket-raise-test-568fbe873bcd.json', scopes=SCOPES)
        except Exception as e:
            return {'success': False, 'error': f"Error loading credentials: {e}"}
    else:
        return {'success': False, 'error': "ticket-raise-test-568fbe873bcd.json not found"}

    try:
        service = build('sheets', 'v4', credentials=creds)
        
        # 1. Find the row index for the ticket_id
        # Read Column B (Ticket IDs)
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='Sheet1!B:B'
        ).execute()
        
        rows = result.get('values', [])
        row_index = -1
        
        for i, row in enumerate(rows):
            if row and row[0] == ticket_id:
                row_index = i + 1 # 1-based index for Sheets API
                break
        
        if row_index == -1:
            return {'success': False, 'error': "Ticket ID not found"}
            
        # 2. Update Columns based on what is provided
        data = []
        
        # We need to update potentially both Assignee (K) and Status (L)
        # If we update both, we can write a range K:L
        # If we update one, we address that specific cell
        
        assignee = updates.get('assignee')
        status = updates.get('status')
        description = updates.get('description')
        attachment = updates.get('attachment')
        
        if assignee is not None:
             # Update Assignee (Column K)
            range_name = f'Sheet1!K{row_index}'
            body = {'values': [[assignee]]}
            service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=range_name,
                valueInputOption='USER_ENTERED',
                body=body
            ).execute()
            
        if status is not None:
            # Update Status (Column L)
            range_name = f'Sheet1!L{row_index}'
            body = {'values': [[status]]}
            service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=range_name,
                valueInputOption='USER_ENTERED',
                body=body
            ).execute()

        if description is not None:
            # Update Description (Column I) - Index 8 -> I
            range_name = f'Sheet1!I{row_index}'
            body = {'values': [[description]]}
            service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=range_name,
                valueInputOption='USER_ENTERED',
                body=body
            ).execute()

        if attachment is not None:
            # Update Attachment (Column J) - Index 9 -> J
            range_name = f'Sheet1!J{row_index}'
            body = {'values': [[attachment]]}
            service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=range_name,
                valueInputOption='USER_ENTERED',
                body=body
            ).execute()
        
        return {'success': True}
        
    except Exception as e:
        return {'success': False, 'error': str(e)}

def update_approval_status(ticket_id, role, status, comments=""):
    """
    Updates the approval status for HR or Manager.
    role: "HR" or "Manager"
    status: "Approved" or "Rejected"
    """
    creds = None
    if os.path.exists('ticket-raise-test-568fbe873bcd.json'):
        try:
            creds = Credentials.from_service_account_file('ticket-raise-test-568fbe873bcd.json', scopes=SCOPES)
        except Exception as e:
            return {'success': False, 'error': f"Error loading credentials: {e}"}
    else:
        return {'success': False, 'error': "ticket-raise-test-568fbe873bcd.json not found"}

    try:
        service = build('sheets', 'v4', credentials=creds)
        
        # 1. Find row index
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='Sheet1!B:B'
        ).execute()
        
        rows = result.get('values', [])
        row_index = -1
        for i, row in enumerate(rows):
            if row and row[0] == ticket_id:
                row_index = i + 1
                break
        
        if row_index == -1:
            return {'success': False, 'error': "Ticket ID not found"}

        # 2. Determine Column based on Role
        # N = HR Status, O = Manager Status, P = Comments (Append to existing?)
        
        range_name = ""
        if role == "HR":
            range_name = f'Sheet1!N{row_index}'
        elif role == "Manager":
            range_name = f'Sheet1!O{row_index}'
        elif role == "Admin":
            pass # No status column for Admin, just comments
        else:
             return {'success': False, 'error': "Invalid Role"}

        # Update Status (if not Admin)
        if range_name:
            body = {'values': [[status]]}
            service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=range_name,
                valueInputOption='USER_ENTERED',
                body=body
            ).execute()

        # Update Comments (Column P) - Optional
        if comments:
            comment_range = f'Sheet1!P{row_index}'
            # We might want to append to existing comments if any
            # For now, let's just write "Role: Comment"
            formatted_comment = f"{role}: {comments}"
            
            # Read existing
            curr_comment_res = service.spreadsheets().values().get(
                spreadsheetId=SPREADSHEET_ID,
                range=comment_range
            ).execute()
            curr_val = curr_comment_res.get('values', [[]])[0]
            existing_comment = curr_val[0] if curr_val else ""
            
            if existing_comment:
                formatted_comment = existing_comment + " | " + formatted_comment
            
            service.spreadsheets().values().update(
                spreadsheetId=SPREADSHEET_ID,
                range=comment_range,
                valueInputOption='USER_ENTERED',
                body={'values': [[formatted_comment]]}
            ).execute()

        return {'success': True}

    except Exception as e:
        return {'success': False, 'error': str(e)}

def delete_ticket(ticket_id):
    """
    Deletes a ticket from the Google Sheet.
    """
    creds = None
    if os.path.exists('ticket-raise-test-568fbe873bcd.json'):
        try:
            creds = Credentials.from_service_account_file('ticket-raise-test-568fbe873bcd.json', scopes=SCOPES)
        except Exception as e:
            return {'success': False, 'error': f"Error loading credentials: {e}"}
    else:
        return {'success': False, 'error': "ticket-raise-test-568fbe873bcd.json not found"}

    try:
        service = build('sheets', 'v4', credentials=creds)
        
        # 1. Find the row index for the ticket_id
        result = service.spreadsheets().values().get(
            spreadsheetId=SPREADSHEET_ID,
            range='Sheet1!B:B'
        ).execute()
        
        rows = result.get('values', [])
        row_index = -1
        
        for i, row in enumerate(rows):
            if row and row[0] == ticket_id:
                row_index = i # 0-based index for `deleteDimension` which uses startIndex
                break
        
        if row_index == -1:
            return {'success': False, 'error': "Ticket ID not found"}

        # 2. Delete the row
        batch_update_request = {
            "requests": [
                {
                    "deleteDimension": {
                        "range": {
                            "sheetId": 0, # Assuming Sheet1 has sheetId 0. If not, we need to fetch it.
                            "dimension": "ROWS",
                            "startIndex": row_index,
                            "endIndex": row_index + 1
                        }
                    }
                }
            ]
        }

        service.spreadsheets().batchUpdate(
            spreadsheetId=SPREADSHEET_ID,
            body=batch_update_request
        ).execute()

        return {'success': True}

    except Exception as e:
        return {'success': False, 'error': str(e)}
