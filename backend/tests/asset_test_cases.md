# Asset Process Test Case Specification

This document details the test scenarios, test inputs, expected outcomes, and automated test cases covering the entire Asset Management process.

---

## 1. Automated Unit/Integration Test Cases (`tests/test_assets.py`)

We have created an automated test suite containing 9 test cases verifying the backend API endpoints. All tests run on top of a Flask test client with database layer mocking.

| Test Case ID | API Endpoint & Method | Purpose / Description | Expected Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **TC_AST_001** | `GET /api/assets` | Retrieve all registered assets | Returns `200 OK` with JSON array of assets. | **Passed** |
| **TC_AST_002** | `POST /api/assets` | Create a new asset with auto-generating `assetId` prefix mapping (e.g. `LPT` for Laptop) | Returns `201 Created` with `success: true` and the new `assetId`. | **Passed** |
| **TC_AST_003** | `GET /api/assets/<asset_id>` | Fetch specific asset by its alphanumeric code (e.g., `LPT260001`) | Returns `200 OK` with asset details. | **Passed** |
| **TC_AST_004** | `GET /api/assets/<asset_id>` | Fetch non-existent asset | Returns `404 Not Found` with an error message. | **Passed** |
| **TC_AST_005** | `PUT /api/assets/<int:id>` | Update details of an existing asset | Returns `200 OK` with confirmation message. | **Passed** |
| **TC_AST_006** | `PUT /api/assets/<int:id>` | Update details of a non-existent asset | Returns `404 Not Found` with an error. | **Passed** |
| **TC_AST_007** | `DELETE /api/assets/<int:id>` | Remove an asset by internal database primary key | Returns `200 OK` with confirmation message. | **Passed** |
| **TC_AST_008** | `DELETE /api/assets/<int:id>` | Delete a non-existent asset | Returns `404 Not Found` with an error. | **Passed** |
| **TC_AST_009** | `GET /api/assets/<asset_id>/qr` | Generate a beautiful PIL-drawn printable QR code label sheet | Returns `200 OK` with content-type `image/png`. | **Passed** |

---

## 2. Manual Test Cases (Frontend UI Flows)

These test cases cover the manual verification of frontend workflows in mobile and desktop viewports.

### Scenario A: Guest User QR Scan on Mobile Viewport
- **Objective**: Verify that unauthenticated mobile users scanning the QR code can only view read-only asset details without being redirected to edit or login.
- **Steps**:
  1. Open a mobile browser in incognito mode (or clear cookies to simulate guest status).
  2. Navigate directly to `/asset/LPT260001` (representing the URL scanned from a physical QR tag).
  3. Verify that the **Asset Information** page renders correctly.
  4. Ensure that the **Edit Details** button is **NOT** visible.
  5. Verify that only the read-only specifications and the **Home** button are displayed.
  6. Manually append `?edit=true` to the browser address bar (e.g. `/asset/LPT260001?edit=true`) and press Enter.
  7. Verify that the query parameter `?edit=true` is quietly stripped from the URL by the browser history state.
  8. Verify that the user remains on the read-only page and no edit modal or redirect to `/login` occurs.

### Scenario B: Authenticated User QR Scan
- **Objective**: Verify that logged-in users scanning the QR code are allowed to view and update details.
- **Steps**:
  1. Log into the application as an admin.
  2. In mobile or desktop view, navigate to `/asset/LPT260001` with `?edit=true` (or scan from the dashboard).
  3. Verify that the edit details modal opens automatically.
  4. Edit a field (e.g. brand, assignee) and click **Save Changes**.
  5. Verify the updated information is saved and reflected on the page.
