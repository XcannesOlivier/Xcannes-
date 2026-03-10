"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import { useModalTransition } from "@/hooks/useModalTransition";
import { normalizeQrImageFile } from "@/utils/qrImage";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

export default function QRScanner({
  isOpen,
  onScan,
  onClose,
  embedded = false,
  showClose = true,
  hideTitle = false,
  className = "",
  fileInputId,
  enableCamera = true,
  showStaticImage = false,
  staticImageSrc = "",
  staticImageAlt = "",
  staticContent = null,
  staticContentClassName = "",
  staticFooter = null,
  staticFooterClassName = "",
  staticOverlay = null,
  staticOverlayClassName = "",
  showFileInputWhenStatic = false,
  showFauxQrBackground = false,
  fauxQrBackgroundSize = "240px",
  fauxQrBackgroundOpacity = 0.08,
  hideWhenUnavailable = false,
  onCameraUnavailableChange = null,
}) {
  const { t } = useTranslation("common");
  const html5QrCodeRef = useRef(null);
  const readerIdRef = useRef(
    `qr-reader-${Math.random().toString(36).slice(2, 10)}`,
  );
  const readerElRef = useRef(null);
  const activeRef = useRef(false);
  const lastDecodedRef = useRef("");
  const [error, setError] = useState(null);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [qrBoxSize, setQrBoxSize] = useState(0);

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
    setQrBoxSize(0);
  };

  const cameraEnabled = enableCamera && !showStaticImage;

  useEffect(() => {
    if (typeof onCameraUnavailableChange === "function") {
      onCameraUnavailableChange(cameraUnavailable);
    }
  }, [cameraUnavailable, onCameraUnavailableChange]);

  useEffect(() => {
    if (!isOpen) {
      // Cleanup when closing
      stopScanner().catch(console.error);
      setError(null);
      setCameraUnavailable(false);
      setIsScanning(false);
      setIsStarting(false);
      lastDecodedRef.current = "";
      setQrBoxSize(0);
      return;
    }

    if (!cameraEnabled) {
      stopScanner().catch(console.error);
      setError(null);
      setCameraUnavailable(false);
      setIsScanning(false);
      setIsStarting(false);
      lastDecodedRef.current = "";
      setQrBoxSize(0);
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
            t(
              "ui_camera_blocked_http_7d6a0c9b2e",
              "Camera is blocked on HTTP. Use HTTPS (or localhost) or upload a QR image below.",
            ),
          );
          setCameraUnavailable(true);
          setIsScanning(false);
          return;
        }

        if (!navigator?.mediaDevices?.getUserMedia) {
          setError(
            t(
              "ui_camera_unavailable_device_4f2a90f1c3",
              "Camera is not available on this device. You can upload a QR image below.",
            ),
          );
          setCameraUnavailable(true);
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

        const viewW = window.innerWidth || 360;
        const viewH = window.innerHeight || 640;
        const readerEl =
          readerElRef.current || document.getElementById(readerIdRef.current);
        const containerW = readerEl?.clientWidth || 0;
        const containerH = readerEl?.clientHeight || 0;
        const baseW = containerW > 0 ? containerW : Math.min(viewW, viewH);
        const baseH = containerH > 0 ? containerH : Math.min(viewW, viewH);
        const boxSize = Math.floor(Math.min(baseW, baseH) * 0.7);
        setQrBoxSize(boxSize);
        let cameraIdOrConfig = { facingMode: "environment" };
        try {
          const devices = await Html5Qrcode.getCameras();
          if (Array.isArray(devices) && devices.length > 0) {
            const labeled = devices.filter((d) => (d?.label || "").trim());
            const backMatch =
              labeled.find((d) =>
                /back|rear|environment/i.test(d.label || ""),
              ) || null;
            if (backMatch?.id) {
              cameraIdOrConfig = backMatch.id;
            } else if (devices.length === 1) {
              cameraIdOrConfig = devices[0].id;
            } else {
              cameraIdOrConfig = devices[devices.length - 1].id;
            }
          }
        } catch {
          // fallback to facingMode
        }

        await html5QrCode.start(
          cameraIdOrConfig,
          {
            fps: 25,
            qrbox: { width: boxSize, height: boxSize },
            aspectRatio: 1.0,
            disableFlip: false,
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          },
          (decodedText) => {
            // QR code scanné avec succès
            if (DEBUG_LOGS) {
              console.log("QR Code scanned:", decodedText);
            }

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
          },
        );

        activeRef.current = true;
        setIsStarting(false);
        setIsScanning(true);
        setCameraUnavailable(false);
        try {
          // Moderate zoom to balance between close-up QR codes and larger/dense payreq QR codes
          const desiredZoom = 1.8;
          const caps = html5QrCode.getRunningTrackCameraCapabilities?.();
          const zoomFeature = caps?.zoomFeature?.();
          if (zoomFeature && zoomFeature.isSupported()) {
            const min = zoomFeature.min();
            const max = zoomFeature.max();
            const clipped = Math.min(max, Math.max(min, desiredZoom));
            await zoomFeature.apply(clipped);
          } else {
            await html5QrCode.applyVideoConstraints?.({
              advanced: [{ zoom: desiredZoom }],
            });
          }
        } catch {
          // ignore zoom errors
        }
      } catch (err) {
        console.error("QR Scanner error:", err);

        if (!mounted) return;

        // Messages d'erreur personnalisés
        const errStr = err.toString();
        if (
          errStr.includes("NotAllowedError") ||
          errStr.includes("Permission")
        ) {
          setError(
            t(
              "ui_camera_access_denied_5b9f8c2a10",
              "Camera access denied. Please allow camera access in your browser settings and try again.",
            ),
          );
          setCameraUnavailable(true);
        } else if (errStr.includes("NotFoundError")) {
          setError(
            t(
              "ui_camera_not_found_9a1c3b4d5e",
              "No camera found on this device.",
            ),
          );
          setCameraUnavailable(true);
        } else if (errStr.includes("NotReadableError")) {
          setError(
            t(
              "ui_camera_in_use_6d8f2a1c0b",
              "Camera is already in use by another application.",
            ),
          );
          setCameraUnavailable(true);
        } else {
          setError(
            t(
              "ui_camera_access_failed_2c4e6f8a1b",
              "Unable to access camera. Please check permissions and try again.",
            ),
          );
          setCameraUnavailable(true);
        }

        setIsScanning(false);
        setIsStarting(false);
        setQrBoxSize(0);
      }
    };

    startScanner();

    // Cleanup
    return () => {
      mounted = false;
      stopScanner().catch(console.error);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraEnabled, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const el = readerElRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const updateSize = (width, height) => {
      if (!width || !height) return;
      const next = Math.floor(Math.min(width, height) * 0.7);
      setQrBoxSize((prev) => (prev !== next ? next : prev));
    };
    const observer = new ResizeObserver((entries) => {
      const entry = entries?.[0];
      if (!entry) return;
      const rect = entry.contentRect;
      updateSize(rect.width, rect.height);
    });
    observer.observe(el);
    updateSize(el.clientWidth, el.clientHeight);
    return () => observer.disconnect();
  }, [isOpen]);

  const shouldAnimate = !embedded;
  const { shouldRender, isClosing } = useModalTransition(isOpen, {
    enabled: shouldAnimate,
  });

  if (embedded) {
    if (!isOpen) return null;
  } else if (!shouldRender) {
    return null;
  }

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

      let scanFile = file;
      try {
        scanFile = await normalizeQrImageFile(file, { maxDimension: 1600 });
      } catch {
        scanFile = file;
      }
      const decodedText = await html5QrCode.scanFile(scanFile, true);
      await stopScanner();
      onScan(decodedText);
    } catch (err) {
      console.error("QR scanFile error:", err);
      setError(
        t(
          "ui_qr_decode_failed_3b5d7f9a2c",
          "Unable to decode this image. Try a clearer screenshot.",
        ),
      );
      setIsStarting(false);
    }
  };

  const resolvedFileInputId = fileInputId || `${readerIdRef.current}-file`;

  const fauxQrBackground =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 22 22' shape-rendering='crispEdges'%3E%3Crect width='22' height='22' fill='none'/%3E%3Crect x='0' y='0' width='6' height='6' fill='%23fff'/%3E%3Crect x='16' y='0' width='6' height='6' fill='%23fff'/%3E%3Crect x='0' y='16' width='6' height='6' fill='%23fff'/%3E%3Crect x='8' y='2' width='1' height='1' fill='%23fff'/%3E%3Crect x='10' y='3' width='1' height='1' fill='%23fff'/%3E%3Crect x='12' y='2' width='1' height='1' fill='%23fff'/%3E%3Crect x='9' y='5' width='1' height='1' fill='%23fff'/%3E%3Crect x='11' y='6' width='1' height='1' fill='%23fff'/%3E%3Crect x='14' y='8' width='1' height='1' fill='%23fff'/%3E%3Crect x='7' y='9' width='1' height='1' fill='%23fff'/%3E%3Crect x='9' y='11' width='1' height='1' fill='%23fff'/%3E%3Crect x='12' y='11' width='1' height='1' fill='%23fff'/%3E%3Crect x='15' y='12' width='1' height='1' fill='%23fff'/%3E%3Crect x='8' y='14' width='1' height='1' fill='%23fff'/%3E%3Crect x='10' y='14' width='1' height='1' fill='%23fff'/%3E%3Crect x='12' y='15' width='1' height='1' fill='%23fff'/%3E%3Crect x='16' y='16' width='1' height='1' fill='%23fff'/%3E%3Crect x='18' y='17' width='1' height='1' fill='%23fff'/%3E%3Crect x='17' y='18' width='1' height='1' fill='%23fff'/%3E%3Crect x='12' y='18' width='1' height='1' fill='%23fff'/%3E%3Crect x='9' y='18' width='1' height='1' fill='%23fff'/%3E%3C/svg%3E";
  const showEmbeddedFauxQr =
    embedded && showFauxQrBackground && !showStaticImage;
  const showStaticQr = showStaticImage && (staticImageSrc || staticContent);
  const hideReader = hideWhenUnavailable && cameraUnavailable;
  const hideScannerCard =
    hideWhenUnavailable && cameraUnavailable && !showStaticQr;

  const scannerCard = (
    <div
      className={[
        embedded
          ? "relative rounded-xl border border-white/10 bg-black/20 p-4"
          : "relative w-full max-w-md bg-[#0b0f10] border border-white/10 rounded-2xl p-6 shadow-2xl",
        showEmbeddedFauxQr ? "overflow-hidden" : "",
        embedded ? "wallet-inline-zoom-in" : "",
        !embedded
          ? isClosing
            ? "wallet-modal-lift-out"
            : "wallet-modal-lift-in"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {showEmbeddedFauxQr ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none bg-center bg-no-repeat"
          style={{
            backgroundImage: `url("${fauxQrBackground}")`,
            backgroundSize: `${fauxQrBackgroundSize} ${fauxQrBackgroundSize}`,
            opacity: fauxQrBackgroundOpacity,
          }}
        />
      ) : null}
      <div className={showEmbeddedFauxQr ? "relative z-10" : ""}>
        {/* Close Button */}
        {showClose && onClose ? (
          <button
            onClick={onClose}
            className={
              embedded
                ? "absolute top-3 right-3 text-white/60 hover:text-white transition-colors"
                : "absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
            }
          >
            <svg
              className={embedded ? "w-5 h-5" : "w-6 h-6"}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        ) : null}

        {/* Title */}
        {!hideTitle ? (
          <h3
            className={
              embedded
                ? "text-sm md:text-base font-orbitron font-bold text-white mb-3"
                : "text-xl font-orbitron font-bold text-white mb-4 text-center"
            }
          >
            {t("ui_scan_qr_code_481606b590", "Scan QR Code")}
          </h3>
        ) : null}

        {/* Scanner / Static Demo */}
        {showStaticQr ? (
          <div className="mb-4 space-y-3">
            <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/40">
              {staticContent ? (
                <div
                  className={[
                    "flex items-center justify-center p-3",
                    staticContentClassName,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {staticContent}
                </div>
              ) : (
                <Image
                  src={staticImageSrc}
                  alt={
                    staticImageAlt ||
                    t("ui_scan_qr_code_481606b590", "Scan QR Code")
                  }
                  width={640}
                  height={640}
                  sizes="100vw"
                  unoptimized
                  className="block w-full h-auto"
                />
              )}
              {staticOverlay ? (
                <div
                  className={["absolute inset-0", staticOverlayClassName]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {staticOverlay}
                </div>
              ) : null}
            </div>
            {staticFooter ? (
              <div className={staticFooterClassName}>{staticFooter}</div>
            ) : null}
          </div>
        ) : hideReader ? null : (
          <div className="mb-4">
            <div
              ref={readerElRef}
              className="relative w-[90%] mx-auto rounded-lg overflow-hidden"
            >
              <div id={readerIdRef.current} className="w-full h-full" />
              {!showStaticQr && qrBoxSize > 0 && (isScanning || isStarting) ? (
                <div
                  className="pointer-events-none absolute left-1/2 top-1/2 z-10"
                  style={{
                    width: `${qrBoxSize}px`,
                    height: `${qrBoxSize}px`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <span className="absolute -top-1 -left-1 h-6 w-6 border-t-[3px] border-l-[3px] border-[#22C55E]/90 rounded-tl-md" />
                  <span className="absolute -top-1 -right-1 h-6 w-6 border-t-[3px] border-r-[3px] border-[#22C55E]/90 rounded-tr-md" />
                  <span className="absolute -bottom-1 -left-1 h-6 w-6 border-b-[3px] border-l-[3px] border-[#22C55E]/90 rounded-bl-md" />
                  <span className="absolute -bottom-1 -right-1 h-6 w-6 border-b-[3px] border-r-[3px] border-[#22C55E]/90 rounded-br-md" />
                  {/* Animated scan line */}
                  <span
                    className="absolute left-1 right-1 h-[2px] rounded-full"
                    style={{
                      background: "linear-gradient(90deg, transparent 0%, #22C55E 30%, #22C55E 70%, transparent 100%)",
                      boxShadow: "0 0 8px 2px rgba(34,197,94,0.4)",
                      animation: "qr-scanline 2.2s ease-in-out infinite",
                    }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Fallback: upload image */}
        {!showStaticQr && !embedded ? (
          <div className="mb-4">
            <label className="sr-only">
              {t(
                "ui_or_upload_a_qr_image_works_e_df6baa8039",
                "Or upload a QR image (works even on HTTP):",
              )}
            </label>
            <input
              id={resolvedFileInputId}
              type="file"
              accept="image/*"
              className="w-full text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:text-white/80 hover:file:bg-white/20"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
          </div>
        ) : !showStaticQr || showFileInputWhenStatic ? (
          <input
            id={resolvedFileInputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0] || null)}
          />
        ) : null}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-400 text-center mb-3">{error}</p>

            {/* Instructions pour activer la caméra */}
            <div className="text-left bg-black/40 rounded-lg p-3 mt-3">
              <p className="text-xs text-white/80 font-semibold mb-2">
                {t(
                  "ui_how_to_enable_camera_c08cd802b3",
                  "How to enable camera:",
                )}
              </p>
              <ul className="text-xs text-white/60 space-y-1 list-disc list-inside">
                <li>
                  <strong>
                    {t("ui_chrome_safari_ccea2d8ed8", "Chrome/Safari:")}
                  </strong>
                  {t(
                    "ui_tap_the_or_icon_in_address_b_a73a7d8dd4",
                    "Tap the 🔒 or ⓘ icon in address bar → Site Settings → Camera → Allow",
                  )}
                </li>
                <li>
                  <strong>{t("ui_firefox_c359393414", "Firefox:")}</strong>
                  {t(
                    "ui_tap_the_icon_permissions_cam_3c2f8b49ec",
                    "Tap the 🔒 icon → Permissions → Camera → Allow",
                  )}
                </li>
                <li>
                  {t(
                    "ui_then_close_and_reopen_this_s_8c994bb219",
                    "Then close and reopen this scanner",
                  )}
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* Instructions */}
        {(isScanning || isStarting) && !error && !showStaticQr && (
          <div className="bg-xcannes-green/10 border border-xcannes-green/30 rounded-lg p-3">
            <p className="text-sm text-white/70 text-center">
              {isStarting
                ? "Starting camera..."
                : "Point your camera at a QR code"}
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const scannerStyles = (
    <style jsx>{`
      @keyframes xcannes-scanline {
        0% {
          transform: translateY(0);
          opacity: 0.3;
        }
        50% {
          opacity: 0.9;
        }
        100% {
          transform: translateY(calc(100% - 2px));
          opacity: 0.3;
        }
      }
    `}</style>
  );

  if (embedded) {
    if (hideScannerCard) return null;
    return (
      <>
        {scannerCard}
        {scannerStyles}
      </>
    );
  }

  const content = (
    <div
      className={`fixed inset-0 z-[10100] flex items-center justify-center p-4 bg-black/95 ${
        isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
      }`}
    >
      {scannerCard}
      {scannerStyles}
    </div>
  );

  if (hideScannerCard) return null;
  // Utiliser createPortal pour rendre dans document.body
  return typeof document !== "undefined"
    ? createPortal(content, document.body)
    : null;
}
