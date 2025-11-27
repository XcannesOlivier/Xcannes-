/**
 * XummQRModal - Modal pour afficher QR code XUMM
 * Connexion wallet ou signature transaction
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';

const API_BASE = (process.env.NEXT_PUBLIC_XCANNES_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE}${path}`;

export default function XummQRModal({ 
  isOpen, 
  onClose, 
  uuid, 
  type = 'connect', // 'connect' ou 'sign'
  onSuccess,
}) {
  const [status, setStatus] = useState('loading'); // loading, waiting, signed, error
  const [countdown, setCountdown] = useState(300); // 5 minutes

  useEffect(() => {
    if (!isOpen || !uuid) {
      return undefined;
    }

    setStatus('waiting');
    setCountdown(300);

    let pollingInterval;
    let pollingTimeout;
    let countdownInterval;

    const clearAll = () => {
      if (pollingInterval) clearInterval(pollingInterval);
      if (pollingTimeout) clearTimeout(pollingTimeout);
      if (countdownInterval) clearInterval(countdownInterval);
    };

    pollingInterval = setInterval(async () => {
      try {
        const res = await fetch(apiUrl(`/xumm/check?uuid=${uuid}`));
        const data = await res.json();

        if (data.signed) {
          setStatus('signed');
          clearAll();
          if (onSuccess) {
            onSuccess(data);
          }
          setTimeout(() => {
            onClose();
          }, 2000);
        } else if (data.expired) {
          setStatus('error');
          clearAll();
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

    countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearAll();
          setStatus('error');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearAll;
  }, [isOpen, uuid, onClose, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="w-16 h-16 border-4 border-xcannes-green border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-xl font-orbitron font-bold text-white mb-2">
                Preparing...
              </h3>
            </>
          )}

          {status === 'waiting' && (
            <>
              <h3 className="text-2xl font-orbitron font-bold text-white mb-4">
                {type === 'connect' ? 'Connect Wallet' : 'Sign Transaction'}
              </h3>

              <p className="text-white/60 text-sm mb-6">
                Scan this QR code with XUMM app
              </p>

              {/* QR Code */}
              <div className="bg-white p-4 rounded-xl mb-6 inline-block">
                {uuid && (
                  <Image
                    src={`https://xumm.app/sign/${uuid}`}
                    alt="XUMM QR Code"
                    width={256}
                    height={256}
                    unoptimized
                    className="w-64 h-64 mx-auto"
                  />
                )}
              </div>

              {/* Deep Link Button */}
              <a
                href={`https://xumm.app/sign/${uuid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold py-3 rounded-lg transition-all mb-4"
              >
                Open in XUMM App
              </a>

              {/* Countdown */}
              <div className="flex items-center justify-center gap-2 text-white/40 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Expires in {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}</span>
              </div>

              {/* Instructions */}
              <div className="mt-6 text-left bg-white/5 rounded-lg p-4">
                <p className="text-xs text-white/60 mb-2">
                  <strong className="text-white/80">Don&rsquo;t have XUMM?</strong>
                </p>
                <ol className="text-xs text-white/60 space-y-1 list-decimal list-inside">
                  <li>Download XUMM from App Store or Google Play</li>
                  <li>Create or import your XRPL wallet</li>
                  <li>Scan this QR code to {type === 'connect' ? 'connect' : 'sign'}</li>
                </ol>
              </div>
            </>
          )}

          {status === 'signed' && (
            <>
              <div className="w-20 h-20 bg-xcannes-green/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-xcannes-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h3 className="text-2xl font-orbitron font-bold text-white mb-2">
                Success! ✓
              </h3>

              <p className="text-white/60 text-sm">
                {type === 'connect' ? 'Wallet connected' : 'Transaction signed'}
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>

              <h3 className="text-2xl font-orbitron font-bold text-white mb-2">
                Expired
              </h3>

              <p className="text-white/60 text-sm mb-4">
                The request has expired. Please try again.
              </p>

              <button
                onClick={onClose}
                className="w-full bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold py-3 rounded-lg transition-all"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
