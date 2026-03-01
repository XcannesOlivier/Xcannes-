/**
 * demoXrpl — minimal XRPL constants for the demo wallet.
 *
 * Only the RLUSD issuer address is consumed (ReceiveModal QR code).
 * Full currency-code encoding/decoding has been removed since the
 * demo wallet never builds real XRPL transactions.
 */

const RLUSD_ISSUER = (
  process.env.NEXT_PUBLIC_RLUSD_ISSUER || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De"
).trim();

export const XRPL_KNOWN_ISSUERS = {
  RLUSD: RLUSD_ISSUER,
};
