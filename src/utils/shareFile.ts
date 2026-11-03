import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Writes a file and hands it to the share sheet — Files, Mail, LINE, AirDrop.
 *
 * Written to the cache rather than the documents folder: the phone is not
 * where the report is kept, it is where it is sent from, and the system is
 * free to clear the copy once it has gone.
 */
export async function shareFile(name: string, bytes: Uint8Array, title: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);
  await Sharing.shareAsync(file.uri, {
    mimeType: XLSX_TYPE,
    UTI: "org.openxmlformats.spreadsheetml.sheet",
    dialogTitle: title,
  });
}
