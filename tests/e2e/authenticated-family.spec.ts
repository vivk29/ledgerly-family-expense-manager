import { test, expect } from '@playwright/test';

const emailA = process.env.LEDGERLY_E2E_USER_A_EMAIL;
const passwordA = process.env.LEDGERLY_E2E_USER_A_PASSWORD;
const emailB = process.env.LEDGERLY_E2E_USER_B_EMAIL;
const passwordB = process.env.LEDGERLY_E2E_USER_B_PASSWORD;
const joinPin = process.env.LEDGERLY_E2E_FAMILY_PIN;

test.skip(
  !emailA || !passwordA || !emailB || !passwordB || !joinPin,
  'Configure the two E2E users and family PIN in CI secrets.'
);

test('two-user family creation and join flow', async ({ browser }) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  await pageA.goto('/');
  await pageA.getByLabel('Email').fill(emailA!);
  await pageA.getByLabel('Password').fill(passwordA!);
  await pageA.getByRole('button', { name: 'Sign in' }).click();
  await expect(pageA.getByRole('heading', { name: 'Choose your family' })).toBeVisible();

  const familyName = `E2E Family ${Date.now()}`;
  await pageA.getByRole('button', { name: 'Create family' }).click();
  await pageA.getByLabel('Family name').fill(familyName);
  await pageA.getByLabel('PIN').fill(joinPin!);
  await pageA.getByRole('button', { name: /Create family/i }).click();

  await expect(pageA.getByText(familyName)).toBeVisible();
  const codeCard = pageA.locator('.codeCard');
  const familyCode = (await codeCard.locator('strong').innerText()).trim();
  expect(familyCode).toMatch(/^[A-Z0-9]{8}$/);

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();

  await pageB.goto('/');
  await pageB.getByLabel('Email').fill(emailB!);
  await pageB.getByLabel('Password').fill(passwordB!);
  await pageB.getByRole('button', { name: 'Sign in' }).click();
  await expect(pageB.getByRole('heading', { name: 'Choose your family' })).toBeVisible();

  await pageB.getByRole('button', { name: 'Join family' }).click();
  await pageB.getByLabel('Family code').fill(familyCode);
  await pageB.getByLabel('PIN').fill(joinPin!);
  await pageB.getByLabel('Your name').fill('E2E Member');
  await pageB.getByRole('button', { name: /Join family/i }).click();

  await expect(pageB.getByText(familyName)).toBeVisible();

  await contextB.close();
  await contextA.close();
});
