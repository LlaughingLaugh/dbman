import { test, expect, Page } from '@playwright/test';

const E2E_DATA_VIEW_DB_NAME = 'e2e-data-view.db';
const E2E_DATA_VIEW_TABLE_NAME = 'e2e_users_for_data_view';

// Helper to connect to a DB and navigate to its table management page
async function navigateToTableManagement(page: Page, dbName: string) {
  await page.goto('/dashboard/databases');
  const dbCardTitle = page.getByRole('heading', { name: dbName, exact: true });
  if (!(await dbCardTitle.isVisible({timeout: 5000}))) { // Short timeout to check visibility
    await page.getByLabel('Database File Name').fill(dbName);
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(dbCardTitle.locator('ancestor::article')).toBeVisible();
  }
  await page.getByRole('link', { name: dbName }).click();
  await expect(page.getByRole('heading', { name: `Table Management for ${dbName}` })).toBeVisible();
}

// Helper to ensure a specific table exists, creating it if necessary
async function ensureTableExists(page: Page, tableName: string) {
  const tableCell = page.getByRole('cell', { name: tableName, exact: true });
  if (!(await tableCell.isVisible({timeout: 2000}))) {
    await page.getByRole('button', { name: 'Create New Table' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create New Table' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Table Name').fill(tableName);

    // Column 1: id (PK)
    const column1 = dialog.locator('.space-y-3 > div').nth(0);
    await column1.getByPlaceholder('Column Name').fill('id');
    await column1.getByRole('combobox').click();
    await page.getByRole('option', { name: 'INTEGER' }).click();
    await column1.getByLabel('Primary Key').check();
    await column1.getByLabel('Not Null').check();

    // Column 2: name
    await dialog.getByRole('button', { name: 'Add Column' }).click();
    const column2 = dialog.locator('.space-y-3 > div').nth(1);
    await column2.getByPlaceholder('Column Name').fill('name');
    await column2.getByRole('combobox').click();
    await page.getByRole('option', { name: 'TEXT' }).click();
    
    // Column 3: email
    await dialog.getByRole('button', { name: 'Add Column' }).click();
    const column3 = dialog.locator('.space-y-3 > div').nth(2);
    await column3.getByPlaceholder('Column Name').fill('email');
    await column3.getByRole('combobox').click();
    await page.getByRole('option', { name: 'TEXT' }).click();


    await dialog.getByRole('button', { name: 'Create Table' }).click();
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(tableCell).toBeVisible();
  }
   // Navigate into the data view for this table
  await page.getByRole('link', { name: tableName, exact: true }).click(); // Assumes table name cell becomes a link
  await expect(page.getByRole('heading', { name: `Table: ${tableName}`})).toBeVisible();
}


test.describe('Table Data View', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToTableManagement(page, E2E_DATA_VIEW_DB_NAME);
    await ensureTableExists(page, E2E_DATA_VIEW_TABLE_NAME);
    // Now we are on the data view page for E2E_DATA_VIEW_TABLE_NAME
  });

  test('should display table headers and allow adding a new row', async ({ page }) => {
    // Verify table headers (id, name, email)
    await expect(page.getByRole('columnheader', { name: 'id' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'name' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'email' })).toBeVisible();

    // Add a new row
    await page.getByRole('button', { name: 'Add Row' }).click();
    const addDialog = page.getByRole('dialog', { name: `Add New Row to ${E2E_DATA_VIEW_TABLE_NAME}` });
    await expect(addDialog).toBeVisible();

    // 'id' might be auto-increment or user-provided. If schema has it as PK INTEGER, often auto.
    // For this test, let's assume 'id' is auto-incremented and we don't fill it.
    // Or, if the form requires all fields, we need to fill 'id' too.
    // The current "Add Row" dialog in the app creates inputs for all schema columns.
    await addDialog.locator('input#new-col-id').fill('1'); // Assuming id is needed
    await addDialog.locator('input#new-col-name').fill('John Doe');
    await addDialog.locator('input#new-col-email').fill('john.doe@example.com');
    
    await addDialog.getByRole('button', { name: 'Add Row' }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });

    // Verify the new row appears in the table
    const newRow = page.getByRole('row').filter({ hasText: 'John Doe' });
    await expect(newRow.getByRole('cell', { name: '1', exact: true })).toBeVisible(); // Check cell with 'id'
    await expect(newRow.getByRole('cell', { name: 'john.doe@example.com' })).toBeVisible();
  });

  test('should allow editing a row', async ({ page }) => {
    // Add a row to edit first
    await page.getByRole('button', { name: 'Add Row' }).click();
    const addDialog = page.getByRole('dialog', { name: `Add New Row to ${E2E_DATA_VIEW_TABLE_NAME}` });
    await addDialog.locator('input#new-col-id').fill('2');
    await addDialog.locator('input#new-col-name').fill('Jane Edit');
    await addDialog.locator('input#new-col-email').fill('jane.edit@example.com');
    await addDialog.getByRole('button', { name: 'Add Row' }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });
    
    const rowToEdit = page.getByRole('row').filter({ hasText: 'Jane Edit' });
    await expect(rowToEdit).toBeVisible();

    // Click Edit button for that row
    await rowToEdit.getByRole('button', { name: 'Edit' }).click();

    // Change a value (e.g., name)
    // The input will replace the text content. The input might not have a specific label within the cell.
    // We locate it by its current value or type if it's unique enough.
    await page.getByRole('cell').locator('input[value="Jane Edit"]').fill('Jane Updated');
    
    // Click Save
    await rowToEdit.getByRole('button', { name: 'Save' }).click();

    // Verify the updated value is displayed and inputs are gone
    await expect(page.getByRole('cell').locator('input[value="Jane Updated"]')).not.toBeVisible();
    await expect(rowToEdit.getByRole('cell', { name: 'Jane Updated' })).toBeVisible();
  });

  test('should allow deleting a row', async ({ page }) => {
    // Add a row to delete
    await page.getByRole('button', { name: 'Add Row' }).click();
    const addDialog = page.getByRole('dialog', { name: `Add New Row to ${E2E_DATA_VIEW_TABLE_NAME}` });
    await addDialog.locator('input#new-col-id').fill('3');
    await addDialog.locator('input#new-col-name').fill('User Delete');
    await addDialog.locator('input#new-col-email').fill('user.delete@example.com');
    await addDialog.getByRole('button', { name: 'Add Row' }).click();
    await expect(addDialog).not.toBeVisible({ timeout: 10000 });

    const rowToDelete = page.getByRole('row').filter({ hasText: 'User Delete' });
    await expect(rowToDelete).toBeVisible();

    // Click Delete button for that row
    await rowToDelete.getByRole('button', { name: 'Delete' }).click();

    // Confirm deletion in the alert dialog
    const alertDialog = page.getByRole('alertdialog');
    await expect(alertDialog).toBeVisible();
    await expect(alertDialog.getByText('This will permanently delete the selected row.')).toBeVisible();
    await alertDialog.getByRole('button', { name: 'Yes, delete row' }).click();
    await expect(alertDialog).not.toBeVisible({ timeout: 10000 });

    // Verify the row is removed
    await expect(rowToDelete).not.toBeVisible();
  });
  
  test('should support pagination for table data', async ({ page }) => {
    // This test requires populating more data than pageSize (default 10)
    // For simplicity, we'll add 12 rows (assuming id is unique PK)
    for (let i = 1; i <= 12; i++) {
        await page.getByRole('button', { name: 'Add Row' }).click();
        const addDialog = page.getByRole('dialog', { name: `Add New Row to ${E2E_DATA_VIEW_TABLE_NAME}` });
        await addDialog.locator('input#new-col-id').fill(String(100 + i)); // Unique IDs
        await addDialog.locator('input#new-col-name').fill(`User ${i}`);
        await addDialog.locator('input#new-col-email').fill(`user${i}@example.com`);
        await addDialog.getByRole('button', { name: 'Add Row' }).click();
        await expect(addDialog).not.toBeVisible({ timeout: 10000 });
    }

    // Verify total rows displayed if available (e.g., "Displaying 10 of 12 rows")
    await expect(page.getByText('Displaying 10 of 12 rows.')).toBeVisible();
    
    // Verify we see User 1 to User 10 (or User 101 to User 110 if using those IDs)
    await expect(page.getByRole('cell', { name: 'User 1', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'User 10', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'User 11', exact: true })).not.toBeVisible();

    // Click Next page
    await page.getByRole('button', { name: 'Go to next page' }).click();
    
    // Verify total rows displayed
    await expect(page.getByText('Displaying 2 of 12 rows.')).toBeVisible();

    // Verify we see User 11 and User 12
    await expect(page.getByRole('cell', { name: 'User 1', exact: true })).not.toBeVisible();
    await expect(page.getByRole('cell', { name: 'User 11', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'User 12', exact: true })).toBeVisible();

    // Click Previous page
    await page.getByRole('button', { name: 'Go to previous page' }).click();
    await expect(page.getByText('Displaying 10 of 12 rows.')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'User 1', exact: true })).toBeVisible();
  });

});
