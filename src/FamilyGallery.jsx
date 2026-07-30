import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    CalendarDays,
    Camera,
    Download,
    ImagePlus,
    Loader2,
    LockKeyhole,
    RefreshCw,
    ShieldCheck,
    Trash2,
    X,
} from "lucide-react";

import { supabase } from "./supabase";
import { processFamilyImage } from "./imageProcessing";
import DisclosureSection from "./DisclosureSection";
import {
    deleteFamilyPhoto,
    FAMILY_GALLERY_BUCKET,
    galleryErrorMessage,
    isMissingStorageObject,
    uploadFamilyPhoto,
} from "./galleryStorage";

const albums = [
    "Family",
    "Ultrasounds",
    "Milestones",
    "Preparation",
    "Receipts",
    "Equipment",
];

export default function FamilyGallery({
    householdId,
    currentUserId,
}) {
    const [photos, setPhotos] = useState([]);
    const [selectedAlbum, setSelectedAlbum] = useState("All");
    const [viewerPhotoId, setViewerPhotoId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deletingPhotoId, setDeletingPhotoId] = useState(null);
    const [error, setError] = useState("");
    const [showAllPhotos, setShowAllPhotos] = useState(false);

    const [form, setForm] = useState({
        album: "Family",
        caption: "",
        captured_on: "",
        visibility: "shared",
    });

    const objectUrlsRef = useRef(new Set());
    const loadRequestRef = useRef(0);
    const viewerCloseButtonRef = useRef(null);
    const viewerDialogRef = useRef(null);
    const viewerTriggerRef = useRef(null);

    const revokeObjectUrls = useCallback(() => {
        objectUrlsRef.current.forEach((url) => {
            URL.revokeObjectURL(url);
        });

        objectUrlsRef.current.clear();
    }, []);

    const replaceObjectUrls = useCallback((nextUrls) => {
        objectUrlsRef.current.forEach((url) => {
            URL.revokeObjectURL(url);
        });

        objectUrlsRef.current = nextUrls;
    }, []);

    const viewerPhoto = useMemo(
        () => photos.find((photo) => photo.id === viewerPhotoId) || null,
        [photos, viewerPhotoId]
    );

    const closeViewer = useCallback((restoreFocus = true) => {
        setViewerPhotoId(null);

        if (restoreFocus) {
            window.setTimeout(() => {
                viewerTriggerRef.current?.focus();
            }, 0);
        }
    }, []);

    useEffect(() => {
        if (!viewerPhoto) return undefined;

        const previousOverflow = document.body.style.overflow;
        const focusTimer = window.setTimeout(() => {
            viewerCloseButtonRef.current?.focus();
        }, 0);

        function handleKeyDown(event) {
            if (event.key === "Escape") {
                event.preventDefault();
                closeViewer();
                return;
            }

            if (event.key !== "Tab") return;

            const focusable = Array.from(
                viewerDialogRef.current?.querySelectorAll(
                    "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
                ) || []
            );

            if (!focusable.length) {
                event.preventDefault();
                viewerDialogRef.current?.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (
                !event.shiftKey &&
                document.activeElement === last
            ) {
                event.preventDefault();
                first.focus();
            }
        }

        document.body.style.overflow = "hidden";
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            window.clearTimeout(focusTimer);
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [closeViewer, viewerPhoto?.id]);

    const loadPhotos = useCallback(async () => {
        const requestId = ++loadRequestRef.current;

        if (!householdId) {
            replaceObjectUrls(new Set());
            setPhotos([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        let data;
        let queryError;

        try {
            const result = await supabase
                .from("family_photos")
                .select("*")
                .eq("household_id", householdId)
                .order("captured_on", {
                    ascending: false,
                    nullsFirst: false,
                })
                .order("created_at", {
                    ascending: false,
                })
                .limit(24);

            data = result.data;
            queryError = result.error;
        } catch (unexpectedError) {
            queryError = unexpectedError;
        }

        if (requestId !== loadRequestRef.current) return;

        if (queryError) {
            setError(
                galleryErrorMessage(
                    queryError,
                    "view this family gallery",
                    "The family gallery could not be loaded."
                )
            );
            replaceObjectUrls(new Set());
            setPhotos([]);
            setLoading(false);
            return;
        }

        const records = Array.isArray(data) ? data : [];

        const nextObjectUrls = new Set();
        const downloadedRecords = await Promise.all(
            records.map(async (photo) => {
                let imageBlob;
                let downloadError;

                try {
                    const result = await supabase.storage
                        .from(FAMILY_GALLERY_BUCKET)
                        .download(photo.storage_path);

                    imageBlob = result.data;
                    downloadError = result.error;
                } catch (unexpectedError) {
                    downloadError = unexpectedError;
                }

                if (downloadError || !imageBlob) {
                    if (import.meta.env.DEV) {
                        console.error("Family gallery download diagnostic", {
                            photoId: photo.id,
                            storagePath: photo.storage_path,
                            ownerUserId: photo.owner_user_id,
                            visibility: photo.visibility,
                            error: downloadError,
                        });
                    }

                    return {
                        ...photo,
                        objectUrl: null,
                        storageMissing:
                            isMissingStorageObject(downloadError),
                        imageError:
                            galleryErrorMessage(
                                downloadError,
                                "view this family photo",
                                "This family photo could not be loaded."
                            ),
                    };
                }

                const objectUrl = URL.createObjectURL(imageBlob);
                nextObjectUrls.add(objectUrl);

                return {
                    ...photo,
                    objectUrl,
                    storageMissing: false,
                    imageError: null,
                };
            })
        );

        if (requestId !== loadRequestRef.current) {
            nextObjectUrls.forEach((url) => URL.revokeObjectURL(url));
            return;
        }

        replaceObjectUrls(nextObjectUrls);
        setPhotos(downloadedRecords);
        setLoading(false);
    }, [householdId, replaceObjectUrls]);

    useEffect(() => {
        loadPhotos();

        return () => {
            loadRequestRef.current += 1;
            revokeObjectUrls();
        };
    }, [loadPhotos, revokeObjectUrls]);

    const visiblePhotos = useMemo(() => {
        if (selectedAlbum === "All") return photos;

        return photos.filter(
            (photo) => photo.album === selectedAlbum
        );
    }, [photos, selectedAlbum]);

    async function uploadPhoto(selectedFile) {
        if (!selectedFile || uploading) return;

        setUploading(true);
        setError("");

        try {
            const processed = await processFamilyImage(selectedFile);
            const extension =
                processed.file.type === "image/webp" ? "webp" : "jpg";

            const uploadedPath =
                `${householdId}/${currentUserId}/` +
                `${crypto.randomUUID()}.${extension}`;

            await uploadFamilyPhoto(supabase, {
                storagePath: uploadedPath,
                file: processed.file,
                metadata: {
                    household_id: householdId,
                    owner_user_id: currentUserId,
                    visibility: form.visibility,
                    storage_path: uploadedPath,
                    file_name: processed.file.name,
                    mime_type: processed.file.type,
                    file_size: processed.file.size,
                    width: processed.width,
                    height: processed.height,
                    album: form.album,
                    caption: form.caption.trim() || null,
                    captured_on: form.captured_on || null,
                },
            });

            setForm((current) => ({
                ...current,
                caption: "",
                captured_on: "",
            }));

            await loadPhotos();
        } catch (uploadError) {
            setError(
                galleryErrorMessage(
                    uploadError,
                    "upload photos to this family gallery",
                    "The photo could not be uploaded."
                )
            );
        } finally {
            setUploading(false);
        }
    }

    async function downloadPhoto(photo) {
        setError("");

        let data;
        let downloadError;

        try {
            const result = await supabase.storage
                .from(FAMILY_GALLERY_BUCKET)
                .download(photo.storage_path);

            data = result.data;
            downloadError = result.error;
        } catch (unexpectedError) {
            downloadError = unexpectedError;
        }

        if (downloadError || !data) {
            setError(
                galleryErrorMessage(
                    downloadError,
                    "download this family photo",
                    "The photo could not be downloaded."
                )
            );
            return;
        }

        const url = URL.createObjectURL(data);
        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download = photo.file_name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function deletePhoto(photo) {
        if (deletingPhotoId) return;

        const confirmed = window.confirm(
            "Delete this photo permanently?"
        );

        if (!confirmed) return;

        setError("");
        setDeletingPhotoId(photo.id);

        try {
            const { storageCleanupError } = await deleteFamilyPhoto(
                supabase,
                {
                    photoId: photo.id,
                    ownerUserId: currentUserId,
                    storagePath: photo.storage_path,
                }
            );

            if (photo.objectUrl) {
                URL.revokeObjectURL(photo.objectUrl);
                objectUrlsRef.current.delete(photo.objectUrl);
            }

            setPhotos((current) =>
                current.filter((item) => item.id !== photo.id)
            );
            closeViewer(false);
            await loadPhotos();

            if (storageCleanupError) {
                setError(
                    "The gallery entry was removed, but cleanup of its stored file could not be confirmed."
                );
            }
        } catch (deleteError) {
            setError(
                galleryErrorMessage(
                    deleteError,
                    "delete this family photo",
                    "The photo could not be deleted."
                )
            );
        } finally {
            setDeletingPhotoId(null);
        }
    }

    function openViewer(photoId, trigger) {
        viewerTriggerRef.current = trigger;
        setViewerPhotoId(photoId);
    }

    function markImageUnavailable(photoId) {
        const failedPhoto = photos.find((photo) => photo.id === photoId);

        if (failedPhoto?.objectUrl) {
            URL.revokeObjectURL(failedPhoto.objectUrl);
            objectUrlsRef.current.delete(failedPhoto.objectUrl);
        }

        setPhotos((current) =>
            current.map((photo) =>
                photo.id === photoId
                    ? {
                        ...photo,
                        objectUrl: null,
                        imageError:
                            "The stored image could not be displayed.",
                    }
                    : photo
            )
        );
    }

    return (
        <section className="family-gallery">
            <div className="section-title">
                <div>
                    <span className="eyebrow">PRIVATE FAMILY GALLERY</span>
                    <h3>Our memories</h3>
                    <p>
                        Images are compressed, re-encoded and stored in a
                        private Supabase bucket.
                    </p>
                </div>

                <button
                    className="icon-button"
                    type="button"
                    onClick={loadPhotos}
                    disabled={loading}
                    aria-label="Refresh gallery"
                >
                    <RefreshCw className={loading ? "spin" : ""} size={18} />
                </button>
            </div>

            <DisclosureSection id="gallery-upload" title="Add a memory" hint="Photo, album, visibility, and caption" collapseOnPhone>
            <div className="gallery-upload-panel">
                <div className="gallery-upload-copy">
                    <ImagePlus size={27} />

                    <div>
                        <strong>Add a memory</strong>
                        <p>JPEG, PNG or WebP. Maximum original size: 20 MB.</p>
                    </div>
                </div>

                <div className="gallery-upload-fields">
                    <label className="field">
                        <span>Album</span>

                        <select
                            value={form.album}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    album: event.target.value,
                                })
                            }
                        >
                            {albums.map((album) => (
                                <option key={album}>{album}</option>
                            ))}
                        </select>
                    </label>

                    <label className="field">
                        <span>Visibility</span>

                        <select
                            value={form.visibility}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    visibility: event.target.value,
                                })
                            }
                        >
                            <option value="shared">Shared together</option>
                            <option value="private">Only me</option>
                        </select>
                    </label>

                    <label className="field">
                        <span>Date</span>

                        <input
                            type="date"
                            value={form.captured_on}
                            onChange={(event) =>
                                setForm({
                                    ...form,
                                    captured_on: event.target.value,
                                })
                            }
                        />
                    </label>
                </div>

                <label className="field">
                    <span>Caption</span>

                    <input
                        maxLength={500}
                        value={form.caption}
                        placeholder="A private caption…"
                        onChange={(event) =>
                            setForm({
                                ...form,
                                caption: event.target.value,
                            })
                        }
                    />
                </label>

                <label className="button primary gallery-file-button">
                    {uploading ? (
                        <Loader2 className="spin" size={17} />
                    ) : (
                        <Camera size={17} />
                    )}

                    {uploading ? "Preparing image…" : "Choose photo"}

                    <input
                        hidden
                        type="file"
                        accept="image/*"
                        disabled={uploading}
                        onChange={(event) => {
                            const file = event.target.files?.[0];

                            if (file) uploadPhoto(file);

                            event.target.value = "";
                        }}
                    />
                </label>
            </div>
            </DisclosureSection>

            {error && (
                <div className="error-box" role="alert">
                    {error}
                </div>
            )}

            <DisclosureSection id="gallery-memories" title="Memories" hint={`${visiblePhotos.length} shown`}>
            <div className="gallery-album-row">
                {["All", ...albums].map((album) => (
                    <button
                        className={`chip ${selectedAlbum === album ? "active" : ""
                            }`}
                        type="button"
                        key={album}
                        onClick={() => setSelectedAlbum(album)}
                    >
                        {album}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="gallery-loading">
                    <Loader2 className="spin" size={25} />
                    <span>Loading memories…</span>
                </div>
            ) : visiblePhotos.length ? (
                <div className="family-photo-grid">
                    {(showAllPhotos ? visiblePhotos : visiblePhotos.slice(0, 8)).map((photo) => (
                        <article
                            className={`family-photo-card${photo.objectUrl ? "" : " is-unavailable"}`}
                            key={photo.id}
                        >
                            <button
                                className="family-photo-open"
                                type="button"
                                onClick={(event) =>
                                    openViewer(
                                        photo.id,
                                        event.currentTarget
                                    )
                                }
                                aria-label={`Open ${photo.caption || `${photo.album} photo`}`}
                            >
                                {photo.objectUrl ? (
                                    <img
                                        src={photo.objectUrl}
                                        alt={photo.caption || `${photo.album} photo`}
                                        loading="lazy"
                                        decoding="async"
                                        onError={() =>
                                            markImageUnavailable(photo.id)
                                        }
                                    />
                                ) : (
                                    <div className="gallery-image-unavailable">
                                        <span>
                                            {photo.storageMissing
                                                ? "Stored image missing"
                                                : "Image unavailable"}
                                        </span>
                                    </div>
                                )}

                                <div className="family-photo-overlay">
                                    <span>{photo.album}</span>

                                    {photo.visibility === "private" && (
                                        <LockKeyhole size={14} />
                                    )}
                                </div>
                            </button>

                            {!photo.objectUrl && (
                                <div className="gallery-card-actions">
                                    <button
                                        className="button ghost"
                                        type="button"
                                        onClick={loadPhotos}
                                        disabled={loading}
                                    >
                                        Retry
                                    </button>

                                    {photo.owner_user_id === currentUserId && (
                                        <button
                                            className="button danger"
                                            type="button"
                                            onClick={() => deletePhoto(photo)}
                                            disabled={deletingPhotoId === photo.id}
                                        >
                                            {deletingPhotoId === photo.id ? (
                                                <Loader2 className="spin" size={14} />
                                            ) : (
                                                <Trash2 size={14} />
                                            )}
                                            Remove
                                        </button>
                                    )}
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            ) : (
                <div className="empty">
                    No photos here yet. Save the little moments now — you will be glad you did later.
                </div>
            )}
            {visiblePhotos.length > 8 && !showAllPhotos ? <button className="button secondary" type="button" onClick={() => setShowAllPhotos(true)}>Show all {visiblePhotos.length}</button> : null}

            </DisclosureSection>

            <div className="warning-inline">
                <ShieldCheck size={18} />

                <span>
                    Do not upload full identity documents, passwords,
                    recovery codes or images containing exposed account numbers.
                </span>
            </div>

            {viewerPhoto && (
                <div
                    className="gallery-viewer"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            closeViewer();
                        }
                    }}
                >
                    <div
                        ref={viewerDialogRef}
                        className="gallery-viewer-card"
                        onMouseDown={(event) => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Family photo viewer"
                        tabIndex={-1}
                    >
                        <button
                            ref={viewerCloseButtonRef}
                            className="gallery-viewer-close"
                            type="button"
                            onClick={() => closeViewer()}
                            aria-label="Close photo"
                        >
                            <X size={21} />
                        </button>

                        {viewerPhoto.objectUrl ? (
                            <img
                                src={viewerPhoto.objectUrl}
                                alt={viewerPhoto.caption || "Family photo"}
                                decoding="async"
                                onError={() =>
                                    markImageUnavailable(viewerPhoto.id)
                                }
                            />
                        ) : (
                            <div className="gallery-image-unavailable">
                                <span>
                                    {viewerPhoto.storageMissing
                                        ? "Stored image missing"
                                        : "Image unavailable"}
                                </span>

                                {viewerPhoto.imageError && (
                                    <small>{viewerPhoto.imageError}</small>
                                )}
                            </div>
                        )}

                        <div className="gallery-viewer-details">
                            <div>
                                <span className="pill blue">
                                    {viewerPhoto.album}
                                </span>

                                {viewerPhoto.caption && (
                                    <p>{viewerPhoto.caption}</p>
                                )}

                                {viewerPhoto.captured_on && (
                                    <small>
                                        <CalendarDays size={13} />
                                        {new Date(
                                            `${viewerPhoto.captured_on}T12:00:00`
                                        ).toLocaleDateString()}
                                    </small>
                                )}
                            </div>

                            <div className="gallery-viewer-actions">
                                {viewerPhoto.objectUrl ? (
                                    <button
                                        className="button secondary"
                                        type="button"
                                        onClick={() => downloadPhoto(viewerPhoto)}
                                    >
                                        <Download size={16} />
                                        Download
                                    </button>
                                ) : (
                                    <button
                                        className="button secondary"
                                        type="button"
                                        onClick={loadPhotos}
                                        disabled={loading}
                                    >
                                        <RefreshCw size={16} />
                                        Retry
                                    </button>
                                )}

                                {viewerPhoto.owner_user_id === currentUserId && (
                                    <button
                                        className="button danger"
                                        type="button"
                                        onClick={() => deletePhoto(viewerPhoto)}
                                        disabled={deletingPhotoId === viewerPhoto.id}
                                    >
                                        {deletingPhotoId === viewerPhoto.id ? (
                                            <Loader2 className="spin" size={16} />
                                        ) : (
                                            <Trash2 size={16} />
                                        )}
                                        Delete
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
