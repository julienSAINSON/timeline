import { expect, test } from "@playwright/test";

async function startSandbox(page) {
  await page.route("**/src/config.js", (route) => route.fulfill({
    contentType: "application/javascript",
    body: "window.TIMELINE_CONFIG = {};",
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "Continuer en bac a sable" }).click();
  await expect(page.locator("#timeline-canvas")).toBeVisible();
}

test("affiche la frise de demonstration dans un bac a sable isole", async ({ page }) => {
  await startSandbox(page);
  await expect(page.getByRole("heading", { name: "Roadmap Produit 2026" })).toBeVisible();
  await expect(page.locator(".element-row")).toHaveCount(14);
  await expect(page.getByRole("button", { name: "Sauvegarder", exact: true })).toBeDisabled();
});

test("cree une periode, la sauvegarde puis la retrouve apres rechargement", async ({ page }) => {
  await startSandbox(page);
  const canvas = page.locator("#timeline-canvas");
  await canvas.click({ button: "right", position: { x: 300, y: 300 } });
  await page.getByRole("button", { name: "Ajouter une periode" }).click();
  await page.locator('input[name="label"]').fill("Periode de regression");
  await page.locator('input[name="start_date"]').fill("2026-09-01");
  await page.locator('input[name="end_date"]').fill("2026-09-05");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText("Periode de regression", { exact: true })).toHaveCount(2);
  await page.getByRole("button", { name: "Sauvegarder", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sauvegarder", exact: true })).toBeDisabled();
  await page.reload();
  await expect(page.getByText("Periode de regression", { exact: true })).toHaveCount(2);
});

test("respecte les bornes de zoom et conserve un affichage utilisable", async ({ page }) => {
  await startSandbox(page);
  const zoomOut = page.getByRole("button", { name: "Dezoomer" });
  await zoomOut.click();
  await expect(page.locator(".zoom-readout")).toHaveText("3px/j");
  const zoomIn = page.getByRole("button", { name: "Zoomer" });
  await zoomIn.click();
  await expect(page.locator(".zoom-readout")).toHaveText("5px/j");
  await expect(page.locator("#timeline-canvas")).toBeVisible();
});