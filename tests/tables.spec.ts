import { test, expect, Page } from '@playwright/test';

const E2E_TABLE_TEST_DB_NAME = 'e2e-tables-test.db'; // DB for these table tests
const TEST_TABLE_NAME = 'e2e_test_table_users';
const TEST_TABLE_NAME_TO_DELETE = 'e2e_test_table_to_delete';

// Helper to connect to a DB - assumes starting from /dashboard/databases
async function ensureDbConnected(page: Page, dbName: string) {
  await page.goto('/dashboard/databases');
  // Check if already connected by looking for the card title
  const dbCardTitle = page.getByRole('heading', { name: dbName, exact: true });
  if (!(await dbCardTitle.isVisible())) {
    await page.getByLabel('Database File Name').fill(dbName);
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(dbCardTitle.locator('ancestor::article')).toBeVisible();
  }
  // Navigate to the tables page for this DB
  await page.getByRole('link', { name: dbName }).click();
  await expect(page.getByRole('heading', { name: `Table Management for ${dbName}` })).toBeVisible();
}


test.describe('Table Management View', () => {
  // Create a unique DB for this test suite to avoid interference.
  // Cleanup (deleting this DB file) would ideally be done in a global teardown or manually.
  const currentTestDbName = `${E2E_TABLE_TEST_DB_NAME.split('.')[0]}-${Date.now()}.db`;

  test.beforeEach(async ({ page }) => {
    await ensureDbConnected(page, currentTestDbName);
  });
  
  // Test to create a new table
  test('should allow creating a new table', async ({ page }) => {
    await page.getByRole('button', { name: 'Create New Table' }).click();

    // Fill in table name
    const dialog = page.getByRole('dialog', { name: 'Create New Table' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Table Name').fill(TEST_TABLE_NAME);

    // Add columns
    // Column 1 (id)
    const column1 = dialog.locator('.space-y-3 > div').nth(0); // Assumes structure
    await column1.getByPlaceholder('Column Name').fill('id');
    await column1.getByRole('combobox').click(); // Open select for type
    await page.getByRole('option', { name: 'INTEGER' }).click();
    await column1.getByLabel('Primary Key').check();
    await column1.getByLabel('Not Null').check();

    // Add another column
    await dialog.getByRole('button', { name: 'Add Column' }).click();
    const column2 = dialog.locator('.space-y-3 > div').nth(1);
    await column2.getByPlaceholder('Column Name').fill('name');
    await column2.getByRole('combobox').click();
    await page.getByRole('option', { name: 'TEXT' }).click();
    // Not checking PK or Not Null for 'name'

    // Submit
    await dialog.getByRole('button', { name: 'Create Table' }).click();
    
    // Verify the dialog closes (or success message appears, then dialog closes)
    // For now, check if dialog is not visible
    await expect(dialog).not.toBeVisible({ timeout: 10000 }); // Increased timeout for server action

    // Verify the new table appears in the list
    await expect(page.getByRole('cell', { name: TEST_TABLE_NAME, exact: true })).toBeVisible();
  });

  // Test to delete a table
  test('should allow deleting a table', async ({ page }) => {
    // First, create a table to delete
    await page.getByRole('button', { name: 'Create New Table' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Create New Table' });
    await createDialog.getByLabel('Table Name').fill(TEST_TABLE_NAME_TO_DELETE);
    const col = createDialog.locator('.space-y-3 > div').nth(0);
    await col.getByPlaceholder('Column Name').fill('temp_id');
    await col.getByRole('combobox').click();
    await page.getByRole('option', { name: 'INTEGER' }).click();
    await createDialog.getByRole('button', { name: 'Create Table' }).click();
    await expect(createDialog).not.toBeVisible({ timeout: 10000 });
    const tableCell = page.getByRole('cell', { name: TEST_TABLE_NAME_TO_DELETE, exact: true });
    await expect(tableCell).toBeVisible();

    // Now, delete the table
    const rowToDelete = page.getByRole('row').filter({ hasText: TEST_TABLE_NAME_TO_DELETE });
    await rowToDelete.getByRole('button', { name: 'Delete' }).click();

    // Confirm deletion in the alert dialog
    const alertDialog = page.getByRole('alertdialog');
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog.getByText(`This will permanently delete the ${TEST_TABLE_NAME_TO_DELETE} table`)).toBeVisible();
    await alertDialog.getByRole('button', { name: 'Yes, delete table' }).click();
    
    await expect(alertDialog).not.toBeVisible({ timeout: 10000 });


    // Verify the table is removed from the list
    await expect(tableCell).not.toBeVisible();
  });
  
  test('should show error for invalid table name on create', async ({ page }) => {
    await page.getByRole('button', { name: 'Create New Table' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create New Table' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Table Name').fill('123 invalid name'); // Invalid name
    
    // Attempt to submit (or check if button is disabled, depending on form validation approach)
    // For this test, we'll assume server-side validation and check for error after submit.
    // Add a dummy column
    const column1 = dialog.locator('.space-y-3 > div').nth(0);
    await column1.getByPlaceholder('Column Name').fill('id');
    await column1.getByRole('combobox').click(); 
    await page.getByRole('option', { name: 'INTEGER' }).click();
    
    await dialog.getByRole('button', { name: 'Create Table' }).click();
    
    // Check for error message within the dialog or globally on the page
    // Assuming the error from server action is displayed near the form or in a global error area.
    // The `pageState.error` in the component should populate an error display.
    // Let's assume the error is displayed within the dialog or a known error display area.
    // For this component, error is shown below the form: <div role="alert"> <span class="block sm:inline">{pageState.error}</span> </div>
    // Or, if it's specific to the dialog, it might be inside.
    // The page component shows error in a div with role="alert" at the top level of the page content.
    await expect(page.locator('[role="alert"] .block.sm\\:inline')).toHaveText(/Invalid table name/);
    
    // Ensure dialog is still open
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click(); // Close dialog
  });
});
