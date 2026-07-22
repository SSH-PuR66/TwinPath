export const FAMILY_GALLERY_BUCKET = "family-gallery";

function errorStatus(error) {
    return Number(
        error?.statusCode ??
        error?.status ??
        error?.cause?.statusCode ??
        error?.cause?.status
    );
}

export function isMissingStorageObject(error) {
    const status = errorStatus(error);
    const message = String(
        error?.message || error?.cause?.message || ""
    );

    return (
        status === 404 ||
        /(?:object|file|resource).*(?:not found|does not exist)|not found.*(?:object|file)|no such (?:object|file)/i.test(
            message
        )
    );
}

export function galleryErrorMessage(error, action, fallback) {
    const status = errorStatus(error);
    const message = String(
        error?.message || error?.cause?.message || ""
    );
    const isPermissionError =
        status === 401 ||
        status === 403 ||
        /row-level security|permission denied|not authorized|unauthorized|forbidden|access denied|jwt/i.test(
            message
        );

    if (isMissingStorageObject(error)) {
        return "This gallery entry points to a stored image that no longer exists. The entry can be removed safely.";
    }

    if (isPermissionError) {
        return `Gallery storage access needs repair before you can ${action}. Ask the app administrator to apply the latest storage update, then retry.`;
    }

    if (error?.storageCleanupError) {
        return `${message || fallback} The uploaded file cleanup could not be confirmed.`;
    }

    return message || fallback;
}

function withCleanupError(error, storageCleanupError) {
    const wrappedError = new Error(
        error?.message || "The photo record could not be saved."
    );

    Object.assign(wrappedError, error, {
        cause: error,
        storageCleanupError,
    });

    return wrappedError;
}

export async function uploadFamilyPhoto(
    client,
    { storagePath, file, metadata }
) {
    const { error: uploadError } = await client.storage
        .from(FAMILY_GALLERY_BUCKET)
        .upload(storagePath, file, {
            upsert: false,
            contentType: file.type,
            cacheControl: "3600",
        });

    if (uploadError) throw uploadError;

    let metadataError = null;

    try {
        const metadataResult = await client
            .from("family_photos")
            .insert(metadata);

        metadataError = metadataResult.error;
    } catch (metadataFailure) {
        metadataError = metadataFailure;
    }

    if (!metadataError) return;

    let storageCleanupError = null;

    try {
        const cleanupResult = await client.storage
            .from(FAMILY_GALLERY_BUCKET)
            .remove([storagePath]);

        storageCleanupError = cleanupResult.error;
    } catch (cleanupFailure) {
        storageCleanupError = cleanupFailure;
    }

    if (isMissingStorageObject(storageCleanupError)) {
        storageCleanupError = null;
    }

    if (storageCleanupError) {
        throw withCleanupError(metadataError, storageCleanupError);
    }

    throw metadataError;
}

export async function deleteFamilyPhoto(
    client,
    { photoId, ownerUserId, storagePath }
) {
    const { data: deletedRecords, error: metadataError } =
        await client
            .from("family_photos")
            .delete()
            .eq("id", photoId)
            .eq("owner_user_id", ownerUserId)
            .select("id");

    if (metadataError) throw metadataError;

    if (!Array.isArray(deletedRecords) || deletedRecords.length !== 1) {
        const confirmationError = new Error(
            "The photo record deletion could not be confirmed. Refresh the gallery and try again."
        );

        confirmationError.code = "GALLERY_DELETE_NOT_CONFIRMED";
        throw confirmationError;
    }

    let storageCleanupError = null;

    try {
        const cleanupResult = await client.storage
            .from(FAMILY_GALLERY_BUCKET)
            .remove([storagePath]);

        storageCleanupError = cleanupResult.error;
    } catch (cleanupFailure) {
        storageCleanupError = cleanupFailure;
    }

    return {
        storageCleanupError:
            storageCleanupError &&
            !isMissingStorageObject(storageCleanupError)
                ? storageCleanupError
                : null,
    };
}
