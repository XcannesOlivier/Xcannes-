/**
 * Page d'annulation de paiement Stripe
 */

import Link from 'next/link';

export default function CancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Cancel Card */}
        <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-3xl font-orbitron font-bold text-white mb-2">
            Payment Cancelled
          </h1>
          
          <p className="text-white/60 mb-6">
            Your payment was cancelled. No charges were made to your card.
          </p>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <p className="text-sm text-white/80 font-semibold mb-1">
                  Want to try again?
                </p>
                <p className="text-xs text-white/60">
                  You can purchase XCS tokens anytime. We accept Visa, Mastercard, and Apple Pay.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link href="/dex">
              <a className="block w-full bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold py-3 rounded-lg transition-all">
                Try Again
              </a>
            </Link>

            <Link href="/">
              <a className="block w-full bg-white/5 hover:bg-white/10 text-white font-semibold py-3 rounded-lg transition-all">
                Return Home
              </a>
            </Link>
          </div>
        </div>

        {/* Support Link */}
        <div className="text-center mt-6">
          <p className="text-sm text-white/40">
            Questions? <a href="mailto:support@xcannes.com" className="text-xcannes-green hover:underline">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
}
