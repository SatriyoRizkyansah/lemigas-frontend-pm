import { expect, type Locator, type Page, test } from "@playwright/test";

const fixtureNumber = "E2E-PL-POST-APPROVAL-001";
const backendUrl = "http://127.0.0.1:3001";
const today = "2024-01-15";
const documentFile = {
  name: "e2e-document.txt",
  mimeType: "text/plain",
  buffer: Buffer.from("LEMIGAS deterministic E2E lifecycle document\n"),
};

async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email atau username", exact: true }).fill("operator@lemigas.esdm.go.id");
  await page.getByRole("textbox", { name: "Kata sandi", exact: true }).fill("admin123");
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/)?$/);
}

async function openFixture(page: Page) {
  await page.goto("/dashboard/pengadaan");
  const row = page.getByRole("row").filter({ hasText: fixtureNumber });
  await expect(row).toBeVisible();
  await row.getByRole("link", { name: "Siklus" }).click();
  await expect(page.getByRole("heading", { name: "Siklus Pengadaan" })).toBeVisible();
}

function stageButton(page: Page, name: string) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page.getByRole("button", { name: new RegExp(`^Tahap \\d+ ${escapedName}(?: |$)`) });
}

async function selectStage(page: Page, name: string) {
  await stageButton(page, name).click();
  await expect(page.getByText("Tahap ini sedang berjalan")).toBeVisible();
}

async function openOperations(page: Page) {
  const summary = page.getByText("Operasi tahap", { exact: true });
  const details = summary.locator("xpath=ancestor::details");
  if ((await details.getAttribute("open")) === null) await summary.click();
}

async function choose(page: Page, dialog: Locator, label: string, option: string) {
  await dialog.getByLabel(label, { exact: false }).click();
  const optionLabel = option.replaceAll("_", " ");
  await page.getByRole("option", { name: new RegExp(`^${optionLabel}$`, "i") }).click();
}

async function save(dialog: Locator) {
  await dialog.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function openOperation(page: Page, title: string) {
  await openOperations(page);
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function createContract(page: Page, number: string, type: string) {
  const dialog = await openOperation(page, "Buat kontrak");
  await dialog.getByLabel("Nomor *").fill(number);
  await choose(page, dialog, "Jenis *", type);
  await choose(page, dialog, "Jenis harga *", "harga_tetap");
  await dialog.getByLabel("Tanggal tanda tangan").fill(today);
  await dialog.getByLabel("Mulai berlaku").fill(today);
  await save(dialog);
}

async function makeContractEffective(page: Page, number: string) {
  const dialog = await openOperation(page, "Ubah status kontrak");
  await choose(page, dialog, "Catatan *", number);
  await choose(page, dialog, "Status *", "efektif");
  await dialog.getByLabel("Tanggal tanda tangan").fill(today);
  await dialog.getByLabel("Mulai berlaku").fill(today);
  await save(dialog);
}

async function uploadRequirement(page: Page, type: string, shipment?: string) {
  const summary = page.locator("summary").filter({ hasText: "Persyaratan dan berkas terkait" });
  const details = summary.locator("xpath=ancestor::details");
  if ((await details.getAttribute("open")) === null) await summary.click();
  const row = details.getByRole("row").filter({ hasText: type }).filter({ hasText: "Wajib" });
  await row.getByRole("button", { name: "Unggah dokumen", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Unggah dokumen tahap" });
  await dialog.getByLabel("Nama dokumen *").fill(`E2E ${type}`);
  await dialog.getByLabel("Pilih file dokumen").setInputFiles(documentFile);
  if (shipment) await dialog.getByLabel("Pengiriman (opsional)").selectOption({ label: shipment });
  await save(dialog);
  await expect(row).toContainText("Terpenuhi");
}

async function completeStage(page: Page, nextStage?: string) {
  await expect(page.getByText("Semua prasyarat tahap terpenuhi. Tahap siap diselesaikan.")).toBeVisible();
  await page.getByRole("button", { name: "Tandai tahap selesai" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Selesaikan tahap" });
  await dialog.getByRole("button", { name: /^Selesaikan(?: tahap)?$/ }).click();
  await expect(dialog).toBeHidden();
  if (nextStage) {
    await expect(await stageButton(page, nextStage)).toContainText("Sedang berjalan");
  }
}

async function chooseRelation(page: Page, dialog: Locator, label: string, optionText: string) {
  await dialog.getByLabel(label, { exact: true }).click();
  await page.getByRole("option").filter({ hasText: optionText }).click();
}

test.describe.serial("direct purchase post-approval lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await openFixture(page);
  });

  test("shows backend contract blockers before completion", async ({ page }) => {
    await selectStage(page, "Kontrak");
    await expect(page.getByText("Prasyarat tahap belum lengkap:")).toBeVisible();
    await page.getByRole("button", { name: "Tandai tahap selesai" }).click();
    await expect(page.getByRole("dialog", { name: "Selesaikan tahap" })).toBeHidden();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: /kontrak penyedia.*efektif/i })
        .last(),
    ).toBeVisible();
  });

  test("completes contract, delivery, settlement, and final closure", async ({ page, request }) => {
    test.setTimeout(180_000);

    const suffix = Date.now().toString();
    const providerContract = `E2E-KONTRAK-${suffix}`;
    const bol = `E2E-BOL-${suffix}`;
    const invoice = `E2E-INV-${suffix}`;
    const payment = `E2E-PAY-${suffix}`;

    await selectStage(page, "Kontrak");
    await createContract(page, providerContract, "penyedia");
    await makeContractEffective(page, providerContract);
    await uploadRequirement(page, "kontrak_penyedia");
    await completeStage(page, "Delivery");

    await selectStage(page, "Delivery");
    let dialog = await openOperation(page, "Catat pengiriman");
    await chooseRelation(page, dialog, "Kontrak", providerContract);
    await dialog.getByLabel("Nama kapal").fill("E2E Vessel");
    await dialog.getByLabel("Nomor bill of lading").fill(bol);
    await dialog.getByLabel("ETD").fill(today);
    await dialog.getByLabel("ETA").fill("2024-01-16");
    await dialog.getByLabel("Volume kontrak").fill("100");
    await save(dialog);

    dialog = await openOperation(page, "Catat pemeriksaan");
    await chooseRelation(page, dialog, "Pengiriman *", "E2E");
    await dialog.getByLabel("Tipe (quantity, quality, gabungan) *").fill("gabungan");
    await dialog.getByLabel("Tanggal periksa *").fill("2024-01-16");
    await dialog.getByLabel("Hasil kuantitas").fill("100");
    await save(dialog);

    dialog = await openOperation(page, "Catat penerimaan / BAST");
    await chooseRelation(page, dialog, "Pengiriman *", "E2E");
    await dialog.getByLabel("Tanggal terima *").fill("2024-01-16");
    await dialog.getByLabel("Titik serah *").fill("Terminal E2E");
    await dialog.getByLabel("Nomor BAST").fill(`E2E-BAST-${suffix}`);
    await dialog.getByLabel("Kuantitas diterima").fill("100");
    await save(dialog);

    for (const type of ["bill_of_lading", "asuransi", "kepabeanan", "sertifikat_mutu_kuantitas", "bast"]) {
      await uploadRequirement(page, type, bol);
    }
    await completeStage(page, "Settlement");

    await selectStage(page, "Settlement");
    dialog = await openOperation(page, "Catat tagihan");
    await dialog.getByLabel("Nomor *").fill(invoice);
    await dialog.getByLabel("Pihak *").fill("PT Pertamina EP");
    await choose(page, dialog, "Arah *", "keluar");
    await dialog.getByLabel("Nilai *").fill("1000");
    await chooseRelation(page, dialog, "Kontrak", providerContract);
    await dialog.getByLabel("Mata uang").fill("USD");
    await save(dialog);

    dialog = await openOperation(page, "Ubah status / tanggal tagihan");
    await chooseRelation(page, dialog, "Catatan *", invoice);
    await choose(page, dialog, "Status *", "diterbitkan");
    await save(dialog);

    dialog = await openOperation(page, "Catat pembayaran");
    await dialog.getByLabel("Nomor *").fill(payment);
    await dialog.getByLabel("Nilai pembayaran (harus > 0) *").fill("1000");
    await chooseRelation(page, dialog, "Tagihan wajib *", invoice);
    await dialog.getByLabel("Mata uang 3 huruf (harus sama dengan tagihan)").fill("USD");
    await save(dialog);

    dialog = await openOperation(page, "Ubah status / tanggal pembayaran");
    await chooseRelation(page, dialog, "Catatan *", payment);
    await choose(page, dialog, "Status *", "selesai");
    await dialog.getByLabel("Dibayar pada (status selesai)").fill("2024-01-17");
    await save(dialog);

    dialog = await openOperation(page, "Simpan rekonsiliasi");
    await dialog.getByLabel("Selisih volume").fill("0");
    await dialog.getByLabel("Selisih nilai").fill("0");
    await dialog.getByLabel("Mata uang").fill("USD");
    await dialog.getByLabel("Berita acara").fill("Rekonsiliasi E2E selesai");
    await save(dialog);

    for (const type of ["invoice_penyedia", "invoice_penerima_pasokan", "rekonsiliasi"]) {
      await uploadRequirement(page, type);
    }
    await completeStage(page, "Selesai");

    await selectStage(page, "Selesai");
    dialog = await openOperation(page, "Ubah status rekonsiliasi");
    await choose(page, dialog, "Status *", "selesai");
    await save(dialog);

    dialog = await openOperation(page, "Buat laporan");
    await dialog.getByLabel("Jenis (periodik, akhir, evaluasi) *").fill("akhir");
    await dialog.getByLabel("Ringkasan *").fill("Laporan akhir E2E");
    await save(dialog);

    dialog = await openOperation(page, "Terbitkan laporan");
    await chooseRelation(page, dialog, "Laporan draft *", "akhir");
    await save(dialog);
    await completeStage(page);

    await page.reload();
    await expect(page.getByText("10 dari 10 tahap selesai")).toBeVisible();
    await expect(page.getByText("Tidak ada tahap aktif.")).toBeVisible();

    const cookie = (await page.context().cookies()).find((item) => item.name === "lemigas_session");
    expect(cookie).toBeTruthy();
    const session = JSON.parse(decodeURIComponent(cookie!.value));
    const lifecycle = await request.get(`${backendUrl}/api/pengadaan/${page.url().split("/").at(-2)}/siklus`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    expect(lifecycle.ok()).toBeTruthy();
    const body = await lifecycle.json();
    expect(body.data.status).toBe("selesai");
    expect(body.data.tahapan).toHaveLength(10);
    expect(body.data.tahapan.every((stage: { status: string }) => stage.status === "selesai")).toBeTruthy();
  });
});
