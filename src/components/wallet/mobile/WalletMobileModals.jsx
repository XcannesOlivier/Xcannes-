/**
 * WalletMobileModals
 * ------------------
 * Version mobile (portalisée dans document.body) de toutes les modales
 * du wallet. Les props universelles sont fournies par useWalletModalProps.
 *
 * Inclut également les modales (Info, Activation, ActivationRequest, RLUSD
 * setup) rendues sans portal mais uniquement en mode mobile (sous le header),
 * le QR Scanner mobile, le prompt de sauvegarde d'adresse, et le
 * WalletDashboardStatementModals mobile.
 */

import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";

const INITIAL_SCAN_DRAG_META = { startY: 0, startAt: 0, pointerId: null, lastDelta: 0, pending: false, dragging: false };

const INITIAL_USD_SWAP_STATE = {
  prefillAmount: "",
  accentVariant: "",
  sourceSelectionMode: "",
  initialSourceCurrency: "",
  targetSelectionMode: "",
  initialTargetCurrency: "",
  titleOverride: "",
  subtitleOverride: "",
};
import QRScanner from "../components/QRScanner";
import WalletDashboardSendModal from "../modals/WalletDashboardSendModal";
import WalletDashboardReceiveModal from "../modals/WalletDashboardReceiveModal";
import WalletDashboardSwapModal from "../modals/WalletDashboardSwapModal";
import WalletDashboardCashChoiceModal from "../modals/WalletDashboardCashChoiceModal";
import WalletDashboardSendChoiceModal from "../modals/WalletDashboardSendChoiceModal";
import WalletDashboardUsdSwapModal from "../modals/WalletDashboardUsdSwapModal";
import WalletDashboardCashModal from "../modals/WalletDashboardCashModal";
import WalletActivationModal from "../modals/WalletActivationModal";
import WalletActivationRequestModal from "../modals/WalletActivationRequestModal";
import WalletInfoModal from "../modals/WalletInfoModal";
import WalletDashboardStatementModals from "../modals/WalletDashboardStatementModals";
import WalletDashboardSaveAddressPrompt from "../components/WalletDashboardSaveAddressPrompt";

export default function WalletMobileModals({
  // shared modal prop bundles (from useWalletModalProps)
  sendModalProps,
  receiveModalProps,
  swapModalProps,
  cashModalProps,
  activationModalProps,
  activationRequestModalProps,
  infoModalProps,
  statementSharedProps,
  signTransaction,

  // open/close handlers
  activeAction,
  setActiveAction,
  showActivationModal,
  setShowActivationModal,
  showActivationRequestModal,
  setShowActivationRequestModal,
  walletInfoOpen,
  setWalletInfoOpen,
  setCashBuyPrefill,
  setCashSellSelectTitleOverride,
  setCashSellDestinationMode,
  resetSendForm,
  resetReceiveForm,
  resetSwapForm,
  resetCashForm,

  // QR scanner
  qrScannerOpen,
  setQrScannerOpen,
  handleAddressScan,
  handlePaymentRequestScan,

  // Save address prompt
  showSaveAddressPrompt,
  setShowSaveAddressPrompt,
  addressToSave,
  setAddressToSave,
  saveAddress,

  // toast
  toast,

  // mobile cash uses augmentedTokens (not selectableTokens)
  augmentedTokens,
}) {
  const [usdSwapState, setUsdSwapState] = useState(INITIAL_USD_SWAP_STATE);
  const {
    prefillAmount: usdSwapPrefillAmount,
    accentVariant: usdSwapAccentVariant,
    sourceSelectionMode: usdSwapSourceSelectionMode,
    initialSourceCurrency: usdSwapInitialSourceCurrency,
    targetSelectionMode: usdSwapTargetSelectionMode,
    initialTargetCurrency: usdSwapInitialTargetCurrency,
    titleOverride: usdSwapTitleOverride,
    subtitleOverride: usdSwapSubtitleOverride,
  } = usdSwapState;

  const openUsdSwapOut = useCallback(
    (amount, options = {}) => {
      setUsdSwapState({
        prefillAmount: amount == null ? "" : String(amount),
        accentVariant: String(options?.accentVariant || "").trim(),
        sourceSelectionMode: String(options?.sourceSelectionMode || "").trim(),
        initialSourceCurrency: String(options?.initialSourceCurrency || "").trim(),
        targetSelectionMode: String(options?.targetSelectionMode || "").trim(),
        initialTargetCurrency: String(options?.initialTargetCurrency || "").trim(),
        titleOverride: String(options?.titleOverride || "").trim(),
        subtitleOverride: String(options?.subtitleOverride || "").trim(),
      });
      const dir = String(options?.direction || "").trim().toLowerCase();
      setActiveAction?.(dir === "stable_to_rlusd" ? "cashUsdSwapIn" : "cashUsdSwapOut");
    },
    [setActiveAction],
  );

  /* ── QR Scanner swipe-to-close (mobile) ── */

  const handleQrScanResult = useCallback((data, callbackRef) => {
    setQrScannerOpen(false);
    setActiveAction('sendChoice');
    setTimeout(() => { callbackRef.__inject?.(data); }, 120);
  }, [setQrScannerOpen, setActiveAction]);
  const [scanDragging, setScanDragging] = useState(false);
  const [scanTranslateY, setScanTranslateY] = useState(0);
  const scanOverlayRef = useRef(null);
  const scanDragMeta = useRef({ ...INITIAL_SCAN_DRAG_META });
  const scanCloseRequested = useRef(false);
  const scanFromSendChoiceRef = useRef(false);
  const qrScanResultCallbackRef = useRef(null);
  const scanFromPayreqRef = useRef(false);
  const qrPayreqResultCallbackRef = useRef(null);

  useEffect(() => {
    if (qrScannerOpen) {
      scanCloseRequested.current = false;
      setScanDragging(false);
      setScanTranslateY(0);
      scanDragMeta.current = { ...INITIAL_SCAN_DRAG_META };
    } else {
      setScanDragging(false);
      if (!scanCloseRequested.current) setScanTranslateY(0);
      scanDragMeta.current = { ...INITIAL_SCAN_DRAG_META };
    }
  }, [qrScannerOpen]);

  const scanSwipeStart = (event) => {
    if (!event?.isPrimary) return;
    if (event.pointerType === "mouse") return;
    scanDragMeta.current = { startY: event.clientY, startAt: Date.now(), pointerId: event.pointerId, lastDelta: 0, pending: true, dragging: false };
  };
  const scanSwipeMove = (event) => {
    const m = scanDragMeta.current;
    if (!m.pending && !m.dragging) return;
    if (m.pointerId !== event.pointerId) return;
    const delta = event.clientY - m.startY;
    if (delta <= 0) return;
    if (!m.dragging) {
      if (delta < 8) return;
      try { scanOverlayRef.current?.setPointerCapture?.(event.pointerId); } catch { /* */ }
      m.dragging = true;
      setScanDragging(true);
    }
    m.lastDelta = delta;
    setScanTranslateY(delta);
  };
  const scanSwipeEnd = (event) => {
    const m = scanDragMeta.current;
    if (m.pointerId !== event.pointerId) return;
    const delta = m.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (m.startAt || 0));
    const velocity = delta / duration;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    const closeDistance = Math.max(220, Math.min(320, h * 0.28));
    const shouldClose = delta > closeDistance || (delta > closeDistance * 0.6 && velocity > 1.25);
    m.pending = false;
    m.dragging = false;
    setScanDragging(false);
    if (shouldClose) {
      if (!scanCloseRequested.current) {
        scanCloseRequested.current = true;
        setScanTranslateY(Math.max(delta, h));
        window.setTimeout(() => { setQrScannerOpen(false); }, 180);
      }
      return;
    }
    setScanTranslateY(0);
    scanDragMeta.current = { ...INITIAL_SCAN_DRAG_META };
  };

  return (
    <>
      {/* Modales non-portalisées, affichées sous le header en mobile */}
      <WalletInfoModal
        isOpen={walletInfoOpen}
        onClose={() => {
          setWalletInfoOpen(false);
          try {
            if (
              typeof window !== "undefined" &&
              window.__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__
            ) {
              window.__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__ = false;
              window.dispatchEvent(
                new CustomEvent("xcannes:wallet-settings-open"),
              );
            }
          } catch {
            // ignore
          }
        }}
        {...infoModalProps}
      />
      <WalletActivationModal
        open={showActivationModal}
        onClose={() => setShowActivationModal(false)}
        {...activationModalProps}
      />
      <WalletActivationRequestModal
        open={showActivationRequestModal}
        onClose={() => setShowActivationRequestModal(false)}
        {...activationRequestModalProps}
      />

      {/* Modales via Portal pour éviter les problèmes de z-index et overflow */}
      {typeof document !== "undefined" &&
        createPortal(
          <>
            <WalletDashboardSendChoiceModal
              open={activeAction === "sendChoice"}
              onClose={() => {
                setActiveAction(null);
              }}
              onChooseQuickScan={() => {
                scanFromSendChoiceRef.current = true;
                setActiveAction(null);
                setQrScannerOpen(true);
              }}
              onChoosePayreqScan={() => {
                scanFromPayreqRef.current = true;
                setActiveAction(null);
                setQrScannerOpen(true);
              }}
              onChooseSimpleSend={() => {
                setActiveAction("send");
              }}
              onChoosePayRequest={() => {
                setActiveAction("send");
              }}
              handlePaymentRequestScan={sendModalProps?.handlePaymentRequestScan}
              setSendDestination={sendModalProps?.setSendDestination}
              setSendDestinationLabel={sendModalProps?.setSendDestinationLabel}
              savedAddresses={sendModalProps?.savedAddresses}
              currentWalletAddress={sendModalProps?.currentWalletAddress}
              toast={sendModalProps?.toast}
              renderWalletMeta={sendModalProps?.renderWalletMeta}
              onQrScanResult={qrScanResultCallbackRef}
              onQrPayreqScanResult={qrPayreqResultCallbackRef}
            />

            <WalletDashboardSendModal
              open={activeAction === "send"}
              onClose={() => {
                resetSendForm?.();
                setActiveAction(null);
              }}
              onBack={() => {
                resetSendForm?.();
                setActiveAction("sendChoice");
              }}
              {...sendModalProps}
            />

            <WalletDashboardReceiveModal
              open={activeAction === "receive"}
              onClose={() => {
                resetReceiveForm?.();
                setActiveAction(null);
              }}
              {...receiveModalProps}
            />

            <WalletDashboardSwapModal
              open={activeAction === "swap"}
              onClose={() => {
                resetSwapForm?.();
                setActiveAction(null);
              }}
              {...swapModalProps}
            />

	            <WalletDashboardCashChoiceModal
	              open={activeAction === "cashChoice"}
	              walletLabel={cashModalProps?.walletLabel || ""}
	              onClose={() => {
	                resetCashForm?.();
	                setActiveAction((prev) => (prev === "cashChoice" ? null : prev));
	                setCashBuyPrefill(null);
	              }}
		              onChooseBuy={() => {
		                setCashSellSelectTitleOverride?.("");
		                setCashSellDestinationMode?.("");
		                setCashBuyPrefill(null);
		                cashModalProps?.setCashModalTab?.("buy");
		                setActiveAction("cash");
		              }}
		              onChooseSell={() => {
		                setCashSellSelectTitleOverride?.("");
		                setCashSellDestinationMode?.("");
		                setCashBuyPrefill(null);
		                cashModalProps?.setCashModalTab?.("sell");
		                setActiveAction("cash");
		              }}
		              onChooseUsdSwapOut={() => {
		                setCashSellSelectTitleOverride?.("");
		                setCashSellDestinationMode?.("");
		                setCashBuyPrefill(null);
		                openUsdSwapOut("", {
		                  direction: "stable_to_rlusd",
		                  accentVariant: "simpleSwapBlue",
		                  targetSelectionMode: "wallet",
		                  initialTargetCurrency: "USD",
		                  titleOverride: "Vendre vos USDC, USDT, RLUSD, ...",
			                  subtitleOverride:
			                    "Sélectionnez le stablecoin, le réseau et la devise qui sera créditée sur votre solde.",
			                });
			              }}
		              onChooseUsdSwapIn={() => {
		                setCashSellSelectTitleOverride?.("");
		                setCashSellDestinationMode?.("");
		                setCashBuyPrefill(null);
		                openUsdSwapOut("", {
		                  direction: "rlusd_to_stable",
		                  accentVariant: "binanceYellow",
		                  sourceSelectionMode: "wallet",
		                  initialSourceCurrency: "USD",
			                  titleOverride: "Acheter des stablecoins",
			                  subtitleOverride:
			                    "Choisissez la devise, le montant et le stablecoin.",
			                });
			              }}
	            />

            <WalletDashboardUsdSwapModal
              open={
                activeAction === "cashUsdSwapOut" || activeAction === "cashUsdSwapIn"
              }
              onClose={() => {
                setUsdSwapState(INITIAL_USD_SWAP_STATE);
                setActiveAction(null);
              }}
              walletLabel={cashModalProps?.walletLabel || ""}
              walletAddress={cashModalProps?.walletAddress || ""}
              initialDirection={
                activeAction === "cashUsdSwapIn" ? "stable_to_rlusd" : "rlusd_to_stable"
              }
              initialAmount={usdSwapPrefillAmount}
              accentVariant={usdSwapAccentVariant}
              sourceSelectionMode={usdSwapSourceSelectionMode}
              initialSourceCurrency={usdSwapInitialSourceCurrency}
              targetSelectionMode={usdSwapTargetSelectionMode}
              initialTargetCurrency={usdSwapInitialTargetCurrency}
              titleOverride={usdSwapTitleOverride}
              subtitleOverride={usdSwapSubtitleOverride}
              signTransaction={signTransaction}
              availableTokens={augmentedTokens}
              rlusdPerUnitRates={cashModalProps?.rlusdPerUnitRates}
              selectLabelByCurrency={cashModalProps?.selectLabelByCurrency}
              selectLabelRightByCurrency={cashModalProps?.selectLabelRightByCurrency}
              selectIconByCurrency={cashModalProps?.selectIconByCurrency}
            />

            <WalletDashboardCashModal
              open={activeAction === "cash"}
              onClose={() => {
                resetCashForm?.();
                setActiveAction(null);
                setCashBuyPrefill(null);
              }}
              {...cashModalProps}
              signTransaction={signTransaction}
              availableTokens={augmentedTokens}
              onOpenUsdSwapOut={openUsdSwapOut}
            />
          </>,
          document.body,
        )}

      {/* QR Scanner Modal for Address */}
      {qrScannerOpen
        ? createPortal(
            <div className="fixed inset-0 z-[10100] flex flex-col">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-[#101415] backdrop-blur-sm"
                onClick={() => setQrScannerOpen(false)}
                style={
                  scanTranslateY > 0
                    ? { opacity: Math.max(0, Math.min(1, 1 - scanTranslateY / 420)) }
                    : undefined
                }
              />
              {/* Swipeable scanner wrapper */}
              <div
                ref={scanOverlayRef}
                className="relative flex-1 flex flex-col items-center justify-center"
                style={{
                  transform: `translateY(${Math.max(0, scanTranslateY)}px)`,
                  transition: scanDragging ? "none" : "transform 220ms cubic-bezier(0.2,0,0,1)",
                  willChange: scanTranslateY ? "transform" : undefined,
                  touchAction: "none",
                }}
                onPointerDown={scanSwipeStart}
                onPointerMove={scanSwipeMove}
                onPointerUp={scanSwipeEnd}
                onPointerCancel={scanSwipeEnd}
              >
                {/* Swipe bar (mobile only) */}
                <div className="md:hidden flex justify-center pt-3 pb-2" aria-hidden>
                  <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                </div>
                <div className="flex-1 w-full">
                  <QRScanner
                    isOpen={true}
                    onScan={(data) => {
                      if (scanFromPayreqRef.current) {
                        scanFromPayreqRef.current = false;
                        handleQrScanResult(data, qrPayreqResultCallbackRef);
                        return;
                      }
                      if (scanFromSendChoiceRef.current) {
                        scanFromSendChoiceRef.current = false;
                        handleQrScanResult(data, qrScanResultCallbackRef);
                        return;
                      }
                      const result = handlePaymentRequestScan?.(data);
                      if (result?.relayChallenge || result?.navigate) {
                        setQrScannerOpen(false);
                        return;
                      }
                      if (handlePaymentRequestScan) {
                        setActiveAction?.("send");
                        setQrScannerOpen(false);
                        return;
                      }
                      handleAddressScan?.(data);
                      setActiveAction?.("send");
                      setQrScannerOpen(false);
                    }}
                    onClose={() => setQrScannerOpen(false)}
                    embedded={true}
                    showClose={false}
                    hideTitle={true}
                    enableCamera={true}
                    hideWhenUnavailable
                    className="bg-[#101415] w-full h-full flex flex-col justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <WalletDashboardSaveAddressPrompt
        open={showSaveAddressPrompt}
        addressToSave={addressToSave}
        onClose={() => {
          setShowSaveAddressPrompt(false);
          setAddressToSave("");
        }}
        onSave={() => {
          saveAddress(addressToSave, "");
          setShowSaveAddressPrompt(false);
          setAddressToSave("");
          toast?.success("Address saved!");
        }}
      />

      <WalletDashboardStatementModals {...statementSharedProps} />
    </>
  );
}
