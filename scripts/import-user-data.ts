import {
  disconnectImportPrisma,
  importAllData,
  loadImportData,
  printVerification,
} from "../lib/importHelpers";

async function main() {
  const data = await loadImportData("stashy_import.json");
  console.log("Starting Stashy real user data import...");
  console.log(`Schema requirements in source: ${(data.schemaAdditionsRequired ?? []).length}`);

  await importAllData(data, { legacyPaidyAppleOverride: true });
  await printVerification();
  console.log("\nImport complete. Re-running this script is safe and will update existing rows instead of duplicating them.");
}

main()
  .catch((error) => {
    console.error("Import failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectImportPrisma();
  });
