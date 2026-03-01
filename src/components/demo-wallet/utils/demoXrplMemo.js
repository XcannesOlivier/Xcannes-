/**
 * demoXrplMemo — lightweight memo schema constants for the demo wallet.
 *
 * Only the payreq schema string is consumed by the ReceiveModal and
 * PaymentRequestScanner to tag demo payment-request objects.
 * Full XRPL memo encoding / validation / metrics have been removed
 * since the demo wallet never submits on-chain transactions.
 */

export const XCANNES_MEMO_SCHEMAS = {
  payreq: { schema: "xcannes-payreq-v1", version: 1 },
};
