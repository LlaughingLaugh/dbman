import { test, expect, Page } from '@playwright/test';

const E2E_DB_NAME = 'e2e-main-test.db';
const E2E_ANOTHER_DB_NAME = 'e2e-another-test.db'; // For testing multiple connections

// Helper function to connect to a database
async function connectToDb(page: Page, dbName: string) {
  await page.getByLabel('Database File Name').fill(dbName);
  await page.getByRole('button', { name: 'Connect' }).click();
}

// Helper function to disconnect from a database
async function disconnectFromDb(page: Page, dbName: string) {
  // Assuming the card is identifiable by the dbName within its title or content
  const dbCard = page.getByRole('heading', { name: dbName, exact: true }).locator('ancestor::article'); // Shadcn Card is <article>
  await dbCard.getByRole('button', { name: 'Disconnect' }).click();
}

test.describe('Database Management View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/databases');
    // Clean up any existing connections from previous runs if possible, by disconnecting all visible.
    // This makes tests more independent.
    const connectedDbCards = await page.getByRole('button', { name: 'Disconnect' }).all();
    for (const button of connectedDbCards) {
      await button.click();
    }
     // Also, ensure the input field is clear.
    await page.getByLabel('Database File Name').clear();
  });
  
  // Clean up database files created by tests in the data/ directory
  // This is tricky from Playwright side as it doesn't have direct fs access to the server.
  // Normally, this would be an API call or a separate script.
  // For this subtask, we'll acknowledge this limitation and tests will try to use unique names
  // or expect files to be potentially there from previous runs.
  // A more robust solution would involve a server-side cleanup mechanism callable by tests.

  test('should allow connecting to a new database and display it', async ({ page }) => {
    await connectToDb(page, E2E_DB_NAME);

    // Verify the database card appears
    const dbCard = page.getByRole('heading', { name: E2E_DB_NAME, exact: true }).locator('ancestor::article');
    await expect(dbCard).toBeVisible();
    
    // Check for "Tables:" heading within the card, indicating successful connection and info display
    // (even if no tables, the heading should be there)
    await expect(dbCard.getByRole('heading', { name: 'Tables:' })).toBeVisible();
    // Check for "No tables found" if it's a new DB
    await expect(dbCard.getByText('No tables found.')).toBeVisible();
  });

  test('should display an error if connecting to an empty database name', async ({ page }) => {
    await page.getByRole('button', { name: 'Connect' }).click(); // Click connect with empty input
    await expect(page.getByText('Please enter a database file name.')).toBeVisible();
  });

  test('should allow connecting to multiple databases', async ({ page }) => {
    await connectToDb(page, E2E_DB_NAME);
    await expect(page.getByRole('heading', { name: E2E_DB_NAME, exact: true }).locator('ancestor::article')).toBeVisible();

    await connectToDb(page, E2E_ANOTHER_DB_NAME);
    await expect(page.getByRole('heading', { name: E2E_ANOTHER_DB_NAME, exact: true }).locator('ancestor::article')).toBeVisible();

    // Ensure both are still listed
    await expect(page.getByRole('heading', { name: E2E_DB_NAME, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: E2E_ANOTHER_DB_NAME, exact: true })).toBeVisible();
  });
  
  test('should not allow connecting to the same database path twice in the list', async ({ page }) => {
    await connectToDb(page, E2E_DB_NAME);
    await expect(page.getByRole('heading', { name: E2E_DB_NAME, exact: true }).locator('ancestor::article')).toBeVisible();

    // Attempt to connect again to the same DB
    await connectToDb(page, E2E_DB_NAME);
    
    // Check for the error message
    await expect(page.getByText(`Database '${E2E_DB_NAME}' is already in the list.`)).toBeVisible();
    
    // Ensure only one card for this DB name exists
    const dbCards = await page.getByRole('heading', { name: E2E_DB_NAME, exact: true }).all();
    expect(dbCards.length).toBe(1);
  });


  test('should allow disconnecting a database', async ({ page }) => {
    await connectToDb(page, E2E_DB_NAME);
    const dbCard = page.getByRole('heading', { name: E2E_DB_NAME, exact: true }).locator('ancestor::article');
    await expect(dbCard).toBeVisible();

    await disconnectFromDb(page, E2E_DB_NAME);

    // Verify the database card is removed
    await expect(dbCard).not.toBeVisible();
  });
  
  test('should allow disconnecting one of multiple databases', async ({ page }) => {
    await connectToDb(page, E2E_DB_NAME);
    await connectToDb(page, E2E_ANOTHER_DB_NAME);

    const dbCard1 = page.getByRole('heading', { name: E2E_DB_NAME, exact: true }).locator('ancestor::article');
    const dbCard2 = page.getByRole('heading', { name: E2E_ANOTHER_DB_NAME, exact: true }).locator('ancestor::article');
    await expect(dbCard1).toBeVisible();
    await expect(dbCard2).toBeVisible();

    await disconnectFromDb(page, E2E_DB_NAME);

    await expect(dbCard1).not.toBeVisible();
    await expect(dbCard2).toBeVisible(); // The other DB should remain
  });

});
