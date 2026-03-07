/**
 * Xcannes Wallet — QR Scanner Service
 * 
 * Handles camera access and QR code scanning on mobile.
 * Uses the native BarcodeDetector API (supported on Chrome Android, Safari 17.2+)
 * with jsQR as fallback.
 */

const SCAN_INTERVAL_MS = 150; // Scan frequency

/**
 * Check if the native BarcodeDetector API is available.
 * @returns {boolean}
 */
function hasNativeBarcodeDetector() {
  return typeof BarcodeDetector !== 'undefined';
}

/**
 * Create a QR code scanner.
 * Returns an object with start/stop controls.
 *
 * @param {HTMLVideoElement} videoElement - The <video> element for camera preview
 * @param {function} onResult - Callback called with the decoded QR string
 * @param {function} onError - Callback for errors
 * @returns {{ start: Function, stop: Function }}
 */
export function createQRScanner(videoElement, onResult, onError) {
  let stream = null;
  let scanInterval = null;
  let canvas = null;
  let ctx = null;
  let barcodeDetector = null;
  let stopped = false;

  async function start() {
    stopped = false;

    try {
      // Request camera access — prefer back camera on mobile
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      videoElement.srcObject = stream;
      videoElement.setAttribute('playsinline', 'true'); // Required for iOS
      await videoElement.play();

      // Setup canvas for frame analysis
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d', { willReadFrequently: true });

      // Use native BarcodeDetector if available
      if (hasNativeBarcodeDetector()) {
        barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
      }

      // Start scanning loop
      scanInterval = setInterval(() => scanFrame(), SCAN_INTERVAL_MS);
    } catch (err) {
      onError?.(err);
    }
  }

  async function scanFrame() {
    if (stopped || !videoElement || videoElement.readyState < 2) return;

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0);

    try {
      let result = null;

      if (barcodeDetector) {
        // Native BarcodeDetector API
        const barcodes = await barcodeDetector.detect(canvas);
        if (barcodes.length > 0) {
          result = barcodes[0].rawValue;
        }
      } else {
        // Fallback: jsQR (loaded via CDN)
        if (typeof jsQR !== 'undefined') {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, canvas.width, canvas.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code) {
            result = code.data;
          }
        }
      }

      if (result) {
        stop(); // Stop scanning after successful read
        onResult(result);
      }
    } catch (err) {
      // Silently continue scanning on frame errors
    }
  }

  function stop() {
    stopped = true;
    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (videoElement) {
      videoElement.srcObject = null;
    }
  }

  return { start, stop };
}

/**
 * Parse a scanned QR code to extract the Xcannes challenge data.
 * 
 * Expected QR formats:
 *   - URL: https://xcannes.com/wallet-relay/challenge/CHALLENGE_ID
 *   - JSON: { "type": "xcannes:connect"|"xcannes:sign", "challengeId": "...", "relay": "..." }
 *   - Plain: CHALLENGE_ID (UUID)
 *
 * NOTE: Navigation types (xcannes:navigate, xcannes:navigate-connect) are NOT relay challenges
 *       and should be handled separately in handleQRScanned before calling parseQRCode.
 *
 * @param {string} rawQR - The raw QR code content
 * @returns {{ type: string, challengeId: string, relay?: string } | null}
 */
export function parseQRCode(rawQR) {
  if (!rawQR) return null;

  // Try JSON format
  try {
    const parsed = JSON.parse(rawQR);
    // Only treat as relay challenge if it's xcannes:connect or xcannes:sign
    // Navigation types (xcannes:navigate, xcannes:navigate-connect) are handled elsewhere
    if (parsed.challengeId && parsed.type && 
        (parsed.type === 'xcannes:connect' || parsed.type === 'xcannes:sign')) {
      return {
        type: parsed.type,
        challengeId: parsed.challengeId,
        relay: parsed.relay || null,
      };
    }
  } catch {
    // Not JSON — try other formats
  }

  // Try URL format
  try {
    const url = new URL(rawQR);
    const match = url.pathname.match(/\/wallet-relay\/challenge\/([a-f0-9-]+)/i);
    if (match) {
      return {
        type: 'xcannes:connect',
        challengeId: match[1],
        relay: url.origin,
      };
    }
  } catch {
    // Not a URL
  }

  // Try plain UUID
  const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if (uuidRegex.test(rawQR.trim())) {
    return {
      type: 'xcannes:connect',
      challengeId: rawQR.trim(),
      relay: null,
    };
  }

  return null;
}
