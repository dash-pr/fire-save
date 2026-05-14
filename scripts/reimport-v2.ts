import {
  assertV2Import,
  dedupePdfCsvTransactions,
  disconnectImportPrisma,
  dropTransactionIdempotencyIndex,
  importAllData,
  loadImportData,
  printManualStepsReminder,
  printVerification,
  prisma,
  wipeImportedData,
  LOCAL_USER_ID,
} from "../lib/importHelpers";

async function main() {
  const data = await loadImportData("stashy_import_v2.json");
  console.log("Starting Stashy v2 full wipe + reimport...");
  console.log(`Schema requirements in source: ${(data.schemaAdditionsRequired ?? []).length}`);

  await wipeImportedData();

  // v2 intentionally contains same date/account/amount rows from multiple sources.
  // The old idempotency index prevents loading the full ledger, so the full-wipe
  // importer drops it and uses create mode for transactions.
  await dropTransactionIdempotencyIndex();

  await importAllData(data, {
    transactionWriteMode: "create",
    legacyPaidyAppleOverride: false,
  });

  await assertV2Import();
  await dedupePdfCsvTransactions();
  const finalTransactionCount = await prisma.transaction.count({ where: { localUserId: LOCAL_USER_ID } });
  console.log(`  Final transaction count after dedupe: ${finalTransactionCount}`);

  await printVerification();
  printManualStepsReminder();
  console.log("\nV2 reimport complete.");
}

main()
  .catch((error) => {
    console.error("V2 reimport failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectImportPrisma();
  });
