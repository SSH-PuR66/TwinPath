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

const albums = [
    "Family",
    "Ultrasounds",
    "Milestones",
    "Preparation",
    "Receipts",
    "Equipment",
];

function galleryErrorMessage(error, action, fallback) {
    const status = Number(error?.statusCode ?? error?.status);
    const message = String(error?.message || "");
    const isPermissionError =
        status === 401 ||
        status === 403 ||
        /row-level security|permission denied|not authorized|unauthorized|forbidden|access denied|jwt/i.test(
            message
        );

    if (isPermissionError) {
        return `Gallery storage access needs repair before you can ${action}. Ask the app administrator to apply the latest storage update, then retry.`;
    }

    return message || fallback;
}

export default function FamilyGallery({
    householdId,
    currentUserId,
}) {
    const [photos, setPhotos] = useState([]);
    const [selectedAlbum, setSelectedAlbum] = useState("All");
    const [viewerPhoto, setViewerPhoto] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!viewerPhoto) return undefined;

        const previousOverflow =
            document.body.style.overflow;

        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [viewerPhoto]);

    const [form, setForm] = useState({
        album: "Family",
        caption: "",
        captured_on: "",
        visibility: "shared",
    });

    const objectUrlsRef = useRef(new Set());

    const revokeObjectUrls = useCallback(() => {
        objectUrlsRef.current.forEach((url) => {
            URL.revokeObjectURL(url);
        });

        objectUrlsRef.current.clear();
    }, []);

    const loadPhotos = useCallback(async () => {
        if (!householdId) return;

        setLoading(true);
        setError("");

        revokeObjectUrls();

        const { data, error: queryError } = await supabase
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

        if (queryError) {
            setError(
                galleryErrorMessage(
                    queryError,
                    "view this family gallery",
                    "The family gallery could not be loaded."
                )
            );
            setPhotos([]);
            setLoading(false);
            return;
        }

        const records = Array.isArray(data) ? data : [];

        const downloadedRecords = await Promise.all(
            records.map(async (photo) => {
                const { data: imageBlob, error: downloadError } =
                    await supabase.storage
                        .from("family-gallery")
                        .download(photo.storage_path);

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
                        imageError:
                            galleryErrorMessage(
                                downloadError,
                                "view this family photo",
                                "This family photo could not be loaded."
                            ),
                    };
                }

                const objectUrl = URL.createObjectURL(imageBlob);
                objectUrlsRef.current.add(objectUrl);

                return {
                    ...photo,
                    objectUrl,
                    imageError: null,
                };
            })
        );

        setPhotos(downloadedRecords);
        setLoading(false);
    }, [householdId, revokeObjectUrls]);

    useEffect(() => {
        loadPhotos();

        return () => {
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

        let uploadedPath = null;

        try {
            const processed = await processFamilyImage(selectedFile);
            const extension =
                processed.file.type === "image/webp" ? "webp" : "jpg";

            uploadedPath =
                `${householdId}/${currentUserId}/` +
                `${crypto.randomUUID()}.${extension}`;

            const { error: uploadError } = await supabase.storage
                .from("family-gallery")
                .upload(uploadedPath, processed.file, {
                    upsert: false,
                    contentType: processed.file.type,
                    cacheControl: "3600",
                });

            if (uploadError) throw uploadError;

            const { error: metadataError } = await supabase
                .from("family_photos")
                .insert({
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
                });

            if (metadataError) throw metadataError;

            setForm((current) => ({
                ...current,
                caption: "",
                captured_on: "",
            }));

            await loadPhotos();
        } catch (uploadError) {
            if (uploadedPath) {
                await supabase.storage
                    .from("family-gallery")
                    .remove([uploadedPath]);
            }

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

        const { data, error: downloadError } =
            await supabase.storage
                .from("family-gallery")
                .download(photo.storage_path);

        if (downloadError) {
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
        const confirmed = window.confirm(
            "Delete this photo permanently?"
        );

        if (!confirmed) return;

        setError("");

        const { error: storageError } = await supabase.storage
            .from("family-gallery")
            .remove([photo.storage_path]);

        if (storageError) {
            setError(
                galleryErrorMessage(
                    storageError,
                    "delete this family photo",
                    "The photo could not be deleted."
                )
            );
            return;
        }

        const { error: metadataError } = await supabase
            .from("family_photos")
            .delete()
            .eq("id", photo.id)
            .eq("owner_user_id", currentUserId);

        if (metadataError) {
            setError(
                galleryErrorMessage(
                    metadataError,
                    "delete this family photo",
                    "The photo record could not be deleted."
                )
            );
            return;
        }

        setViewerPhoto(null);
        await loadPhotos();
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
                    aria-label="Refresh gallery"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

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

            {error && (
                <div className="error-box" role="alert">
                    {error}
                </div>
            )}

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
                    {visiblePhotos.map((photo) => (
                        <button
                            className="family-photo-card"
                            type="button"
                            key={photo.id}
                            onClick={() => setViewerPhoto(photo)}
                        >
                            {photo.objectUrl ? (
                                <img
                                    src={photo.objectUrl}
                                    alt={photo.caption || `${photo.album} photo`}
                                    loading="lazy"
                                    decoding="async"
                                    onError={(event) => {
                                        event.currentTarget.style.display = "none";
                                    }}
                                />
                            ) : (
                                <div className="gallery-image-unavailable">
                                    <span>Image unavailable</span>

                                    {photo.imageError && (
                                        <small>{photo.imageError}</small>
                                    )}

                                    <button
                                        className="button ghost"
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            loadPhotos();
                                        }}
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}

                            <div className="family-photo-overlay">
                                <span>{photo.album}</span>

                                {photo.visibility === "private" && (
                                    <LockKeyhole size={14} />
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            ) : (
                <div className="empty">
                    No photos in this album yet.
                </div>
            )}

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
                    onMouseDown={() => setViewerPhoto(null)}
                >
                    <div
                        className="gallery-viewer-card"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <button
                            className="gallery-viewer-close"
                            type="button"
                            onClick={() => setViewerPhoto(null)}
                            aria-label="Close photo"
                        >
                            <X size={21} />
                        </button>

                        {viewerPhoto.objectUrl ? (
                            <img
                                src={viewerPhoto.objectUrl}
                                alt={viewerPhoto.caption || "Family photo"}
                                decoding="async"
                            />
                        ) : (
                            <div className="gallery-image-unavailable">
                                Image unavailable
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
                                <button
                                    className="button secondary"
                                    type="button"
                                    onClick={() => downloadPhoto(viewerPhoto)}
                                >
                                    <Download size={16} />
                                    Download
                                </button>

                                {viewerPhoto.owner_user_id === currentUserId && (
                                    <button
                                        className="button danger"
                                        type="button"
                                        onClick={() => deletePhoto(viewerPhoto)}
                                    >
                                        <Trash2 size={16} />
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
