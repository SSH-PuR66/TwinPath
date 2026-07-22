import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
    deleteFamilyPhoto,
    galleryErrorMessage,
    isMissingStorageObject,
    uploadFamilyPhoto,
} from "../src/galleryStorage.js";

function storageClient(events, responses = {}) {
    return {
        from(bucket) {
            assert.equal(bucket, "family-gallery");

            return {
                async upload(path) {
                    events.push(`storage.upload:${path}`);
                    return responses.upload || { error: null };
                },
                async remove(paths) {
                    events.push(`storage.remove:${paths[0]}`);
                    return responses.remove || { error: null };
                },
            };
        },
    };
}

function insertClient(events, responses = {}) {
    return {
        storage: storageClient(events, responses),
        from(table) {
            assert.equal(table, "family_photos");

            return {
                async insert() {
                    events.push("metadata.insert");
                    return responses.insert || { error: null };
                },
            };
        },
    };
}

function deleteClient(events, responses = {}) {
    const query = {
        delete() {
            events.push("metadata.delete");
            return this;
        },
        eq(column, value) {
            events.push(`metadata.eq:${column}:${value}`);
            return this;
        },
        async select() {
            events.push("metadata.select");
            return responses.delete || {
                data: [{ id: "photo-1" }],
                error: null,
            };
        },
    };

    return {
        storage: storageClient(events, responses),
        from(table) {
            assert.equal(table, "family_photos");
            return query;
        },
    };
}

test("upload writes storage before metadata", async () => {
    const events = [];

    await uploadFamilyPhoto(insertClient(events), {
        storagePath: "household/user/photo.webp",
        file: { type: "image/webp" },
        metadata: { id: "photo-1" },
    });

    assert.deepEqual(events, [
        "storage.upload:household/user/photo.webp",
        "metadata.insert",
    ]);
});

test("failed metadata insert cleans up the uploaded object", async () => {
    const events = [];
    const metadataError = new Error("metadata rejected");

    await assert.rejects(
        uploadFamilyPhoto(
            insertClient(events, {
                insert: { error: metadataError },
            }),
            {
                storagePath: "household/user/photo.webp",
                file: { type: "image/webp" },
                metadata: { id: "photo-1" },
            }
        ),
        metadataError
    );

    assert.deepEqual(events, [
        "storage.upload:household/user/photo.webp",
        "metadata.insert",
        "storage.remove:household/user/photo.webp",
    ]);
});

test("failed upload rollback reports that cleanup was not confirmed", async () => {
    const events = [];

    await assert.rejects(
        uploadFamilyPhoto(
            insertClient(events, {
                insert: { error: new Error("metadata rejected") },
                remove: { error: new Error("cleanup offline") },
            }),
            {
                storagePath: "household/user/photo.webp",
                file: { type: "image/webp" },
                metadata: { id: "photo-1" },
            }
        ),
        (error) => {
            assert.equal(error.storageCleanupError.message, "cleanup offline");
            assert.match(
                galleryErrorMessage(error, "upload it", "upload failed"),
                /cleanup could not be confirmed/
            );
            return true;
        }
    );
});

test("delete removes metadata before the storage object", async () => {
    const events = [];

    const result = await deleteFamilyPhoto(deleteClient(events), {
        photoId: "photo-1",
        ownerUserId: "user-1",
        storagePath: "household/user/photo.webp",
    });

    assert.equal(result.storageCleanupError, null);
    assert.ok(
        events.indexOf("metadata.select") <
        events.indexOf("storage.remove:household/user/photo.webp")
    );
});

test("unconfirmed metadata deletion never removes storage", async () => {
    const events = [];

    await assert.rejects(
        deleteFamilyPhoto(
            deleteClient(events, {
                delete: { data: [], error: null },
            }),
            {
                photoId: "photo-1",
                ownerUserId: "user-1",
                storagePath: "household/user/photo.webp",
            }
        ),
        { code: "GALLERY_DELETE_NOT_CONFIRMED" }
    );

    assert.equal(
        events.includes("storage.remove:household/user/photo.webp"),
        false
    );
});

test("a missing stored object is an idempotent delete success", async () => {
    const events = [];
    const result = await deleteFamilyPhoto(
        deleteClient(events, {
            remove: {
                error: { status: 404, message: "Object not found" },
            },
        }),
        {
            photoId: "photo-1",
            ownerUserId: "user-1",
            storagePath: "household/user/photo.webp",
        }
    );

    assert.equal(result.storageCleanupError, null);
    assert.equal(
        isMissingStorageObject({ status: 404, message: "Object not found" }),
        true
    );
    assert.match(
        galleryErrorMessage(
            { status: 404, message: "Object not found" },
            "view it",
            "fallback"
        ),
        /no longer exists/
    );
});

test("v16 only prunes gallery metadata whose storage object is missing", async () => {
    const migration = await readFile(
        new URL(
            "../supabase/v16-family-gallery-consistency.sql",
            import.meta.url
        ),
        "utf8"
    );

    assert.match(
        migration,
        /delete\s+from\s+public\.family_photos[\s\S]+where\s+not\s+exists/i
    );
    assert.match(
        migration,
        /from\s+storage\.objects[\s\S]+object\.name\s*=\s*photo\.storage_path/i
    );
    assert.doesNotMatch(migration, /delete\s+from\s+storage\.objects/i);
});

test("gallery CSP permits blob URLs for private image downloads", async () => {
    const headers = await readFile(
        new URL("../public/_headers", import.meta.url),
        "utf8"
    );
    const contentSecurityPolicy = headers
        .split(/\r?\n/)
        .find((line) => line.includes("Content-Security-Policy:"));
    const imageSources = contentSecurityPolicy?.match(
        /img-src\s+([^;]+)/i
    )?.[1];

    assert.ok(imageSources, "the CSP must define img-src");
    assert.match(imageSources, /(^|\s)blob:(\s|$)/);
});
