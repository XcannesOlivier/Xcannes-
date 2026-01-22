/**
 * XummQRModal - Modal pour afficher QR code XUMM
 * Connexion wallet ou signature transaction
 */

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { apiUrl } from "@/lib/runtimeConfig";import { useTranslation } from "next-i18next";

export default function XummQRModal({
  isOpen,
  onClose,
  uuid,
  qrUrl,
  deepLink,
  type = 'connect', // 'connect' ou 'sign'
  onSuccess,
  status: statusProp,
  enablePolling = true,
  zIndexClassName = "z-50"
}) {const { t } = useTranslation("common");
  const [localStatus, setLocalStatus] = useState('loading'); // loading, waiting, signed, error
  const [localCountdown, setLocalCountdown] = useState(300); // 5 minutes
  const lastAutoOpenedRef = useRef(null);
  const isControlled = statusProp != null;
  const displayStatus = isControlled ? statusProp : localStatus;

  useEffect(() => {
    if (!isOpen || !uuid) {
      return undefined;
    }

    if (!isControlled) {
      setLocalStatus('waiting');
    }
    setLocalCountdown(300);

    let countdownInterval;

    const clearAll = () => {
      if (countdownInterval) clearInterval(countdownInterval);
    };

    if (displayStatus === 'waiting') {
      countdownInterval = setInterval(() => {
        setLocalCountdown((prev) => {
          if (prev <= 1) {
            clearAll();
            if (!isControlled) {
              setLocalStatus('error');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return clearAll;
  }, [displayStatus, isControlled, isOpen, uuid]);

  useEffect(() => {
    if (!isOpen || !uuid || isControlled || !enablePolling) {
      return undefined;
    }

    let pollingInterval;
    let pollingTimeout;

    const clearPolling = () => {
      if (pollingInterval) clearInterval(pollingInterval);
      if (pollingTimeout) clearTimeout(pollingTimeout);
    };

    pollingInterval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/xumm/check?uuid=${uuid}`));
        const data = await res.json();

        if (data.signed) {
          setLocalStatus('signed');
          clearPolling();
          if (onSuccess) {
            onSuccess(data);
          }
          setTimeout(() => {
            onClose();
          }, 2000);
        } else if (data.expired) {
          setLocalStatus('error');
          clearPolling();
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 2000); // Poll toutes les 2 secondes

    // Nettoyer après 5 minutes
    pollingTimeout = setTimeout(() => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    }, 300000);

    return clearPolling;
  }, [enablePolling, isControlled, isOpen, onClose, onSuccess, uuid]);

  const isMobileDevice = () => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isMobileUa = /android|iphone|ipad|ipod|mobile/i.test(ua);
    const isIpadOs = /Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1;
    return isMobileUa || isIpadOs;
  };
  const isMobile = isMobileDevice();

  const resolveXummLinks = () => {
    const raw = deepLink || (uuid ? `https://xumm.app/sign/${uuid}` : "");
    if (!raw) return { appLink: "", webLink: "" };
    const isScheme = /^xumm:\/\//i.test(raw) || /^xaman:\/\//i.test(raw);
    if (isScheme) {
      const webLink = raw.replace(/^xumm:\/\//i, "https://").replace(/^xaman:\/\//i, "https://");
      return { appLink: raw, webLink };
    }
    const scheme = /xaman/i.test(raw) ? "xaman://" : "xumm://";
    const appLink = raw.replace(/^https?:\/\//i, scheme);
    return { appLink, webLink: raw };
  };

  const openXummApp = ({ allowFallback = true } = {}) => {
    const { appLink, webLink } = resolveXummLinks();
    if (!appLink) return;
    let didHide = false;
    const onVisibility = () => {
      if (document.hidden) {
        didHide = true;
      }
    };
    document.addEventListener('visibilitychange', onVisibility, { once: true });
    window.location.href = appLink;
    if (allowFallback && webLink && webLink !== appLink) {
      setTimeout(() => {
        if (didHide || document.visibilityState !== 'visible') return;
        window.location.href = webLink;
      }, 1500);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      lastAutoOpenedRef.current = null;
      return;
    }

    if (!isMobile) return;
    if (!uuid && !deepLink) return;
    const marker = uuid || deepLink;
    if (lastAutoOpenedRef.current === marker) return;

    lastAutoOpenedRef.current = marker;
    const timer = setTimeout(() => {
      openXummApp({ allowFallback: false });
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen, isMobile, uuid, deepLink, type]);

  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center p-4 bg-black/80 md:backdrop-blur-sm`}>
      <div className="relative bg-elevated border border-subtle rounded-2xl p-6 max-w-md w-full shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors">

          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="text-center">
          {displayStatus === 'loading' &&
          <>
              <div className="w-16 h-16 border-4 border-xcannes-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-xl font-orbitron font-bold text-white mb-2">{t("ui_preparing_67f5f84ff4", "Preparing...")}

            </h3>
            </>
          }

          {displayStatus === 'waiting' &&
          <>
              <h3 className="text-2xl font-orbitron font-bold text-white mb-4">
                {type === 'connect' ? 'Connect Wallet' : 'Sign Transaction'}
              </h3>

              <p className="text-white/60 text-sm mb-6">{t("ui_scan_this_qr_code_with_xumm__a467eb8cd5", "Scan this QR code with XUMM app")}

            </p>

              {/* QR Code */}
              <div className="bg-white p-4 rounded-xl mb-6 inline-block">
                {uuid &&
              <Image
                src={qrUrl || `https://xumm.app/sign/${uuid}`}
                alt={t("ui_xumm_qr_code_282d93fd60", "XUMM QR Code")}
                width={256}
                height={256}
                unoptimized
                className="w-64 h-64 mx-auto" />

              }
              </div>

              {/* Deep Link Button */}
              {isMobile ?
            <button
              type="button"
              onClick={() => {
                openXummApp({ allowFallback: true });
              }}
              className="block w-full bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold py-3 rounded-lg transition-all mb-4">{t("ui_open_in_xumm_app_7606fbe837", "Open in XUMM App")}


            </button> :

            <a
              href={resolveXummLinks().webLink || `https://xumm.app/sign/${uuid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold py-3 rounded-lg transition-all mb-4">{t("ui_open_in_xumm_app_7606fbe837", "Open in XUMM App")}


            </a>
            }

              {/* Countdown */}
              <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t("ui_expires_in_969e0da47a", "Expires in")}{Math.floor(localCountdown / 60)}:{(localCountdown % 60).toString().padStart(2, '0')}</span>
              </div>

              {/* Instructions */}
              <div className="mt-6 text-left bg-white/5 rounded-lg p-4">
                <p className="text-xs text-white/60 mb-2">
                  <strong className="text-white/80">{t("ui_don_t_have_xumm_2d15c229cb", "Don’t have XUMM?")}</strong>
                </p>
                <ol className="text-xs text-white/60 space-y-1 list-decimal list-inside">
                  <li>{t("ui_download_xumm_from_app_store_37f4713089", "Download XUMM from App Store or Google Play")}</li>
                  <li>{t("ui_create_or_import_your_xrpl_w_beefeca97d", "Create or import your XRPL wallet")}</li>
                  <li>{t("ui_scan_this_qr_code_to_f780225746", "Scan this QR code to")}{type === 'connect' ? 'connect' : 'sign'}</li>
                </ol>
              </div>
            </>
          }

          {displayStatus === 'signed' &&
          <>
              <div className="w-20 h-20 bg-xcannes-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-xcannes-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h3 className="text-2xl font-orbitron font-bold text-white mb-2">{t("ui_success_aeeca91403", "Success! ✓")}

            </h3>

              <p className="text-white/60 text-sm">
                {type === 'connect' ? 'Wallet connected' : 'Transaction signed'}
              </p>
            </>
          }

          {displayStatus === 'error' &&
          <>
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>

              <h3 className="text-2xl font-orbitron font-bold text-white mb-2">{t("ui_expired_d6b299ad78", "Expired")}

            </h3>

              <p className="text-white/60 text-sm mb-4">{t("ui_the_request_has_expired_plea_1059f904c6", "The request has expired. Please try again.")}

            </p>

              <button
              onClick={onClose}
              className="w-full bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold py-3 rounded-lg transition-all">{t("ui_close_1726ddb05f", "Close")}


            </button>
            </>
          }
        </div>
      </div>
    </div>);

}
