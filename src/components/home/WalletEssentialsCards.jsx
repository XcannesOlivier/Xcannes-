import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import { CRYPTO_ICONS } from "@/utils/marketConstants";
import { getCurrencyFlag } from "@/components/wallet/walletDashboardConfig";

const DEMO_CARD_EVENT = "xcannes:demo-wallet:card";
const DEMO_CARD_CTA_EVENT = "xcannes:demo-wallet:cta";
const FLASH_STYLES = {
  pay: { backgroundColor: "rgba(95, 201, 248, 0.06)", borderColor: "rgba(95, 201, 248, 0.55)" },
  receive_request: { backgroundColor: "rgba(34, 197, 94, 0.06)", borderColor: "rgba(34, 197, 94, 0.55)" },
  convert: { backgroundColor: "rgba(6, 182, 212, 0.06)", borderColor: "rgba(6, 182, 212, 0.55)" },
  buy: { backgroundColor: "rgba(139, 92, 246, 0.06)", borderColor: "rgba(139, 92, 246, 0.55)" },
  lines: { backgroundColor: "rgba(245, 158, 11, 0.06)", borderColor: "rgba(245, 158, 11, 0.55)" },
  statements: { backgroundColor: "rgba(34, 197, 94, 0.06)", borderColor: "rgba(34, 197, 94, 0.55)" },
  config: { backgroundColor: "rgba(139, 92, 246, 0.06)", borderColor: "rgba(139, 92, 246, 0.55)" }
};

export default function WalletEssentialsCards({ variant = "home" }) {
  const { t, i18n } = useTranslation("common");
  const [modalRoot, setModalRoot] = useState(null);
  const [activeActionKey, setActiveActionKey] = useState(null);
  const [flashByKey, setFlashByKey] = useState({});
  const [returnCardKey, setReturnCardKey] = useState(null);
  const flashTimers = useRef({});
  const isCompact = variant === "compare";
  const locale = i18n?.language || "en";

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "essentials-modal-root";
    document.body.appendChild(el);
    setModalRoot(el);
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);

  useEffect(() => {
    if (!activeActionKey || typeof window === "undefined") return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setActiveActionKey(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeActionKey]);

  const formatAmount = useCallback(
    (value) => {
      const num = Number(value);
      if (!Number.isFinite(num)) return null;
      return num.toLocaleString(locale, {
        maximumFractionDigits: 6
      });
    },
    [locale]
  );

  const formatWalletLabel = useCallback(
    (walletId) => {
      if (!walletId) return t("demo_wallet_label", "Wallet");
      return `${t("demo_wallet_label", "Wallet")} ${walletId}`;
    },
    [t]
  );
  const buildStatementCtaLabel = useCallback(
    (currency, wallet) =>
      t("demo_card_cta_statement_currency", {
        defaultValue: "Relevé {{currency}} · {{wallet}}",
        currency,
        wallet
      }),
    [t]
  );
  const buildStatementGlobalCtaLabel = useCallback(
    (wallet) =>
      t("demo_card_cta_statement_global", {
        defaultValue: "Relevé global · {{wallet}}",
        wallet
      }),
    [t]
  );
  const buildOpenSendCtaLabel = useCallback(
    (wallet) =>
      t("demo_card_cta_open_send", {
        defaultValue: "Ouvrir Envoyer · {{wallet}}",
        wallet
      }),
    [t]
  );
  const buildOpenLinesCtaLabel = useCallback(
    (wallet) =>
      t("demo_card_cta_open_lines", {
        defaultValue: "Gérer les lignes · {{wallet}}",
        wallet
      }),
    [t]
  );
  const renderStatementCtaIcon = useCallback((currency) => {
    const code = String(currency || "").toUpperCase();
    if (!code) return "?";
    const iconSrc = CRYPTO_ICONS?.[code];
    if (iconSrc) {
      return (
        <Image
          src={iconSrc}
          alt={code}
          width={16}
          height={16}
          className="w-4 h-4 object-contain"
        />
      );
    }
    return getCurrencyFlag(code);
  }, []);
  const dispatchDemoCta = useCallback((detail) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(DEMO_CARD_CTA_EVENT, { detail }));
  }, []);

  const buildFlash = useCallback(
    (detail = {}) => {
      const action = detail?.action;
      if (!action) return null;

      const cardKeyMap = {
        send: "pay",
        request: "receive_request",
        convert: "convert",
        buy: "buy",
        sell: "buy",
        statement_global: "statements",
        statement_currency: "statements",
        trustline_add: "lines",
        trustline_remove: "lines",
        trustline_update: "lines"
      };

      const cardKey = cardKeyMap[action];
      if (!cardKey) return null;

      const currency =
        String(detail.currency || detail.fromCurrency || detail.toCurrency || "")
          .trim()
          .toUpperCase();

      if (action === "send") {
        const amountLabel = formatAmount(detail.amount);
        const fromWallet = formatWalletLabel(detail.fromWalletId);
        const toWallet = formatWalletLabel(detail.toWalletId);
        const ctas = [];
        if (currency && detail.toWalletId) {
          ctas.push({
            label: buildStatementCtaLabel(currency, toWallet),
            detail: {
              action: "open_statement_currency",
              walletId: detail.toWalletId,
              currency
            }
          });
        }
        if (currency && detail.fromWalletId) {
          ctas.push({
            label: buildStatementCtaLabel(currency, fromWallet),
            detail: {
              action: "open_statement_currency",
              walletId: detail.fromWalletId,
              currency
            }
          });
        }
        return {
          cardKey,
          title: t("demo_card_flash_send_title", "Envoi simulé"),
          desc: t("demo_card_flash_send_desc", {
            defaultValue:
              "Vous avez envoyé {{amount}} {{currency}} vers {{toWallet}}. Relevé {{currency}}: crédit chez {{toWallet}}, débit chez {{fromWallet}}.",
            amount: amountLabel || "—",
            currency: currency || "",
            toWallet,
            fromWallet
          }),
          ctas
        };
      }

      if (action === "request") {
        const amountLabel = formatAmount(detail.amount);
        const otherWallet = formatWalletLabel(detail.toWalletId);
        const hasAmount = Boolean(amountLabel) && Boolean(currency);
        const ctas = detail.toWalletId
          ? [
            {
              label: buildOpenSendCtaLabel(otherWallet),
              detail: {
                action: "open_send",
                walletId: detail.toWalletId,
                sendTab: "scan-request",
                usePendingRequest: true
              }
            }
          ]
          : [];
        return {
          cardKey,
          title: t("demo_card_flash_request_title", "Demande créée"),
          desc: hasAmount
            ? t("demo_card_flash_request_desc", {
              defaultValue:
                "Demande de {{amount}} {{currency}}. Sur {{otherWallet}}, ouvrez Envoyer > Scan Request pour payer.",
              amount: amountLabel,
              currency,
              otherWallet
            })
            : t("demo_card_flash_request_desc_short", {
              defaultValue:
                "Demande créée. Sur {{otherWallet}}, ouvrez Envoyer > Scan Request pour payer.",
              otherWallet
            }),
          ctas
        };
      }

      if (action === "convert") {
        const fromAmount = formatAmount(detail.fromAmount);
        const toAmount = formatAmount(detail.toAmount);
        const fromCurrency = String(detail.fromCurrency || "").toUpperCase();
        const toCurrency = String(detail.toCurrency || "").toUpperCase();
        const wallet = formatWalletLabel(detail.walletId);
        const ctas = [];
        if (toCurrency && detail.walletId) {
          ctas.push({
            label: buildStatementCtaLabel(toCurrency, wallet),
            detail: {
              action: "open_statement_currency",
              walletId: detail.walletId,
              currency: toCurrency
            }
          });
        }
        if (fromCurrency && detail.walletId) {
          ctas.push({
            label: buildStatementCtaLabel(fromCurrency, wallet),
            detail: {
              action: "open_statement_currency",
              walletId: detail.walletId,
              currency: fromCurrency
            }
          });
        }
        return {
          cardKey,
          title: t("demo_card_flash_convert_title", "Conversion simulée"),
          desc: t("demo_card_flash_convert_desc", {
            defaultValue:
              "{{fromAmount}} {{fromCurrency}} → {{toAmount}} {{toCurrency}}. Relevé {{fromCurrency}}: débit, relevé {{toCurrency}}: crédit.",
            fromAmount: fromAmount || "—",
            fromCurrency,
            toAmount: toAmount || "—",
            toCurrency
          }),
          ctas
        };
      }

      if (action === "buy") {
        const amountLabel = formatAmount(detail.amount);
        const wallet = formatWalletLabel(detail.walletId);
        const ctas = detail.walletId
          ? [
            {
              label: buildStatementCtaLabel("RLUSD", wallet),
              detail: {
                action: "open_statement_currency",
                walletId: detail.walletId,
                currency: "RLUSD"
              }
            }
          ]
          : [];
        return {
          cardKey,
          title: t("demo_card_flash_buy_title", "Achat simulé"),
          desc: t("demo_card_flash_buy_desc", {
            defaultValue: "+{{amount}} RLUSD. Vérifiez le relevé RLUSD dans {{wallet}}.",
            amount: amountLabel || "—",
            wallet
          }),
          ctas
        };
      }

      if (action === "sell") {
        const amountLabel = formatAmount(detail.amount);
        const wallet = formatWalletLabel(detail.walletId);
        const ctas = detail.walletId
          ? [
            {
              label: buildStatementCtaLabel("RLUSD", wallet),
              detail: {
                action: "open_statement_currency",
                walletId: detail.walletId,
                currency: "RLUSD"
              }
            }
          ]
          : [];
        return {
          cardKey,
          title: t("demo_card_flash_sell_title", "Vente simulée"),
          desc: t("demo_card_flash_sell_desc", {
            defaultValue: "-{{amount}} RLUSD. Vérifiez le relevé RLUSD dans {{wallet}}.",
            amount: amountLabel || "—",
            wallet
          }),
          ctas
        };
      }

      if (action === "statement_currency") {
        const wallet = formatWalletLabel(detail.walletId);
        const ctas = detail.walletId && currency
          ? [
            {
              label: buildStatementCtaLabel(currency, wallet),
              detail: {
                action: "open_statement_currency",
                walletId: detail.walletId,
                currency
              }
            }
          ]
          : [];
        return {
          cardKey,
          title: t("demo_card_flash_statement_currency_title", {
            defaultValue: "Relevé {{currency}}",
            currency: currency || ""
          }),
          desc: t("demo_card_flash_statement_currency_desc", {
            defaultValue:
              "Historique des crédits/débits {{currency}} dans {{wallet}}.",
            currency: currency || "",
            wallet
          }),
          ctas
        };
      }

      if (action === "statement_global") {
        const wallet = formatWalletLabel(detail.walletId);
        const ctas = detail.walletId
          ? [
            {
              label: buildStatementGlobalCtaLabel(wallet),
              detail: {
                action: "open_statement_global",
                walletId: detail.walletId
              }
            }
          ]
          : [];
        return {
          cardKey,
          title: t("demo_card_flash_statement_title", "Relevé ouvert"),
          desc: t("demo_card_flash_statement_desc", {
            defaultValue: "Relevé global ouvert dans {{wallet}}. Consultez les mouvements et exportez le PDF/CSV.",
            wallet
          }),
          ctas
        };
      }

      if (action === "trustline_add") {
        const wallet = formatWalletLabel(detail.walletId);
        const ctas = detail.walletId
          ? [
            {
              label: buildOpenLinesCtaLabel(wallet),
              detail: {
                action: "open_swap",
                walletId: detail.walletId,
                swapView: "lines"
              }
            }
          ]
          : [];
        return {
          cardKey,
          title: t("demo_card_flash_trustline_add_title", "Ligne activée"),
          desc: t("demo_card_flash_trustline_add_desc", {
            defaultValue: "Dans {{wallet}}, la ligne {{currency}} est active. Vous pouvez convertir ou allouer.",
            currency: currency || "",
            wallet
          }),
          ctas
        };
      }

      if (action === "trustline_remove") {
        const wallet = formatWalletLabel(detail.walletId);
        const ctas = detail.walletId
          ? [
            {
              label: buildOpenLinesCtaLabel(wallet),
              detail: {
                action: "open_swap",
                walletId: detail.walletId,
                swapView: "lines"
              }
            }
          ]
          : [];
        return {
          cardKey,
          title: t("demo_card_flash_trustline_remove_title", "Ligne supprimée"),
          desc: t("demo_card_flash_trustline_remove_desc", {
            defaultValue: "Dans {{wallet}}, la ligne {{currency}} est retirée. Convertissez à 0 pour la réactiver.",
            currency: currency || "",
            wallet
          }),
          ctas
        };
      }

      if (action === "trustline_update") {
        const amountLabel = formatAmount(detail.amount);
        const wallet = formatWalletLabel(detail.walletId);
        const ctas = detail.walletId
          ? [
            {
              label: buildOpenLinesCtaLabel(wallet),
              detail: {
                action: "open_swap",
                walletId: detail.walletId,
                swapView: "lines"
              }
            }
          ]
          : [];
        return {
          cardKey,
          title: t("demo_card_flash_trustline_update_title", "Allocation mise à jour"),
          desc: t("demo_card_flash_trustline_update_desc", {
            defaultValue: "Dans {{wallet}}, {{currency}} allouée à {{amount}} RLUSD.",
            currency: currency || "",
            amount: amountLabel || "—",
            wallet
          }),
          ctas
        };
      }

      return null;
    },
    [
      buildOpenLinesCtaLabel,
      buildOpenSendCtaLabel,
      buildStatementCtaLabel,
      buildStatementGlobalCtaLabel,
      formatAmount,
      formatWalletLabel,
      t
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleFlash = (event) => {
      const flash = buildFlash(event?.detail || {});
      if (!flash) return;

      const isMobile =
        window.matchMedia("(max-width: 1023px)").matches &&
        window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      if (flash.cardKey && isMobile) {
        setReturnCardKey(flash.cardKey);
      }

      if (flashTimers.current[flash.cardKey]) {
        clearTimeout(flashTimers.current[flash.cardKey]);
        delete flashTimers.current[flash.cardKey];
      }

      setFlashByKey((prev) => ({
        ...prev,
        [flash.cardKey]: { title: flash.title, desc: flash.desc, ctas: flash.ctas || [] }
      }));

    };

    window.addEventListener(DEMO_CARD_EVENT, handleFlash);
    return () => {
      window.removeEventListener(DEMO_CARD_EVENT, handleFlash);
      Object.values(flashTimers.current).forEach((timer) => clearTimeout(timer));
      flashTimers.current = {};
    };
  }, [buildFlash]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleReturnCta = (event) => {
      const detail = event?.detail || {};
      if (detail.action === "return_wallet") {
        const targetKey = detail.cardKey || returnCardKey;
        if (targetKey) {
          setFlashByKey((prev) => {
            const next = { ...prev };
            delete next[targetKey];
            return next;
          });
          if (flashTimers.current[targetKey]) {
            clearTimeout(flashTimers.current[targetKey]);
            delete flashTimers.current[targetKey];
          }
        }
        setReturnCardKey(null);
      }
    };
    window.addEventListener(DEMO_CARD_CTA_EVENT, handleReturnCta);
    return () => window.removeEventListener(DEMO_CARD_CTA_EVENT, handleReturnCta);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const hasFlash = Object.keys(flashByKey).length > 0;
    if (!hasFlash) return undefined;

    const handleOutsideFlash = (event) => {
      const isMobile =
        window.matchMedia("(max-width: 1023px)").matches &&
        window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      if (isMobile) return;
      const target = event.target;
      if (target instanceof Element && target.closest('[data-essentials-flash="true"]')) {
        return;
      }
      setFlashByKey({});
      setReturnCardKey(null);
      Object.values(flashTimers.current).forEach((timer) => clearTimeout(timer));
      flashTimers.current = {};
    };

    document.addEventListener("mousedown", handleOutsideFlash);
    return () => document.removeEventListener("mousedown", handleOutsideFlash);
  }, [flashByKey]);

  const actions = [
    {
      key: "statements",
      title: t("home_v2_essentials_1_title", "Relevés d'opération"),
      desc: t(
        "home_v2_essentials_1_desc",
        "Suivez les mouvements, par devise ou globalement."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_1_modal_point_1",
          "Relevés par devise ou globaux, en un clic."
        ),
        t(
          "home_v2_essentials_1_modal_point_2",
          "Partage et export en un clic."
        ),
        t(
          "home_v2_essentials_1_modal_point_3",
          "Historique clair pour le suivi comptable."
        ),
      ],
      orderClassName: "order-6 lg:order-8",
      iconClassName:
        "text-[#22C55E] bg-[rgba(34,197,94,0.08)] group-hover:bg-[rgba(34,197,94,0.14)]",
      borderHoverClassName: "group-hover:border-[#22C55E]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-3-2V5a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 7h6M9 11h6M9 15h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      key: "pay",
      title: t("home_v2_essentials_2_title", "Payer / Envoyer"),
      desc: t(
        "home_v2_essentials_2_desc",
        "Demandez (QR), recevez et envoyez en quelques secondes."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_2_modal_point_1",
          "Payer ou envoyer en quelques secondes."
        ),
        t(
          "home_v2_essentials_2_modal_point_2",
          "Validation explicite avant chaque transaction."
        ),
        t(
          "home_v2_essentials_2_modal_point_3",
          "QR et demandes intégrés pour aller plus vite."
        ),
      ],
      orderClassName: "order-1 lg:order-2",
      iconClassName:
        "text-[#5FC9F8] bg-[rgba(56,189,248,0.14)] group-hover:bg-[rgba(56,189,248,0.2)]",
      borderHoverClassName: "group-hover:border-[#5FC9F8]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 17l10-10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10 7h7v7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "receive_request",
      title: t("home_v2_essentials_5_title", "Recevoir / Demander"),
      desc: t(
        "home_v2_essentials_5_desc",
        "Recevoir des fonds ou créer une demande."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_5_modal_point_1",
          "Créer une demande de paiement en un clic."
        ),
        t(
          "home_v2_essentials_5_modal_point_2",
          "Partage rapide via QR ou lien."
        ),
        t(
          "home_v2_essentials_5_modal_point_3",
          "Suivi simple des paiements reçus."
        ),
      ],
      orderClassName: "order-2 lg:order-4",
      iconClassName:
        "text-[#22C55E] bg-[rgba(34,197,94,0.08)] group-hover:bg-[rgba(34,197,94,0.14)]",
      borderHoverClassName: "group-hover:border-[#22C55E]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <line
            x1="12"
            y1="5"
            x2="12"
            y2="19"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <polyline
            points="19 12 12 19 5 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "convert",
      title: t("home_v2_essentials_3_title", "Conversion"),
      desc: t(
        "home_v2_essentials_3_desc",
        "Taux clairement affiché avant validation."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_3_modal_point_1",
          "Taux affiché avant confirmation."
        ),
        t(
          "home_v2_essentials_3_modal_point_2",
          "Conversion instantanée entre devises."
        ),
        t(
          "home_v2_essentials_3_modal_point_3",
          "Montants affichés clairement, sans surprise."
        ),
      ],
      orderClassName: "order-3 lg:order-5",
      iconClassName:
        "text-[#06B6D4] bg-[rgba(6,182,212,0.08)] group-hover:bg-[rgba(6,182,212,0.14)]",
      borderHoverClassName: "group-hover:border-[#06B6D4]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <polyline
            points="17 1 21 5 17 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3 11V9a4 4 0 0 1 4-4h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="7 23 3 19 7 15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 13v2a4 4 0 0 1-4 4H3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "config",
      title: t("home_v2_essentials_6_title", "Configuration"),
      desc: t(
        "home_v2_essentials_6_desc",
        "Mise en place simple, fonctionnement clair."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_6_modal_point_1",
          "Paramètres simples, guidés pas à pas."
        ),
        t(
          "home_v2_essentials_6_modal_point_2",
          "Fonctionnement transparent, règles claires."
        ),
        t(
          "home_v2_essentials_6_modal_point_3",
          "Notifications et sécurité configurables."
        ),
      ],
      orderClassName: "order-7 lg:order-9",
      iconClassName:
        "text-[#8B5CF6] bg-[rgba(139,92,246,0.08)] group-hover:bg-[rgba(139,92,246,0.14)]",
      borderHoverClassName: "group-hover:border-[#8B5CF6]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 7h10M18 7h2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M14 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M4 17h6M14 17h6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M14 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
    },
    {
      key: "buy",
      title: t("home_v2_essentials_4_title", "Acheter / Vendre"),
      desc: t(
        "home_v2_essentials_4_desc",
        "Accès fiat selon la disponibilité du pays."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_4_modal_point_1",
          "Accès fiat selon la disponibilité du pays."
        ),
        t(
          "home_v2_essentials_4_modal_point_2",
          "Acheter ou vendre en quelques étapes."
        ),
        t(
          "home_v2_essentials_4_modal_point_3",
          "Frais et limites indiqués avant validation."
        ),
      ],
      orderClassName: "order-4 lg:order-6",
      iconClassName:
        "text-[#8B5CF6] bg-[rgba(139,92,246,0.08)] group-hover:bg-[rgba(139,92,246,0.14)]",
      borderHoverClassName: "group-hover:border-[#8B5CF6]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect
            x="1"
            y="4"
            width="22"
            height="16"
            rx="2"
            ry="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="1"
            y1="10"
            x2="23"
            y2="10"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
    },
    {
      key: "lines",
      title: t("home_v2_essentials_lines_title", "Lignes de devises"),
      desc: t(
        "home_v2_essentials_lines_desc",
        "Activez et gérez vos devises locales en quelques étapes."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_lines_modal_point_1",
          "Activez une devise pour l'utiliser dans le wallet."
        ),
        t(
          "home_v2_essentials_lines_modal_point_2",
          "Allouez et ajustez vos montants en RLUSD."
        ),
        t(
          "home_v2_essentials_lines_modal_point_3",
          "Gérez les lignes actives et leur disponibilité."
        ),
      ],
      orderClassName: "order-5 lg:order-7",
      iconClassName:
        "text-[#F59E0B] bg-[rgba(245,158,11,0.08)] group-hover:bg-[rgba(245,158,11,0.14)]",
      borderHoverClassName: "group-hover:border-[#F59E0B]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 6h14M5 12h14M5 18h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="19" cy="18" r="2" stroke="currentColor" strokeWidth="2" />
        </svg>
      ),
    },
    {
      key: "demo_intro",
      title: t(
        "home_v2_demo_card_title",
        "Découvrez la démo du wallet XCANNES"
      ),
      desc: t(
        "home_v2_demo_card_desc",
        "Démo interactive, sans transaction réelle."
      ),
      orderClassName: "order-last lg:order-1",
      showArrow: true,
      isPlain: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M10 8l6 4-6 4V8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  const visibleActions = isCompact
    ? actions.filter((action) => !action.isPlain)
    : actions;

  const activeAction = actions.find(
    (action) => action.key === activeActionKey
  );
  const modalTitleId = activeAction
    ? `essentials-modal-title-${activeAction.key}`
    : null;

  const rootClassName = isCompact
    ? "h-full w-full flex flex-col min-h-0 gap-4"
    : "";
  const gridClassName = isCompact
    ? "grid grid-cols-1 grid-rows-7 gap-2 flex-1 min-h-0"
    : "grid sm:grid-cols-2 lg:grid-cols-1 gap-4";
  const cardPaddingClassName = isCompact ? "p-3" : "p-5";
  const baseLayoutClassName = isCompact
    ? "space-y-2"
    : "lg:flex lg:items-start lg:gap-6";
  const titleRowClassName = isCompact
    ? "flex items-center gap-2.5"
    : "flex items-center gap-3 lg:items-start lg:min-w-[190px]";
  const titleClassName = isCompact
    ? "text-white/80 font-montserrat font-semibold tracking-[0.18em] text-[10px] uppercase leading-snug"
    : "text-white/80 font-montserrat font-semibold tracking-widest text-xs uppercase";
  const descClassName = isCompact
    ? "text-[12px] text-white/65 leading-snug line-clamp-2"
    : "text-sm text-white/70 leading-relaxed";
  const ctaClassName = isCompact
    ? "mt-1 flex items-center gap-1.5 text-[10px] text-white/50 transition-colors group-hover:text-white/80"
    : "mt-3 flex items-center gap-2 text-xs text-white/50 transition-colors group-hover:text-white/80 lg:mt-0 lg:ml-auto lg:self-start lg:pt-0.5";

  return (
    <div className={rootClassName}>
      {isCompact && (
        <div className="px-0.5 text-center">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/50">
            {t("home_v2_demo_badge", "Démo du wallet (interface de compte)")}
          </p>
          <h3 className="mt-1 text-[28px] font-montserrat font-semibold text-white/90 leading-tight">
            {t("home_v2_demo_preview_title", "Démo interactive")}
          </h3>
          <p className="mt-1 text-[11px] text-white/60 leading-snug line-clamp-2">
            {t(
              "home_v2_demo_card_desc",
              "Démo interactive, sans transaction réelle."
            )}
          </p>
        </div>
      )}

      <div className={gridClassName}>
        {visibleActions.map((action) => {
          const flash = flashByKey[action.key];
          const flashClasses = "";
          const flashStyle =
            flash && !action.isPlain ? (FLASH_STYLES[action.key] || {}) : undefined;
          const flashCtas = flash?.ctas || [];
          const showReturnCta = Boolean(returnCardKey === action.key && flash);
          const returnCta = showReturnCta
            ? {
              label: t("demo_card_cta_return_wallet", "Revenir au wallet"),
              detail: { action: "return_wallet", cardKey: action.key },
              className: "md:hidden"
            }
            : null;
          const effectiveCtas = returnCta ? [...flashCtas, returnCta] : flashCtas;
          const ctaStyle = flashStyle
            ? { borderColor: flashStyle.borderColor, color: flashStyle.borderColor }
            : undefined;
          const hasStatementCtas = Boolean(
            flash &&
            effectiveCtas.some(
              (cta) => cta?.detail?.action === "open_statement_currency"
            )
          );
          const ctaContainerClassName = hasStatementCtas
            ? "mt-2 flex flex-col gap-2"
            : isCompact
              ? "mt-2 flex flex-wrap gap-2 justify-center"
              : "mt-2 flex flex-wrap gap-2";
          const ctaButtonClassName =
            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/80 hover:text-white transition-colors";
          const cardLayoutClassName = !isCompact && flash ? "" : baseLayoutClassName;
          const descLayoutClassName = !isCompact && flash
            ? ""
            : !isCompact
              ? "lg:mt-0 lg:flex-1"
              : "";
          const cardClasses = [
            action.isPlain
              ? "bg-transparent border-none rounded-none shadow-none"
              : "bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl",
            "group",
            cardPaddingClassName,
            cardLayoutClassName,
            action.borderHoverClassName,
            action.orderClassName,
            action.isPlain
              ? ""
              : "w-full text-left cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
            flash ? flashClasses : ""
          ]
            .filter(Boolean)
            .join(" ");

          const effectiveTitle = flash?.title || action.title;
          const effectiveDesc = flash?.desc || action.desc;
          const cardContent = (
            <>
              <div className={titleRowClassName}>
                {!action.isPlain && (
                  <div
                    className={[
                      "rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/80 transition-transform duration-200 group-hover:scale-110",
                      isCompact ? "w-9 h-9" : "w-10 h-10",
                      !isCompact ? "lg:mt-0.5" : "",
                      action.iconClassName,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {action.icon}
                  </div>
                )}
                <div
                  className={
                    action.isPlain
                      ? "text-white/90 font-montserrat font-semibold text-sm sm:text-base tracking-normal"
                      : titleClassName
                  }
                >
                  {effectiveTitle}
                </div>
              </div>
              <p
                className={[
                  "mt-2",
                  descLayoutClassName,
                  action.isPlain ? "text-white/60 text-sm" : descClassName,
                ].join(" ")}
              >
                {effectiveDesc}
              </p>
              {effectiveCtas.length > 0 && !action.isPlain && (
                <div className={ctaContainerClassName}>
                  {effectiveCtas.map((cta) => {
                    const isReturnCta = cta?.detail?.action === "return_wallet";
                    const isStatementCta = Boolean(
                      flash &&
                      cta?.detail?.action === "open_statement_currency" &&
                      cta?.detail?.currency
                    );
                    if (isReturnCta) {
                      const returnStyle = ctaStyle
                        ? { borderColor: ctaStyle.borderColor }
                        : undefined;
                      return (
                        <button
                          key={cta.label}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            dispatchDemoCta(cta.detail);
                          }}
                          className={["w-full text-left", cta.className]
                            .filter(Boolean)
                            .join(" ")}
                          title={cta.label}
                        >
                          <div
                            className="flex items-center justify-between rounded-md border border-white/10 bg-base px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-white/80 transition-colors"
                            style={returnStyle}
                          >
                            <span>{cta.label}</span>
                            <span className="inline-flex text-white/70">
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                aria-hidden="true"
                              >
                                <path
                                  d="M6 9l6 6 6-6"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </span>
                          </div>
                        </button>
                      );
                    }
                    if (isStatementCta) {
                      const currency = String(cta.detail.currency || "").toUpperCase();
                      const walletLabel = formatWalletLabel(cta.detail.walletId);
                      const statementRowStyle = ctaStyle
                        ? { borderColor: ctaStyle.borderColor }
                        : undefined;
                      const statementAccentStyle = ctaStyle
                        ? { color: ctaStyle.borderColor }
                        : undefined;
                      return (
                        <button
                          key={cta.label}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            dispatchDemoCta(cta.detail);
                          }}
                          className="w-full text-left"
                          title={cta.label}
                        >
                          <div
                            className="flex items-center justify-between rounded-md border border-white/10 bg-base px-3 py-2 hover:border-white/20 transition-colors"
                            style={statementRowStyle}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 flex items-center justify-center text-[12px] font-semibold text-primary overflow-hidden rounded-md border border-white/10 bg-white/5">
                                {renderStatementCtaIcon(currency)}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs text-primary truncate">
                                  {currency}
                                </span>
                                <span className="text-[11px] text-muted truncate">
                                  {walletLabel}
                                </span>
                              </div>
                            </div>
                            <span
                              className="text-[10px] font-semibold uppercase tracking-[0.18em] text-xcannes-green/80"
                              style={statementAccentStyle}
                            >
                              {t("demo_card_cta_statement_short", "Relevé")}
                            </span>
                          </div>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={cta.label}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          dispatchDemoCta(cta.detail);
                        }}
                        className={[ctaButtonClassName, cta.className]
                          .filter(Boolean)
                          .join(" ")}
                        style={ctaStyle}
                      >
                        {cta.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {!action.isPlain && !flash && (
                <div className={ctaClassName}>
                  <span>
                    {t("home_v2_essentials_modal_cta", "En savoir plus")}
                  </span>
                  <span className="text-sm">&rarr;</span>
                </div>
              )}
              {action.showArrow && (
                <div className="mt-3 flex justify-end lg:mt-0 lg:ml-auto lg:self-center">
                  <span
                    className="inline-flex lg:hidden text-xcannes-green/70 animate-pulse-slow"
                    aria-hidden="true"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 5v14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M7 14l5 5 5-5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span
                    className="hidden lg:inline-flex text-xcannes-green/70 animate-pulse-slow"
                    aria-hidden="true"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12h14"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                      <path
                        d="M14 7l5 5-5 5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
              )}
            </>
          );

          if (action.isPlain) {
            return (
              <div
                key={action.key}
                className={cardClasses}
                style={flashStyle}
                data-essentials-flash={flash ? "true" : undefined}
                data-essentials-card-key={action.key}
              >
                {cardContent}
              </div>
            );
          }

          return (
            <button
              key={action.key}
              type="button"
              onClick={() => setActiveActionKey(action.key)}
              className={cardClasses}
              style={flashStyle}
              aria-haspopup="dialog"
              aria-expanded={activeActionKey === action.key}
              data-essentials-flash={flash ? "true" : undefined}
              data-essentials-card-key={action.key}
            >
              {cardContent}
            </button>
          );
        })}
      </div>

      {modalRoot &&
        activeAction &&
        activeAction.modalPoints?.length &&
        createPortal(
          <div
            className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setActiveActionKey(null);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={modalTitleId || undefined}
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#050c12]/95 p-5 shadow-2xl animate-essentials-slide-in motion-reduce:animate-none"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <h4
                  id={modalTitleId || undefined}
                  className="text-lg font-semibold text-white"
                >
                  {activeAction.title}
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveActionKey(null)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                  aria-label={t("ui_close_ed73c869c7", "Close")}
                >
                  ✕
                </button>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {activeAction.modalPoints.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <span
                      className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          modalRoot
        )}
    </div>
  );
}
