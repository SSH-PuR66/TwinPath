import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL(
  "../../../supabase/v14-family-gallery-storage-fix.sql",
  import.meta.url
);

test("gallery hotfix restores helper grants and storage policies", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  for (const helper of [
    "can_access_document_path",
    "can_upload_document_path",
    "can_upload_family_photo_path",
    "can_read_family_photo_path",
  ]) {
    assert.match(
      sql,
      new RegExp(
        `grant execute\\s+on function public\\.${helper}\\(text\\)\\s+to authenticated`,
        "i"
      )
    );
  }

  assert.match(
    sql,
    /for insert[\s\S]*bucket_id = 'family-gallery'[\s\S]*can_upload_family_photo_path\(name\)/i
  );
  assert.match(
    sql,
    /for select[\s\S]*bucket_id = 'family-gallery'[\s\S]*can_read_family_photo_path\(name\)/i
  );
  assert.match(
    sql,
    /for delete[\s\S]*bucket_id = 'family-gallery'[\s\S]*can_upload_family_photo_path\(name\)/i
  );
  assert.match(sql, /notify pgrst, 'reload schema'/i);
});
