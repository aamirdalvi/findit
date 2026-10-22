const MAX_ORIGINAL_SIZE = 10 * 1024 * 1024;
const MAX_OUTPUT_SIZE = 600 * 1024;
const MAX_DIMENSION = 1000;
const MAX_SOURCE_PIXELS = 60_000_000;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp)$/i;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image could not be opened. Try a different JPEG, PNG, or WebP file."));
    };
    image.src = objectUrl;
  });
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("The image could not be compressed in this browser."));
    }, type, quality);
  });
}

export async function processItemImage(file: File): Promise<string> {
  const hasSupportedType = ACCEPTED_TYPES.has(file.type.toLowerCase());
  const hasSupportedExtension = ACCEPTED_EXTENSIONS.test(file.name);
  if (!hasSupportedType && !hasSupportedExtension) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (file.size > MAX_ORIGINAL_SIZE) {
    throw new Error("This image is over 10 MB. Choose a smaller original image.");
  }

  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) throw new Error("This image has no readable dimensions. Try another file.");
  if (image.naturalWidth * image.naturalHeight > MAX_SOURCE_PIXELS) {
    throw new Error("This image has too many pixels to process safely. Choose a smaller image.");
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image compression is unavailable in this browser.");

  let scale = Math.min(1, MAX_DIMENSION / longestSide);
  for (let sizeAttempt = 0; sizeAttempt < 4; sizeAttempt += 1) {
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.72, 0.62, 0.52]) {
      let blob: Blob;
      try {
        blob = await canvasBlob(canvas, "image/webp", quality);
      } catch {
        blob = await canvasBlob(canvas, "image/jpeg", quality);
      }
      if (blob.size <= MAX_OUTPUT_SIZE) {
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("The processed image could not be read."));
          reader.onerror = () => reject(new Error("The processed image could not be read."));
          reader.readAsDataURL(blob);
        });
      }
    }
    scale *= 0.8;
  }

  throw new Error("This image could not be reduced enough to store. Choose a smaller image.");
}
