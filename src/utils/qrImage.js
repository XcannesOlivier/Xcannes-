export async function normalizeQrImageFile(file, { maxDimension = 1600 } = {}) {
  if (!file || typeof window === "undefined") return file;

  const createBitmap = async () => {
    if (typeof createImageBitmap !== "function") return null;
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      return null;
    }
  };

  const loadImage = async () =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      const cleanup = () => URL.revokeObjectURL(url);
      img.decoding = "async";
      img.onload = () => {
        cleanup();
        resolve(img);
      };
      img.onerror = (err) => {
        cleanup();
        reject(err);
      };
      img.src = url;
      if (img.decode) {
        img.decode().catch(() => {});
      }
    });

  let source = await createBitmap();
  let isBitmap = Boolean(source);
  if (!source) {
    try {
      source = await loadImage();
    } catch {
      return file;
    }
  }

  const srcWidth = isBitmap
    ? source.width
    : source.naturalWidth || source.width;
  const srcHeight = isBitmap
    ? source.height
    : source.naturalHeight || source.height;
  if (!srcWidth || !srcHeight) {
    if (isBitmap && source.close) source.close();
    return file;
  }

  const maxDim = Math.max(320, Number(maxDimension) || 1600);
  const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (isBitmap && source.close) source.close();
    return file;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = scale < 1;
  if (ctx.imageSmoothingEnabled && "imageSmoothingQuality" in ctx) {
    ctx.imageSmoothingQuality = "high";
  }
  ctx.drawImage(source, 0, 0, width, height);
  if (isBitmap && source.close) source.close();

  const blob = await new Promise((resolve) =>
    canvas.toBlob((result) => resolve(result), "image/png")
  );
  if (!blob) return file;

  const safeName = file.name ? file.name.replace(/\.[^/.]+$/, "") : "qr";
  if (typeof File === "undefined") return blob;
  return new File([blob], `${safeName}.png`, {
    type: "image/png",
  });
}
