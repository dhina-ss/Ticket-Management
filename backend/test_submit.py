import requests

data = {
    "fullName": "Test User",
    "mobile": "+91 98765 43210",
    "category": "System issue",
    "subCategory": "",
    "mode": "Remote",
    "department": "Admin & IT",
    "description": "Testing the submit endpoint",
}

resp = requests.post("http://localhost:5000/api/submit", data=data)
print("Status:", resp.status_code)
print("Response:", resp.text)
