import { processCsvImport } from "../../lib/contacts/import";
import type { ImportJobData } from "../../lib/queue/types";

export async function processImport(data: ImportJobData) {
  await processCsvImport(data.importJobId);
}
