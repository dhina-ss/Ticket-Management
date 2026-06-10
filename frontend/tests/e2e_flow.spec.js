import { test, expect } from '@playwright/test';

test.describe('Ticket Lifecycle E2E', () => {
    // Shared state between tests (simulating a full flow)
    let ticketId = '';

    test('Step 1: Create a new ticket', async ({ page }) => {
        await page.goto('http://localhost:5173/');

        // Handle Branch Popup (using more specific selectors)
        const supportTypeSelect = page.locator('div.fixed select').first();
        await supportTypeSelect.waitFor({ state: 'visible' });
        await supportTypeSelect.selectOption('IT Support');

        const branchSelect = page.locator('div.fixed select').nth(1);
        await branchSelect.selectOption('Cotton Concepts HO, Coimbatore');
        
        await page.click('button:has-text("Next")');

        // Fill out the form
        await page.waitForSelector('input#fullName', { state: 'visible' });
        await page.fill('input#fullName', 'E2E Test User');
        await page.fill('input#email', 'e2e@example.com');
        await page.fill('input#mobile', '9876543210');

        // Wait for categories and departments to load (attached is enough for options)
        const categorySelect = page.locator('select#category');
        await expect(categorySelect.locator('option').nth(1)).toBeAttached({ timeout: 10000 });
        await categorySelect.selectOption('Software issue');
        
        const departmentSelect = page.locator('select#department');
        await expect(departmentSelect.locator('option').nth(1)).toBeAttached({ timeout: 10000 });
        await departmentSelect.selectOption('Admin & IT');
        
        // Select Mode (Required for software issues)
        await page.selectOption('select#mode', 'Remote');
        
        await page.fill('textarea#description', 'This is a test ticket created by Playwright E2E suite.');

        // Scroll to submit button and click
        const submitBtn = page.locator('button:has-text("Submit Ticket")');
        await submitBtn.scrollIntoViewIfNeeded();
        await submitBtn.click();

        // Wait for success message/modal and Ticket ID
        // The ticket ID is in a span with tracking-widest inside the success modal
        const ticketIdContainer = page.locator('div.fixed span.tracking-widest').first();
        await expect(ticketIdContainer).toBeVisible({ timeout: 20000 });
        
        ticketId = (await ticketIdContainer.innerText()).trim();
        console.log(`Captured Ticket ID: ${ticketId}`);
        expect(ticketId).toBeTruthy();
        expect(ticketId).toMatch(/[A-Z]{3,5}\d+[A-Z]*/);
    });

    test('Step 2: Check ticket status (Initial)', async ({ page }) => {
        await page.goto(`http://localhost:5173/status?ticketId=${ticketId}`);

        // Verify status is "Not Started"
        await expect(page.locator('text=Not Started')).toBeVisible();
        await expect(page.locator('text=E2E Test User')).toBeVisible();
    });

    test('Step 3: Admin login and ticket completion', async ({ page }) => {
        await page.goto('http://localhost:5173/admin');

        // Login (using provided credentials)
        await page.fill('input[type="email"]', 'admin@support.com');
        await page.fill('input[type="password"]', '123456');
        await page.click('button:has-text("Sign In")');

        // Wait for dashboard to load (look for the "All Tickets" button in sidebar)
        await expect(page.locator('button:has-text("All Tickets")')).toBeVisible({ timeout: 15000 });

        // Find the ticket in the table and click it (using id for uniqueness)
        const ticketRow = page.locator(`tr:has-text("${ticketId}")`).first();
        await expect(ticketRow).toBeVisible({ timeout: 10000 });
        await ticketRow.click();

        // Wait for detail panel to appear
        await page.waitForSelector('textarea[placeholder*="final comments"]', { state: 'attached', timeout: 5000 }).catch(() => {});

        // Update status to Completed first to reveal resolution comments textarea
        await page.locator('label:text-is("Status") + div select').selectOption('Completed');
        
        // Update assignee (using option text to disambiguate from header filter)
        await page.locator('select').filter({ has: page.locator('option:text-is("Assignee")') }).selectOption('Ruban');
        
        // Add resolution comments
        await page.fill('textarea[placeholder*="final comments"]', 'Issue resolved by E2E test script.');
        
        // Save changes (the button with the "check" icon)
        await page.click('button:has(span.material-symbols-outlined:text("check"))');
        
        // Success notification (toast)
        await expect(page.locator('text=Ticket updated successfully')).toBeVisible();
    });

    test('Step 4: Verify status update on Check Status page', async ({ page }) => {
        await page.goto(`http://localhost:5173/status?ticketId=${ticketId}`);

        // Verify status is now "Completed"
        await expect(page.locator('text=Completed')).toBeVisible();
        await expect(page.locator('text=Issue resolved by E2E test script.')).toBeVisible();
    });

    test('Step 5: Verify email notification content', async ({ request }) => {
        // Fetch the last sent email from the backend test endpoint
        const response = await request.get('http://127.0.0.1:443/api/test/last-email');
        expect(response.ok()).toBeTruthy();
        
        const emailData = await response.json();
        console.log('Last sent email:', emailData);
        
        // Verify email details
        expect(emailData.to).toContain('e2e@example.com');
        expect(emailData.subject).toContain('Resolved');
        expect(emailData.subject).toContain(ticketId);
        expect(emailData.body).toContain('Issue resolved by E2E test script.');
        expect(emailData.body).toContain('Ruban');
    });
});
 
test.describe('Named Approvals and Management Status', () => {
    let ticketId = '';
 
    test('Step 1: Create a Material Request ticket', async ({ page }) => {
        await page.goto('http://localhost:5173/');
 
        // Handle Branch Popup
        const supportTypeSelect = page.locator('div.fixed select').first();
        await supportTypeSelect.waitFor({ state: 'visible' });
        await supportTypeSelect.selectOption('IT Support');
        const branchSelect = page.locator('div.fixed select').nth(1);
        await branchSelect.selectOption('Cotton Concepts HO, Coimbatore');
        await page.click('button:has-text("Next")');
 
        // Fill form with Category that requires approvals
        await page.waitForSelector('input#fullName', { state: 'visible' });
        await page.fill('input#fullName', 'Named Approval Test');
        await page.fill('input#email', 'named-test@example.com');
        await page.fill('input#mobile', '1122334455');
 
        const categorySelect = page.locator('select#category');
        await expect(categorySelect.locator('option').nth(1)).toBeAttached();
        await categorySelect.selectOption('Hardware/Assets'); // Requires approvals
 
        const departmentSelect = page.locator('select#department');
        await expect(departmentSelect.locator('option').nth(1)).toBeAttached();
        await departmentSelect.selectOption('Admin & IT');
 
        await page.fill('textarea#description', 'Named approval verification ticket.');
        await page.click('button:has-text("Submit Ticket")');
 
        const ticketIdContainer = page.locator('div.fixed span.tracking-widest').first();
        await expect(ticketIdContainer).toBeVisible({ timeout: 10000 });
        ticketId = (await ticketIdContainer.innerText()).trim();
        console.log(`Named Approval Ticket ID: ${ticketId}`);
    });
 
    test('Step 2: Approve as Manager via API and Verify UI', async ({ page, request }) => {
        // Approve via API
        const response = await request.post(`http://127.0.0.1:443/api/approval/action/${ticketId}/Admin-Manager`, {
            form: {
                action: 'Approve',
                comments: 'Looks good to me',
                receiver_name: 'Balaji Manager'
            }
        });
        expect(response.ok()).toBeTruthy();
 
        // Go to status page
        await page.goto(`http://localhost:5173/status?ticketId=${ticketId}`);
 
        // Verify named status is visible
        await expect(page.locator('text=Balaji Manager: Approved')).toBeVisible();
    });
 
    test('Step 3: Approve as Management (Multiple) via API and Verify UI', async ({ page, request }) => {
        // Management 1
        await request.post(`http://127.0.0.1:443/api/approval/action/${ticketId}/Management`, {
            form: { action: 'Approve', comments: 'Approve 1', receiver_name: 'Annie' }
        });
 
        // Management 2
        await request.post(`http://127.0.0.1:443/api/approval/action/${ticketId}/Management`, {
            form: { action: 'Approve', comments: 'Approve 2', receiver_name: 'Vanjinathan' }
        });
 
        // Go to status page
        await page.goto(`http://localhost:5173/status?ticketId=${ticketId}`);
 
        // Verify appended named status
        await expect(page.locator('text=Annie: Approved, Vanjinathan: Approved')).toBeVisible();
    });
});
