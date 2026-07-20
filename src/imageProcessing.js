const ACCEPTED_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
]);

const MAX_SOURCE_SIZE = 20 * 1024 * 1024;
const MAX_DIMENSION = 2048;

function loadImageElement(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();

        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };

        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("The image could not be opened."));
        };

        image.src = url;
    });
}

function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("The image could not be compressed."));
                    return;
                }

                resolve(blob);
            },
            type,
            quality
        );
    });
}

export async function processFamilyImage(file) {
    if (!(file instanceof File)) {
        throw new Error("Select a valid image.");
    }

    if (!ACCEPTED_TYPES.has(file.type)) {
        if (
            file.type === "image/heic" ||
            file.type === "image/heif"
        ) {
            throw new Error(
                "HEIC is not supported yet. Export the image as JPEG, PNG or WebP first."
            );
        }

        throw new Error("Only JPEG, PNG and WebP images are supported.");
    }

    if (file.size > MAX_SOURCE_SIZE) {
        throw new Error("The original image must be 20 MB or smaller.");
    }

    let source;
    let width;
    let height;
    let closeSource = () => { };

    if ("createImageBitmap" in window) {
        source = await createImageBitmap(file, {
            imageOrientation: "from-image",
        });

        width = source.width;
        height = source.height;
        closeSource = () => source.close?.();
    } else {
        source = await loadImageElement(file);
        width = source.naturalWidth;
        height = source.naturalHeight;
    }

    const scale = Math.min(
        1,
        MAX_DIMENSION / Math.max(width, height)
    );

    const outputWidth = Math.max(1, Math.round(width * scale));
    const outputHeight = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const context = canvas.getContext("2d", {
        alpha: false,
    });

    if (!context) {
        closeSource();
        throw new Error("Image processing is unavailable.");
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outputWidth, outputHeight);

    context.drawImage(
        source,
        0,
        0,
        outputWidth,
        outputHeight
    );

    closeSource();

    let outputType = "image/webp";
    let blob;

    try {
        blob = await canvasToBlob(canvas, outputType, 0.84);
    } catch {
        outputType = "image/jpeg";
        blob = await canvasToBlob(canvas, outputType, 0.86);
    }

    if (blob.size > 10 * 1024 * 1024) {
        throw new Error(
            "The compressed image is still larger than 10 MB."
        );
    }

    const extension =
        outputType === "image/webp" ? "webp" : "jpg";

    return {
        file: new File(
            [blob],
            `family-${crypto.randomUUID()}.${extension}`,
            {
                type: outputType,
                lastModified: Date.now(),
            }
        ),
        width: outputWidth,
        height: outputHeight,
    };
}
