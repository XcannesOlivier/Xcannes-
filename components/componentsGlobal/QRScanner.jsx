"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function QRScanner({ isOpen, onScan, onClose }) {
  const html5QrCodeRef = useRef(null);
  const readerIdRef = useRef(
    `qr-reader-${Math.random().toString(36).slice(2, 10)}`
  );
  const activeRef = useRef(false);
  const lastDecodedRef = useRef("");
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const stopScanner = async () => {
    const instance = html5QrCodeRef.current;
    if (!instance) return;
    try {
      if (activeRef.current) {
        await instance.stop();
      }
    } catch (e) {
      // ignore stop errors (often thrown when not started)
    }
    try {
      await instance.clear();
    } catch (e) {
      // ignore clear errors
    }
    activeRef.current = false;
    setIsScanning(false);
    setIsStarting(false);
  };

  useEffect(() => {
    if (!isOpen) {
      // Cleanup when closing
      stopScanner().catch(console.error);
      setError(null);
      setIsScanning(false);
      setIsStarting(false);
      lastDecodedRef.current = "";
      return;
    }

    let mounted = true;

    const startScanner = async () => {
      try {
        if (!mounted) return;
        if (typeof window === "undefined") return;

        // Caméra = contexte sécurisé requis (HTTPS / localhost)
        const isSecure =
          window.isSecureContext ||
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1";
        if (!isSecure) {
          setError(
            "Camera is blocked on HTTP. Use HTTPS (or localhost) or upload a QR image below."
          );
          setIsScanning(false);
          return;
        }

        if (!navigator?.mediaDevices?.getUserMedia) {
          setError(
            "Camera is not available on this device. You can upload a QR image below."
          );
          setIsScanning(false);
          return;
        }

        setError(null);
        setIsStarting(true);

        // Wait for DOM to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (!mounted) return;

        const { Html5Qrcode } = await import("html5-qrcode");

        // Cleanup any previous instance bound to this component
        await stopScanner();

        // Create scanner instance
        const html5QrCode = new Html5Qrcode(readerIdRef.current);
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // QR code scanné avec succès
            console.log("QR Code scanned:", decodedText);

            // Dé-doublonnage simple (évite plusieurs callbacks rapprochés)
            if (decodedText && decodedText === lastDecodedRef.current) return;
            lastDecodedRef.current = decodedText;

            // Stop scanner before calling onScan
            stopScanner()
              .then(() => onScan(decodedText))
              .catch(() => onScan(decodedText));
          },
          () => {
            // Erreur de scan continue - normal, ne rien faire
          }
        );

        activeRef.current = true;
        setIsStarting(false);
        setIsScanning(true);
      } catch (err) {
        console.error("QR Scanner error:", err);
        
        if (!mounted) return;
        
        // Messages d'erreur personnalisés
        const errStr = err.toString();
        if (errStr.includes('NotAllowedError') || errStr.includes('Permission')) {
          setError("Camera access denied. Please allow camera access in your browser settings and try again.");
        } else if (errStr.includes('NotFoundError')) {
          setError("No camera found on this device.");
        } else if (errStr.includes('NotReadableError')) {
          setError("Camera is already in use by another application.");
        } else {
          setError("Unable to access camera. Please check permissions and try again.");
        }
        
        setIsScanning(false);
        setIsStarting(false);
      }
    };

    startScanner();

    // Cleanup
    return () => {
      mounted = false;
      stopScanner().catch(console.error);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFile = async (file) => {
    if (!file) return;
    try {
      setError(null);
      setIsStarting(true);
      const { Html5Qrcode } = await import("html5-qrcode");

      await stopScanner();

      const html5QrCode =
        html5QrCodeRef.current || new Html5Qrcode(readerIdRef.current);
      html5QrCodeRef.current = html5QrCode;

      const decodedText = await html5QrCode.scanFile(file, true);
      await stopScanner();
      onScan(decodedText);
    } catch (err) {
      console.error("QR scanFile error:", err);
      setError("Unable to decode this image. Try a clearer screenshot.");
      setIsStarting(false);
    }
  };

  const content = (
    <div className="fixed inset-0 z-[10100] flex items-center justify-center p-4 bg-black/95">
      <div className="relative w-full max-w-md bg-elevated border border-subtle rounded-2xl p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Title */}
        <h3 className="text-xl font-orbitron font-bold text-white mb-4 text-center">
          Scan QR Code
        </h3>

        {/* Scanner */}
        <div className="mb-4">
          <div 
            id={readerIdRef.current}
            className="rounded-lg overflow-hidden"
          />
        </div>

        {/* Fallback: upload image */}
        <div className="mb-4">
          <label className="block text-xs text-white/60 mb-2">
            Or upload a QR image (works even on HTTP):
          </label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:text-white/80 hover:file:bg-white/20"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-400 text-center mb-3">{error}</p>
            
            {/* Instructions pour activer la caméra */}
            <div className="text-left bg-black/40 rounded-lg p-3 mt-3">
              <p className="text-xs text-white/80 font-semibold mb-2">How to enable camera:</p>
              <ul className="text-xs text-white/60 space-y-1 list-disc list-inside">
                <li><strong>Chrome/Safari:</strong> Tap the 🔒 or ⓘ icon in address bar → Site Settings → Camera → Allow</li>
                <li><strong>Firefox:</strong> Tap the 🔒 icon → Permissions → Camera → Allow</li>
                <li>Then close and reopen this scanner</li>
              </ul>
            </div>
          </div>
        )}

        {/* Instructions */}
        {(isScanning || isStarting) && !error && (
          <div className="bg-xcannes-green/10 border border-xcannes-green/30 rounded-lg p-3">
            <p className="text-sm text-white/70 text-center">
              {isStarting ? "Starting camera..." : "Point your camera at a QR code"}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // Utiliser createPortal pour rendre dans document.body
  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
