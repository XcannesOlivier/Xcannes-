/**
 * DemoWalletModals — all modal orchestration for the demo wallet.
 *
 * Groups DemoWalletInfoModal, SendModal, PayreqModal, ReceiveModal,
 * SwapModal, CashModal, StatementModals and QRScanner into a single
 * render-slot so that DemoWalletDashboard stays focused on state logic.
 */

import DemoWalletDashboardSendModal from "../modals/DemoWalletDashboardSendModal";
import DemoWalletDashboardPayreqModal from "../modals/DemoWalletDashboardPayreqModal";
import DemoWalletDashboardReceiveModal from "../modals/DemoWalletDashboardReceiveModal";
import DemoWalletDashboardSwapModal from "../modals/DemoWalletDashboardSwapModal";
import DemoWalletDashboardCashModal from "../modals/DemoWalletDashboardCashModal";
import DemoWalletDashboardStatementModals from "../modals/DemoWalletDashboardStatementModals";
import DemoWalletInfoModal from "../modals/DemoWalletInfoModal";
import DemoQRScanner from "./DemoQRScanner";
import { QRCodeCanvas } from "qrcode.react";
import { DEMO_FAUX_PAYREQ_EXAMPLE } from "../utils/demoWalletHelpers";

export default function DemoWalletModals({
  // Info modal
  walletInfoOpen,
  setWalletInfoOpen,
  // Send modal
  activeAction,
  setActiveAction,
  hasPayreq,
  setSendPaymentRequest,
  renderWalletMeta,
  selectableTokens,
  selectedSendToken,
  sendFxInfo,
  setSendAssetKey,
  sendAmount,
  setSendAmount,
  selectLabelByAssetKey,
  selectLabelRightByAssetKey,
  selectIconByAssetKey,
  selectLabelMobileByAssetKey,
  demoSavedAddresses,
  sendDestination,
  setSendDestination,
  handlePaymentRequestScan,
  handleSendSubmit,
  sendProcessing,
  // Payreq modal
  sendPaymentRequest,
  // Receive modal
  wallet,
  requestAmount,
  setRequestAmount,
  requestCurrency,
  setRequestCurrency,
  allocationSummary,
  requestMemo,
  setRequestMemo,
  rlusdPerUnitRates,
  rlusdPerUnitSources,
  // Swap modal
  currencyLinesSummary,
  currencyLines,
  swapCurrencyOptions,
  convertBaseCurrency,
  setConvertBaseCurrency,
  convertQuoteCurrency,
  setConvertQuoteCurrency,
  convertAmount,
  setConvertAmount,
  convertPreview,
  handleDemoConvert,
  convertProcessing,
  // Cash modal
  walletContextLabel,
  isWalletLabelLocked,
  handleDemoBuy,
  handleDemoSell,
  cashModalTab,
  setCashModalTab,
  // Statement modals
  previewGlobalMovements,
  previewCurrencyTransactions,
  effectiveUsdPerUnitRates,
  highlightTransactionId,
  showGlobalStatement,
  setShowGlobalStatement,
  showCurrencyStatement,
  setShowCurrencyStatement,
  selectedStatementToken,
  setSelectedStatementToken,
  statementBalance,
  usdTotal,
  globalStatementTokens,
  // QR Scanner
  qrScannerOpen,
  handleDemoQrScan,
  setQrScannerOpen,
  showDemoMobileScannerQr,
  isDesktop,
  demoScannerQrSize,
}) {
  return (
    <>
      <DemoWalletInfoModal
        isOpen={walletInfoOpen}
        onClose={() => setWalletInfoOpen(false)}
        isPreviewMode={true}
        noticeVariant="demo"
      />

      <DemoWalletDashboardSendModal
        open={activeAction === "send" && !hasPayreq}
        onClose={() => {
          setActiveAction(null);
          setSendPaymentRequest(null);
        }}
        isPreviewMode={true}
        noticeVariant="demo"
        renderWalletMeta={renderWalletMeta}
        augmentedTokens={selectableTokens}
        selectedSendToken={selectedSendToken}
        sendFxInfo={sendFxInfo}
        setSendAssetKey={setSendAssetKey}
        sendAmount={sendAmount}
        setSendAmount={setSendAmount}
        selectLabelByAssetKey={selectLabelByAssetKey}
        selectLabelRightByAssetKey={selectLabelRightByAssetKey}
        selectIconByAssetKey={selectIconByAssetKey}
        selectLabelMobileByAssetKey={selectLabelMobileByAssetKey}
        savedAddresses={demoSavedAddresses}
        sendDestination={sendDestination}
        setSendDestination={setSendDestination}
        handlePaymentRequestScan={handlePaymentRequestScan}
        handleSendSubmit={handleSendSubmit}
        sendProcessing={sendProcessing}
        enableSaveAddress={true}
      />

      <DemoWalletDashboardPayreqModal
        open={activeAction === "send" && hasPayreq}
        onClose={() => {
          setActiveAction(null);
          setSendPaymentRequest(null);
        }}
        isPreviewMode={true}
        noticeVariant="demo"
        renderWalletMeta={renderWalletMeta}
        selectedSendToken={selectedSendToken}
        sendPaymentRequest={sendPaymentRequest}
        sendDestination={sendDestination}
        sendAmount={sendAmount}
        sendProcessing={sendProcessing}
        handleSendSubmit={handleSendSubmit}
        savedAddresses={demoSavedAddresses}
        enableSaveAddress={true}
      />

      <DemoWalletDashboardReceiveModal
        open={activeAction === "receive"}
        onClose={() => setActiveAction(null)}
        isPreviewMode={true}
        noticeVariant="demo"
        renderWalletMeta={renderWalletMeta}
        wallet={wallet}
        handleCopyAddress={async () => {
          try {
            await navigator.clipboard.writeText(wallet);
          } catch {
            // noop
          }
        }}
        requestAmount={requestAmount}
        setRequestAmount={setRequestAmount}
        requestCurrency={requestCurrency}
        setRequestCurrency={setRequestCurrency}
        unallocatedUsd={allocationSummary?.unallocatedRlusd ?? 0}
        selectLabelByCurrency={selectLabelByAssetKey}
        selectLabelRightByCurrency={selectLabelRightByAssetKey}
        selectIconByCurrency={selectIconByAssetKey}
        selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
        augmentedTokens={selectableTokens}
        requestMemo={requestMemo}
        setRequestMemo={setRequestMemo}
      />

      <DemoWalletDashboardSwapModal
        open={activeAction === "swap"}
        onClose={() => setActiveAction(null)}
        renderWalletMeta={renderWalletMeta}
        isPreviewMode={true}
        noticeVariant="demo"
        currencyLinesSummary={currencyLinesSummary}
        currencyLines={currencyLines}
        swapCurrencyOptions={swapCurrencyOptions}
        convertBaseCurrency={convertBaseCurrency}
        setConvertBaseCurrency={setConvertBaseCurrency}
        convertQuoteCurrency={convertQuoteCurrency}
        setConvertQuoteCurrency={setConvertQuoteCurrency}
        convertAmount={convertAmount}
        setConvertAmount={setConvertAmount}
        convertPreview={convertPreview}
        selectLabelByCurrency={selectLabelByAssetKey}
        selectLabelRightByCurrency={selectLabelRightByAssetKey}
        selectIconByCurrency={selectIconByAssetKey}
        selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
        handleDemoConvert={handleDemoConvert}
        convertProcessing={convertProcessing}
        rlusdPerUnitRates={rlusdPerUnitRates}
      />

      <DemoWalletDashboardCashModal
        open={activeAction === "cash"}
        onClose={() => setActiveAction(null)}
        isPreviewMode={true}
        noticeVariant="demo"
        walletLabel={walletContextLabel}
        hideWalletAddress={isWalletLabelLocked}
        demoMode={true}
        onDemoBuy={handleDemoBuy}
        onDemoSell={handleDemoSell}
        cashModalTab={cashModalTab}
        setCashModalTab={setCashModalTab}
        renderWalletMeta={renderWalletMeta}
        availableTokens={selectableTokens}
        rlusdPerUnitRates={rlusdPerUnitRates}
        selectLabelByCurrency={selectLabelByAssetKey}
        selectLabelRightByCurrency={selectLabelRightByAssetKey}
        selectIconByCurrency={selectIconByAssetKey}
        selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
        walletAddress={wallet || ""}
      />

      <DemoWalletDashboardStatementModals
        augmentedTokens={selectableTokens}
        wallet={wallet}
        walletDisplayLabel={walletContextLabel}
        isPreviewMode={true}
        noticeVariant="demo"
        previewGlobalMovements={previewGlobalMovements}
        previewCurrencyTransactions={previewCurrencyTransactions}
        isFullPageView={false}
        statementVariant={"default"}
        usdRates={effectiveUsdPerUnitRates}
        highlightTransactionId={highlightTransactionId}
        showGlobalStatement={showGlobalStatement}
        setShowGlobalStatement={setShowGlobalStatement}
        showCurrencyStatement={showCurrencyStatement}
        setShowCurrencyStatement={setShowCurrencyStatement}
        selectedStatementToken={selectedStatementToken}
        setSelectedStatementToken={setSelectedStatementToken}
        statementBalance={statementBalance}
        statementTotalBalanceUsd={usdTotal}
        globalStatementTokens={globalStatementTokens}
      />

      <DemoQRScanner
        isOpen={qrScannerOpen}
        onScan={handleDemoQrScan}
        onClose={() => setQrScannerOpen(false)}
        enableCamera={!showDemoMobileScannerQr}
        showStaticImage={showDemoMobileScannerQr}
        hideWhenUnavailable={isDesktop}
        staticContent={
          showDemoMobileScannerQr ? (
            <QRCodeCanvas
              value={DEMO_FAUX_PAYREQ_EXAMPLE}
              size={demoScannerQrSize}
              bgColor="#000000"
              fgColor="#ffffff"
            />
          ) : null
        }
        staticContentClassName="bg-black/60"
      />
    </>
  );
}
