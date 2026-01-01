"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Html5Qrcode } from "html5-qrcode";

export default function QRScanner({ isOpen, onScan, onClose }) {
  const html5QrCodeRef = useRef(null);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Cleanup when closing
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
      setError(null);
      setIsScanning(false);
      return;
    }

    let mounted = true;

    const startScanner = async () => {
      try {
        if (!mounted) return;
        
        setError(null);
        setIsScanning(true);

        // Wait for DOM to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        if (!mounted) return;

        // Create scanner instance
        const html5QrCode = new Html5Qrcode("qr-reader");
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
            
            // Stop scanner before calling onScan
            if (html5QrCode.isScanning) {
              html5QrCode.stop().then(() => {
                onScan(decodedText);
              }).catch(console.error);
            }
          },
          () => {
            // Erreur de scan continue - normal, ne rien faire
          }
        );
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
      }
    };

    startScanner();

    // Cleanup
    return () => {
      mounted = false;
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, [isOpen, onScan]);

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[10100] flex items-center justify-center p-4 bg-black/95">
      <div className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-6">
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
            id="qr-reader" 
            className="rounded-lg overflow-hidden"
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
        {isScanning && !error && (
          <div className="bg-xcannes-green/10 border border-xcannes-green/30 rounded-lg p-3">
            <p className="text-sm text-white/70 text-center">
              Point your camera at a QR code
            </p>
          </div>
        )}
      </div>
    </div>
  );

  // Utiliser createPortal pour rendre dans document.body
  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
