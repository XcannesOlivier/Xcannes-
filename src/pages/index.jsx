import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import Header from "@/components/layout/Header";
import FooterPro from "@/components/layout/FooterPro";
import SEOHead from "@/components/layout/SEOHead";
import SupportAssistantWidget from "@/components/layout/SupportAssistantWidget";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";
import WalletProductSection from "@/components/home/WalletProductSection";
import MobileHeroCarousel from "@/components/home/MobileHeroCarousel";
import { lockBodyScroll } from "@/utils/bodyScrollLock";

export default function Home() {
  const { t } = useTranslation("common");
  const appStoreBadgeSrc =
    "https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/fr-fr?size=250x83";
  const googlePlayBadgeSrc =
    "https://play.google.com/intl/en_us/badges/static/images/badges/fr_badge_web_generic.png";

  const [speedModalRoot, setSpeedModalRoot] = useState(null);
  const [speedModalOpen, setSpeedModalOpen] = useState(false);
  const [speedModalClosing, setSpeedModalClosing] = useState(false);
  const speedModalCloseTimerRef = useRef(null);
  const [securityModalRoot, setSecurityModalRoot] = useState(null);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [securityModalClosing, setSecurityModalClosing] = useState(false);
  const securityModalCloseTimerRef = useRef(null);
  const [feesModalRoot, setFeesModalRoot] = useState(null);
  const [feesModalOpen, setFeesModalOpen] = useState(false);
  const [feesModalClosing, setFeesModalClosing] = useState(false);
  const feesModalCloseTimerRef = useRef(null);
  const [valueModalRoot, setValueModalRoot] = useState(null);
  const [valueModalOpen, setValueModalOpen] = useState(false);
  const [valueModalClosing, setValueModalClosing] = useState(false);
  const valueModalCloseTimerRef = useRef(null);
  const [isMobile, setIsMobile] = useState(false);
  const [visibleCards, setVisibleCards] = useState(new Set());
  const cardRefs = useRef([]);
  const pillarGridRef = useRef(null);
  const [pillarGridVisible, setPillarGridVisible] = useState(false);
  const [desktopCarouselIndex, setDesktopCarouselIndex] = useState(0); // Carrousel desktop pour carte 4 et 5
  const isHeroModalOpen =
    speedModalOpen || securityModalOpen || feesModalOpen || valueModalOpen;
  
  // États pour l'animation séquencée du hero après l'animation du header
  // Comme le header, les animations ne jouent qu'une seule fois par session
  const heroAlreadyAnimated = typeof window !== "undefined" && sessionStorage.getItem("xcannes_hero_animated") === "1";
  const [showHeroTitle, setShowHeroTitle] = useState(heroAlreadyAnimated);
  const [showHeroSubtitle, setShowHeroSubtitle] = useState(heroAlreadyAnimated);
  const [showHeroCarousel, setShowHeroCarousel] = useState(heroAlreadyAnimated);
  const [showHeroBadges, setShowHeroBadges] = useState(heroAlreadyAnimated);
  const [showHeroCards, setShowHeroCards] = useState(heroAlreadyAnimated);
  const heroAnimationRef = useRef(heroAlreadyAnimated);

  const getModalCloseDelay = () => {
    if (typeof window === "undefined") return 400;
    return window.matchMedia("(max-width: 767px)").matches ? 500 : 400;
  };
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const handleChange = () => setIsMobile(mediaQuery.matches);
    handleChange();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "speed-details-modal-root";
    document.body.appendChild(el);
    setSpeedModalRoot(el);
    return () => {
      if (speedModalCloseTimerRef.current) {
        window.clearTimeout(speedModalCloseTimerRef.current);
        speedModalCloseTimerRef.current = null;
      }
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);
  useEffect(() => {
    if (!speedModalOpen) return;
    setSpeedModalClosing(false);
    if (speedModalCloseTimerRef.current) {
      window.clearTimeout(speedModalCloseTimerRef.current);
      speedModalCloseTimerRef.current = null;
    }
  }, [speedModalOpen]);
  useEffect(() => {
    if (!isHeroModalOpen) return;
    if (typeof window === "undefined") return lockBodyScroll();
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const allowScrollOnMobile =
      isMobile && (securityModalOpen || speedModalOpen);
    if (allowScrollOnMobile) return;
    return lockBodyScroll();
  }, [isHeroModalOpen, securityModalOpen, speedModalOpen]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "security-details-modal-root";
    document.body.appendChild(el);
    setSecurityModalRoot(el);
    return () => {
      if (securityModalCloseTimerRef.current) {
        window.clearTimeout(securityModalCloseTimerRef.current);
        securityModalCloseTimerRef.current = null;
      }
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);
  useEffect(() => {
    if (!securityModalOpen) return;
    setSecurityModalClosing(false);
    if (securityModalCloseTimerRef.current) {
      window.clearTimeout(securityModalCloseTimerRef.current);
      securityModalCloseTimerRef.current = null;
    }
  }, [securityModalOpen]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "fees-details-modal-root";
    document.body.appendChild(el);
    setFeesModalRoot(el);
    return () => {
      if (feesModalCloseTimerRef.current) {
        window.clearTimeout(feesModalCloseTimerRef.current);
        feesModalCloseTimerRef.current = null;
      }
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);
  useEffect(() => {
    if (!feesModalOpen) return;
    setFeesModalClosing(false);
    if (feesModalCloseTimerRef.current) {
      window.clearTimeout(feesModalCloseTimerRef.current);
      feesModalCloseTimerRef.current = null;
    }
  }, [feesModalOpen]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "value-details-modal-root";
    document.body.appendChild(el);
    setValueModalRoot(el);
    return () => {
      if (valueModalCloseTimerRef.current) {
        window.clearTimeout(valueModalCloseTimerRef.current);
        valueModalCloseTimerRef.current = null;
      }
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);
  useEffect(() => {
    if (!valueModalOpen) return;
    setValueModalClosing(false);
    if (valueModalCloseTimerRef.current) {
      window.clearTimeout(valueModalCloseTimerRef.current);
      valueModalCloseTimerRef.current = null;
    }
  }, [valueModalOpen]);

  // Animation séquencée du hero après l'animation du header
  // Ne joue qu'une seule fois par session (comme le header)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (heroAnimationRef.current) return;
    
    // Durée de l'animation du header : 8 lettres * 120ms + 800ms (back-forward) + 600ms pause = 2360ms
    const headerAnimationDuration = 2360;
    
    heroAnimationRef.current = true;
    
    const timer1 = setTimeout(() => {
      setShowHeroTitle(true);
    }, headerAnimationDuration);
    
    const timer2 = setTimeout(() => {
      setShowHeroSubtitle(true);
    }, headerAnimationDuration + 200);
    
    const timer3 = setTimeout(() => {
      setShowHeroCarousel(true);
    }, headerAnimationDuration + 300);
    
    const timer4 = setTimeout(() => {
      setShowHeroBadges(true);
    }, headerAnimationDuration + 400);
    
    const timer5 = setTimeout(() => {
      setShowHeroCards(true);
      // Marquer comme fait dans sessionStorage (comme le header)
      try { sessionStorage.setItem("xcannes_hero_animated", "1"); } catch {}
    }, headerAnimationDuration + 500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
      clearTimeout(timer5);
    };
  }, []);

  // Intersection Observer pour l'animation au scroll des cartes hero
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = cardRefs.current.indexOf(entry.target);
            if (index !== -1) {
              setVisibleCards((prev) => new Set([...prev, index]));
            }
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px",
      }
    );

    cardRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Intersection Observer pour le conteneur grille des 3 cartes images (desktop)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = pillarGridRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPillarGridVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Auto-avancement du carrousel desktop (cartes 4 et 5) toutes les 5 secondes
  useEffect(() => {
    const interval = setInterval(() => {
      setDesktopCarouselIndex((prev) => (prev === 1 ? 0 : 1)); // 2 cartes (0-1)
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const openValueModal = () => {
    setValueModalClosing(false);
    setValueModalOpen(true);
  };

  const closeValueModal = () => {
    if (valueModalClosing) return;
    setValueModalClosing(true);
    if (valueModalCloseTimerRef.current) {
      window.clearTimeout(valueModalCloseTimerRef.current);
    }
    valueModalCloseTimerRef.current = window.setTimeout(() => {
      setValueModalOpen(false);
      setValueModalClosing(false);
      valueModalCloseTimerRef.current = null;
    }, getModalCloseDelay());
  };

  const openSecurityModal = () => {
    setSecurityModalClosing(false);
    setSecurityModalOpen(true);
  };

  const closeSecurityModal = () => {
    if (securityModalClosing) return;
    setSecurityModalClosing(true);
    if (securityModalCloseTimerRef.current) {
      window.clearTimeout(securityModalCloseTimerRef.current);
    }
    securityModalCloseTimerRef.current = window.setTimeout(() => {
      setSecurityModalOpen(false);
      setSecurityModalClosing(false);
      securityModalCloseTimerRef.current = null;
    }, getModalCloseDelay());
  };

  const openSpeedModal = () => {
    setSpeedModalClosing(false);
    setSpeedModalOpen(true);
  };

  const closeSpeedModal = () => {
    if (speedModalClosing) return;
    setSpeedModalClosing(true);
    if (speedModalCloseTimerRef.current) {
      window.clearTimeout(speedModalCloseTimerRef.current);
    }
    speedModalCloseTimerRef.current = window.setTimeout(() => {
      setSpeedModalOpen(false);
      setSpeedModalClosing(false);
      speedModalCloseTimerRef.current = null;
    }, getModalCloseDelay());
  };

  const openFeesModal = () => {
    setFeesModalClosing(false);
    setFeesModalOpen(true);
  };

  const closeFeesModal = () => {
    if (feesModalClosing) return;
    setFeesModalClosing(true);
    if (feesModalCloseTimerRef.current) {
      window.clearTimeout(feesModalCloseTimerRef.current);
    }
    feesModalCloseTimerRef.current = window.setTimeout(() => {
      setFeesModalOpen(false);
      setFeesModalClosing(false);
      feesModalCloseTimerRef.current = null;
    }, getModalCloseDelay());
  };

  return (
    <>
      <SEOHead
        title={t("ui_xcannes_multi_currency_walle_51c5a96da0", "XCANNES - Multi-currency wallet with stable USD value")}
        description="A non-custodial multi-currency wallet with a local-currency experience and stable USD value in the background. Send, pay, receive, and convert with clarity."
        canonical="/" />


      <Header />

      <div className="pt-16 home-content-wrapper">

        {/* LAYER 1 : Hero – sticky, reste derrière (desktop) */}
        <div className="sticky-layer sticky-layer--hero z-[1] bg-[#0b0f10]">
        <main className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[#0b0f10] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.025),transparent_55%)]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-[#0b0f10] md:h-36" />

            <div className="relative z-10 max-w-[1600px] mx-auto px-6 py-24 md:py-32">
            <div className="mx-auto max-w-6xl text-center">
                <h1 className={`text-[42px] sm:text-5xl md:text-7xl lg:text-8xl font-montserrat font-bold text-white leading-[1.05] tracking-tight transition-all duration-700 ${
                  showHeroTitle ? 'opacity-100 translate-x-0 translate-y-0' : 'opacity-0 -translate-x-16 translate-y-8'
                }`}>
                  {t("home_v2_hero_title", "Votre argent, stable dans 160+ devises.")}
                  <span className="block mt-3 md:mt-4 text-[26px] sm:text-[26px] md:text-[42px] lg:text-[52px] font-semibold text-white/90">
                    {t("home_v2_hero_title_emphasis", "Indexation USD réglementée.")}
                  </span>
                </h1>

                {/* Sous-titre sur mobile */}
                <p className={`mt-6 text-[17px] text-white/85 font-light leading-relaxed md:hidden transition-all duration-700 delay-200 ${
                  showHeroSubtitle ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}>
                  <span dangerouslySetInnerHTML={{
                    __html: t(
                      "home_v2_hero_subtitle",
                      "Payez, recevez et convertissez en toute simplicité.<br/>Rapide. Sécurisé. Transparent."
                    ).replace('⮕', '<span class="inline-block text-xcannes-green animate-pulse">⮕</span>')
                  }} />
                </p>

                {/* Badges store – visible sur mobile sous le titre, sur desktop après le sous-titre */}
                <div className={`mt-8 flex md:hidden flex-col items-center justify-center gap-4 transition-all duration-700 delay-300 ${
                  showHeroBadges ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}>
                  <p className="text-sm text-white/70">
                    {t(
                      "home_v2_hero_store_cta_hint",
                      "Téléchargez l'application XCANNES sur votre mobile."
                    )}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <a
                      href="#"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex"
                      aria-label={t("home_v2_hero_app_store_aria", "Télécharger XCANNES sur l'App Store")}
                    >
                      <Image
                        src={appStoreBadgeSrc}
                        alt={t("home_v2_hero_app_store_aria", "Télécharger XCANNES sur l'App Store")}
                        className="h-12 w-auto"
                        width={250}
                        height={83}
                        loading="lazy"
                        unoptimized
                      />
                    </a>
                    <a
                      href="#"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex"
                      aria-label={t("home_v2_hero_google_play_aria", "Télécharger XCANNES sur Google Play")}
                    >
                      <Image
                        src={googlePlayBadgeSrc}
                        alt={t("home_v2_hero_google_play_aria", "Télécharger XCANNES sur Google Play")}
                        className="h-[60px] w-auto"
                        width={646}
                        height={250}
                        loading="lazy"
                        unoptimized
                      />
                    </a>
                  </div>
                  {/* Lien PWA install — mobile uniquement */}
                  <a
                    href="/wallet-app/"
                    className="mt-3 inline-flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 3v12m0 0l-4-4m4 4l4-4" />
                    </svg>
                    {t("home_install_pwa_link", "Installer Xcannes App sur l'écran d'accueil")}
                  </a>
                </div>

                {/* Texte sur desktop uniquement */}
                <p className={`mt-8 md:mt-12 text-lg md:text-xl lg:text-2xl text-white/90 font-light leading-relaxed hidden md:block transition-all duration-700 delay-200 ${
                  showHeroSubtitle ? 'opacity-100 translate-x-0 translate-y-0' : 'opacity-0 translate-x-16 translate-y-8'
                }`}>
                  <span dangerouslySetInnerHTML={{
                    __html: t(
                      "home_v2_hero_subtitle",
                      "Payez, recevez et convertissez en toute simplicité.<br/>Rapide. Sécurisé. Transparent."
                    ).replace('⮕', '<span class="inline-block text-xcannes-green animate-pulse">⮕</span>')
                  }} />
                </p>

                <div className={`mt-10 hidden md:flex flex-col items-center justify-center gap-4 transition-all duration-700 delay-500 ${
                  showHeroBadges ? 'opacity-100 translate-x-0 translate-y-0' : 'opacity-0 translate-x-16 translate-y-8'
                }`}>
                  <p className="text-sm text-white/70">
                    {t(
                      "home_v2_hero_store_cta_hint",
                      "Téléchargez l'application XCANNES sur votre mobile."
                    )}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-4">
                    <a
                      href="#"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex"
                      aria-label={t("home_v2_hero_app_store_aria", "Télécharger XCANNES sur l'App Store")}
                    >
                      <Image
                        src={appStoreBadgeSrc}
                        alt={t("home_v2_hero_app_store_aria", "Télécharger XCANNES sur l'App Store")}
                        className="h-12 w-auto"
                        width={250}
                        height={83}
                        loading="lazy"
                        unoptimized
                      />
                    </a>

                    <a
                      href="#"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex"
                      aria-label={t("home_v2_hero_google_play_aria", "Télécharger XCANNES sur Google Play")}
                    >
                      <Image
                        src={googlePlayBadgeSrc}
                        alt={t("home_v2_hero_google_play_aria", "Télécharger XCANNES sur Google Play")}
                        className="h-[60px] w-auto"
                        width={646}
                        height={250}
                        loading="lazy"
                        unoptimized
                      />
                    </a>
                  </div>
                  {/* QR code pour installer Xcannes App — desktop uniquement */}
                  <div className="mt-5 flex flex-col items-center gap-2">
                    <p className="text-xs text-white/45">
                      {t("home_install_pwa_qr_label", "Ou installez Xcannes App (wallet web) :")}
                    </p>
                    <div className="inline-block rounded-xl bg-white p-2.5">
                      <QRCodeSVG
                        value={typeof window !== "undefined" ? `${window.location.origin}/wallet-app/` : "/wallet-app/"}
                        size={120}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <p className="text-[10px] text-white/30">
                      {t("home_install_pwa_qr_hint", "Scannez pour installer Xcannes App sur votre mobile")}
                    </p>
                  </div>
                </div>

            </div>
          </div>
        </main>
        </div>

        {/* LAYER 2 : Pillar cards – sticky, recouvrent le Hero */}
        <div className="sticky-layer sticky-layer--cover z-[2] bg-[#0b0f10]">
          <div className="relative z-10 max-w-[1600px] mx-auto px-6 pt-4 pb-10 md:pt-10 md:pb-24 overflow-visible">
            <div className="mx-auto max-w-6xl overflow-visible">

                {/* Carrousel des cartes sur mobile uniquement */}
                <MobileHeroCarousel 
                  show={showHeroCarousel}
                  onSpeedClick={openSpeedModal}
                  onSecurityClick={openSecurityModal}
                  onFeesClick={openFeesModal}
                  onValueClick={openValueModal}
                />

                {/* 3 premières cartes + carrousel pour les 2 dernières */}
                <div
                  ref={pillarGridRef}
                  className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-visible"
                >
                  {(() => {
                    const allCards = [
                  {
                  title: t("home_v2_hero_pillar_1_title", "Exécution instantanée"),
                  stat: t("home_v2_hero_pillar_1_stat", "≤ 3 s"),
                  subtitle: t("home_v2_hero_pillar_1_caption", "Paiement et conversion en temps réel."),
                  showLinkButton: false,
                  image: "/images/Rapidit%C3%A9%20transactions.png",
                  link: {
                    label: t("home_v2_hero_pillar_1_link", "Détails"),
                    onClick: () => openSpeedModal(),
                  },
                  icon:
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/65">
                        <path d="M10 13l2 2 7-7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 22A10 10 0 1 0 2 12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>

                },
                {
                  title: t("home_v2_hero_pillar_2_title", "Contrôle des transactions"),
                  desc: t(
                    "home_v2_hero_pillar_2_desc",
                    "Validation sécurisée sous votre autorité."
                  ),
                  showLinkButton: false,
                  image: "/images/Contr%C3%B4le%20s%C3%A9curis%C3%A9%20des%20transactions%20num%C3%A9riques.png",
                  link: {
                    label: t("home_v2_hero_pillar_2_link", "Détails"),
                    onClick: () => openSecurityModal(),
                  },
                  icon:
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/65">
                        <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 0 0 8 11a4 4 0 1 1 8 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0 0 15.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 0 0 8 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>

                },
                {
                  title: t("home_v2_hero_pillar_3_title", "Transparence des frais"),
                  desc: t(
                    "home_v2_hero_pillar_3_desc",
                    "Frais affichés avant chaque confirmation."
                  ),
                  showLinkButton: false,
                  image: "/images/Transparence%20des%20frais%20en%20Suisse%20et%20Colombie.png",
                  link: {
                    label: t("home_v2_hero_pillar_3_link", "Détails"),
                    onClick: () => openFeesModal(),
                  },
                  icon:
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/65">
                        <path d="M7 7h11l-2-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M17 17H6l2 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>

                },
                {
                  title: t("home_v2_hero_pillar_4_title", "Stabilité réglementée"),
                  desc: t(
                    "home_v2_hero_pillar_4_desc",
                    "Indexation USD conforme aux standards financiers.\nConversion multi-devises instantanée."
                  ),
	                  descClassName: "text-[16px] sm:text-[13px]",
	                  link: {
	                    label: t("home_v2_hero_pillar_4_link", "Détails"),
	                    onClick: () => openValueModal(),
                  },
                  icon:
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/65">
                        <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>

                },
                {
                  title: t("home_v2_hero_pillar_5_title", "Pour qui ?"),
                  desc: t(
                    "home_v2_hero_pillar_5_desc",
                    "Particuliers et entreprises recherchant stabilité et contrôle."
                  ),
	                  descClassName: "text-[16px] sm:text-[13px]",
                  icon:
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/65">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>

                }];
                    
                    const firstThreeCards = allCards.slice(0, 3);
                    const carouselCards = allCards.slice(3, 5);
                    
                    return (
                      <>
                        {/* 3 premières cartes */}
                        {firstThreeCards.map((item, index) => {
                          const isClickable = Boolean(item.link?.onClick);
                          const isVisible = pillarGridVisible || visibleCards.has(index);
                  return (
                    <div
                      key={item.title}
                      ref={(el) => (cardRefs.current[index] = el)}
                      role={isClickable ? "button" : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      onClick={isClickable ? item.link.onClick : undefined}
                      onKeyDown={
                        isClickable
                          ? (event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                item.link.onClick();
                              }
                            }
                          : undefined
                        }
		                      className={[
		                        "relative rounded-md",
		                        !item.image && "flex items-start gap-2.5 bg-white/90 px-4 py-7 md:py-4 overflow-hidden",
		                        !item.image && "md:hover:scale-[1.05] md:hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] md:hover:z-10 transition-all duration-300",
		                        isClickable
		                          ? "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/30"
		                          : "",
		                        item.className,
		                        "transition-[opacity,transform] duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
		                        isVisible 
		                          ? "opacity-100 translate-x-0 translate-y-0" 
		                          : [
		                              "opacity-0",
		                              // Desktop : gauche / bas / droite selon index
		                              index === 0 ? "md:-translate-x-[100vw] -translate-x-0 translate-y-8" :
		                              index === 1 ? "md:translate-y-[100vh] translate-y-8" :
		                              "md:translate-x-[100vw] translate-x-0 translate-y-8"
		                            ].join(" ")
	                      ].filter(Boolean).join(" ")}
	                      style={{
	                        transitionDelay: isVisible ? `${index * 350}ms` : "0ms"
	                      }}>

                    {item.image ? (
                      <div className="flip-card" style={{ perspective: '1200px' }}>
                        <div className="flip-card-inner">
                          {/* RECTO */}
                          <div className="flip-card-front">
                            <Image
                              src={item.image}
                              alt={item.title}
                              width={600}
                              height={400}
                              className="w-full h-auto rounded-md"
                              unoptimized
                            />
                          </div>
                          {/* VERSO */}
                          <div className="flip-card-back">
                            <span className="text-[28px] font-montserrat font-light tracking-wide text-white/90">
                              Bonjour
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                    <>
                    <div
                      className={[
                        "mt-0.5 flex items-center justify-center w-8 h-8 shrink-0",
                        item.iconWrapperClassName
                      ].filter(Boolean).join(" ")}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0 text-left flex-1 h-full flex flex-col">
                    <div className="flex w-full items-baseline justify-between gap-3">
                      <div className="text-[18px] sm:text-[17px] font-semibold text-black/90">{item.title}</div>
                    </div>
                    {item.subtitle ? (
                      <div className="mt-0.5 text-[17.5px] sm:text-[14.5px] text-black/75 italic">
                        {item.subtitle}
                      </div>
                    ) : null}
                    {item.stat ? (
                      <div className="mt-2 text-center">
                        <div className="text-3xl font-semibold text-black/90 leading-tight">
                          {item.stat}
                        </div>
                      </div>
                    ) : null}
                    {item.desc ? (
                      <div
                        className={[
                          "text-[17.5px] sm:text-[14.5px] text-black/75 leading-relaxed italic whitespace-pre-line",
                          item.stat ? "mt-1 text-center" : "",
                          item.descClassName
                        ].filter(Boolean).join(" ")}
                      >
                        {item.desc}
                      </div>
                    ) : null}
                    {item.link && item.showLinkButton !== false ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          item.link.onClick();
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-black/70 hover:text-xcannes-green/80 transition-colors shrink-0 mt-auto self-end pt-3"
                      >
                        {item.link.label}
                      </button>
                    ) : null}
                  </div>
                  </>
                    )}
                  </div>
                );
              })}
                
                {/* Carrousel pour les cartes 4 et 5 */}
                <div className="order-first sm:order-none lg:order-first lg:col-span-3 mb-5 sm:mb-0 lg:mb-6 relative">
                  {carouselCards.map((card, idx) => {
                    const cardIndex = idx + 3;
                    const isCardClickable = Boolean(card.link?.onClick);
                    return (
                    <div
                      key={card.title}
                      className={`transition-all duration-500 ease-in-out ${
                        idx === desktopCarouselIndex
                          ? 'opacity-100 relative'
                          : 'opacity-0 absolute inset-0 pointer-events-none'
                      }`}
                    >
                      <div
                        ref={(el) => (cardRefs.current[cardIndex] = el)}
                        role={isCardClickable ? "button" : undefined}
                        tabIndex={isCardClickable ? 0 : undefined}
                        onClick={isCardClickable ? card.link.onClick : undefined}
                        onKeyDown={
                          isCardClickable
                            ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  card.link.onClick();
                                }
                              }
                            : undefined
                          }
                        className="flex items-start gap-2.5 bg-white/90 hover:bg-white/80 rounded-md px-4 py-5 md:py-4 min-h-[140px] cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black/30"
                      >
                        <div className="mt-0.5 flex items-center justify-center w-8 h-8 lg:w-11 lg:h-11 shrink-0">
                          {card.icon}
                        </div>
                        <div className="min-w-0 text-left flex-1 h-full flex flex-col">
                          <div className="flex w-full items-baseline justify-between gap-3">
                            <div className="text-[18px] sm:text-[17px] font-semibold text-black/90">{card.title}</div>
                          </div>
                          {card.desc ? (
                            <div className={["text-[17.5px] sm:text-[14.5px] text-black/75 leading-relaxed italic whitespace-pre-line", card.descClassName].filter(Boolean).join(" ")}>
                              {card.desc}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
        </div>
            </div>
          </div>
        </div>

        {/* LAYER 3 : Reste de la page – recouvre les cartes (desktop) */}
        <div className="sticky-layer--cover relative z-[3] bg-[#0b0f10]">
          <WalletProductSection />
          <section className="relative py-14 sm:py-16 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto text-center">
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-montserrat font-[300] text-white/90 tracking-[0.02em]">
                {t("home_v2_demo_slogan", "Votre argent. Partout. Intact.")}
              </h3>
            </div>
          </section>
          <FooterPro />
        </div>

        {speedModalRoot &&
          (speedModalOpen || speedModalClosing) &&
          createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeSpeedModal();
              }}
            >
              <div
                className={`w-full max-w-[560px] rounded-xl border border-white/10 bg-elevated p-6 sm:p-7 flex flex-col ${
                  speedModalClosing ? "modal-slide-left-out" : "modal-slide-right-in"
                } motion-reduce:animate-none`}
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xcannes-green/90">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-[21px] sm:text-[24px] font-semibold text-white leading-tight">
                        {t("home_v2_hero_speed_modal_title", "Pourquoi c'est rapide")}
                      </h4>
                      <p className="mt-1.5 text-[17.5px] sm:text-[13.5px] text-white/65 leading-[1.5]">
                        {t(
                          "home_v2_hero_speed_modal_subtitle",
                          "XCANNES s'appuie sur le réseau XRP Ledger pour valider les transactions en quelques secondes."
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeSpeedModal()}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors shrink-0"
                    aria-label={t("home_v2_hero_speed_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-5 flex-1 min-h-0 overflow-y-auto pr-2 md:overflow-visible md:pr-0">
                  <div className="space-y-3">
                    {[
                      t(
                        "home_v2_hero_speed_modal_point_1",
                        "Transactions XRPL natives : validation on-chain en quelques secondes."
                      ),
                      t(
                        "home_v2_hero_speed_modal_point_2",
                        "Signature immédiate dans votre wallet, sans délais bancaires."
                      ),
                      t(
                        "home_v2_hero_speed_modal_point_3",
                        "Transactions préremplies : vous validez, c'est terminé."
                      ),
                      t(
                        "home_v2_hero_speed_modal_point_4",
                        "Engagement XCANNES : < 3 s en conditions normales."
                      ),
                    ].map((line) => (
                      <div key={line} className="flex items-start gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-xcannes-green/70 flex-shrink-0" />
                        <span className="text-[18.5px] sm:text-[14.5px] text-white/80 leading-relaxed">{line}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 text-[16.5px] sm:text-[12.5px] text-white/50 italic leading-relaxed">
                    {t(
                      "home_v2_hero_speed_modal_note",
                      "En cas de congestion rare du réseau, le délai peut être légèrement supérieur."
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => closeSpeedModal()}
                    className="px-6 py-2 rounded-lg border border-white/15 bg-white/[0.04] text-white text-[14px] font-medium backdrop-blur-md transition-all duration-200 hover:border-xcannes-green/40 hover:bg-white/[0.08] hover:shadow-[0_0_18px_rgba(24,169,113,0.25)]"
                  >
                    {t("home_v2_hero_speed_modal_cta", "Compris")}
                  </button>
                </div>
              </div>
            </div>,
            speedModalRoot
          )}
        {securityModalRoot &&
          (securityModalOpen || securityModalClosing) &&
          createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeSecurityModal();
              }}
            >
              <div
                className={`w-full max-w-[560px] rounded-xl border border-white/10 bg-elevated p-6 sm:p-7 flex flex-col ${
                  securityModalClosing ? "modal-slide-down-out" : "modal-slide-up-in"
                } motion-reduce:animate-none`}
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xcannes-green/90">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3l8 4v6c0 5-4 7.5-8 8-4-0.5-8-3-8-8V7l8-4z" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-[23px] sm:text-[24px] font-semibold text-white leading-tight">
                        {t("home_v2_hero_security_modal_title", "Sécurisé")}
                      </h4>
                      <p className="mt-1.5 text-[15.5px] sm:text-[13.5px] text-white/65 leading-[1.5]">
                        {t(
                          "home_v2_hero_security_modal_subtitle",
                          "Chaque transaction est validée sous votre contrôle exclusif."
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeSecurityModal()}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors shrink-0"
                    aria-label={t("home_v2_hero_security_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-5 flex-1 min-h-0 overflow-y-auto pr-2 md:overflow-visible md:pr-0">
                  <div className="space-y-3">
                    {[
                      t(
                        "home_v2_hero_security_modal_point_1",
                        "Non‑custodial : XCANNES ne détient pas vos fonds."
                      ),
                      t(
                        "home_v2_hero_security_modal_point_2",
                        "Chaque action est validée par vous, jamais automatiquement."
                      ),
                      t(
                        "home_v2_hero_security_modal_point_3",
                        "Transactions enregistrées sur le réseau, traçables et vérifiables."
                      ),
                      t(
                        "home_v2_hero_security_modal_point_5",
                        "XCANNES renforce la sécurité des transactions grâce à un wallet non-custodial intégré à l’écosystème XRPL."
                      ),
                      t(
                        "home_v2_hero_security_modal_point_4",
                        "Les transactions ne peuvent être validées qu’après authentification sur l’appareil de l’utilisateur, par code PIN ou biométrie."
                      ),
                    ].map((line) => (
                      <div key={line} className="flex items-start gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-xcannes-green/70 flex-shrink-0" />
                        <span className="text-[16.5px] sm:text-[14.5px] text-white/80 leading-relaxed">{line}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 text-[14.5px] sm:text-[12.5px] text-white/50 italic leading-relaxed">
                    {t(
                      "home_v2_hero_security_modal_note",
                      "Vous gardez le contrôle, XCANNES n’agit jamais à votre place."
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => closeSecurityModal()}
                    className="px-6 py-2 rounded-lg border border-white/15 bg-white/[0.04] text-white text-[14px] font-medium backdrop-blur-md transition-all duration-200 hover:border-xcannes-green/40 hover:bg-white/[0.08] hover:shadow-[0_0_18px_rgba(24,169,113,0.25)]"
                  >
                    {t("home_v2_hero_security_modal_cta", "Compris")}
                  </button>
                </div>
              </div>
            </div>,
            securityModalRoot
          )}
        {feesModalRoot &&
          (feesModalOpen || feesModalClosing) &&
          createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeFeesModal();
              }}
            >
              <div
                className={`w-full max-w-[560px] rounded-xl border border-white/10 bg-elevated p-6 sm:p-7 ${
                  feesModalClosing ? "modal-slide-right-out" : "modal-slide-left-in"
                } motion-reduce:animate-none`}
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xcannes-green/90">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-[23px] sm:text-[24px] font-semibold text-white leading-tight">
                        {t("home_v2_hero_fees_modal_title", "Économique")}
                      </h4>
                      <p className="mt-1.5 text-[19.5px] sm:text-[13.5px] text-white/65 leading-[1.5]">
                        {t(
                          "home_v2_hero_fees_modal_subtitle",
                          "Des coûts maîtrisés, affichés avant confirmation."
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeFeesModal()}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors shrink-0"
                    aria-label={t("home_v2_hero_fees_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-5 space-y-3">
                  {[
                    t(
                      "home_v2_hero_fees_modal_point_2",
                      "Frais de conversion : 1 % quelle que soit la devise."
                    ),
                    t(
                      "home_v2_hero_fees_modal_point_3",
                      "Aucun frais XCANNES sur l’envoi et la réception."
                    ),
                    t(
                      "home_v2_hero_fees_modal_point_currency_lines_free_f5",
                      "Activation ou désactivation d’une ligne de compte : gratuit (hors frais réseau XRPL)."
                    ),
                  ].map((line) => (
                    <div key={line} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-xcannes-green/70 flex-shrink-0" />
                      <span className="text-[20.5px] sm:text-[14.5px] text-white/80 leading-relaxed">{line}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 text-[18.5px] sm:text-[12.5px] text-white/50 italic leading-relaxed">
                  {t(
                    "home_v2_hero_fees_modal_note_currency_lines_free_f5",
                    "Aucun frais XCANNES n’est prélevé pour activer une devise."
                  )}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => closeFeesModal()}
                    className="px-6 py-2 rounded-lg border border-white/15 bg-white/[0.04] text-white text-[14px] font-medium backdrop-blur-md transition-all duration-200 hover:border-xcannes-green/40 hover:bg-white/[0.08] hover:shadow-[0_0_18px_rgba(24,169,113,0.25)]"
                  >
                    {t("home_v2_hero_fees_modal_cta", "Compris")}
                  </button>
                </div>
              </div>
            </div>,
            feesModalRoot
          )}
        {valueModalRoot &&
          (valueModalOpen || valueModalClosing) &&
          createPortal(
            <div
              className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeValueModal();
              }}
            >
              <div
                className={`w-full max-w-[560px] rounded-xl border border-white/10 bg-elevated p-6 sm:p-7 ${
                  valueModalClosing ? "modal-slide-up" : "modal-slide-down"
                } motion-reduce:animate-none`}
              >
                {/* Header avec icône */}
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex items-start gap-3">
                    {/* Icône ancre/bouclier */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                      <svg className="w-5 h-5 text-xcannes-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-[23px] sm:text-[24px] font-semibold text-white leading-tight">
                        {t("home_v2_hero_value_modal_title", "Protégé contre la volatilité")}
                      </h4>
                      <p className="mt-1.5 text-[13.5px] text-white/65 leading-[1.5]">
                        {t(
                          "home_v2_hero_value_modal_subtitle",
                          "Même si la devise locale bouge, votre référence USD (RLUSD) reste la même."
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeValueModal()}
                    className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                    aria-label={t("home_v2_hero_value_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>

                {/* Points principaux */}
                <div className="mt-5 space-y-3">
                  {(
                    isMobile
                      ? [
                          {
                            key: "point_1",
                            text: t(
                              "home_v2_hero_value_modal_point_1",
                              "Le montant que vous validez est en devise locale."
                            ),
                          },
                        ]
                      : [
                          {
                            key: "point_1",
                            text: t(
                              "home_v2_hero_value_modal_point_1",
                              "Le montant que vous validez est en devise locale."
                            ),
                          },
                          {
                            key: "point_2",
                            text: t(
                              "home_v2_hero_value_modal_point_2",
                              "Les montants locaux suivent le taux du marché."
                            ),
                          },
                          {
                            key: "point_3",
                            text: t(
                              "home_v2_hero_value_modal_point_3",
                              "La référence USD (RLUSD) reste stable et lisible."
                            ),
                          },
                        ]
                  ).map((line) => (
                    <div key={line.key} className="flex items-start gap-3">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-xcannes-green/70 flex-shrink-0" />
                      <span className="text-[14.5px] text-white/80 leading-relaxed">{line.text}</span>
                    </div>
                  ))}
                </div>

                {/* Bloc Exemple visuel */}
                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-[12px] font-semibold text-xcannes-green uppercase tracking-[0.2em]">
                      {t("home_v2_hero_value_modal_example_title", "Exemple")}
                    </div>
                    {t("home_v2_hero_value_modal_example_rate", "").trim() ? (
                      <div className="text-[11px] text-white/50">
                        {t("home_v2_hero_value_modal_example_rate", "Taux initial 1,18 → 1,10")}
                      </div>
                    ) : null}
                  </div>

                  {t("home_v2_hero_value_modal_example_intro", "").trim() ? (
                    <p className="text-[13.5px] text-white/65 leading-relaxed mb-4">
                      {t(
                        "home_v2_hero_value_modal_example_intro",
                        "Si vous convertissez 1 EUR au taux 1,18, votre référence devient 1,18 RLUSD."
                      )}
                    </p>
                  ) : null}

                  {/* Mini-schéma visuel */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2 text-[12px] text-white/60 mb-3">
                      <div className="flex items-center justify-center w-7 h-7 rounded-md border border-white/10 bg-white/[0.03] text-xcannes-green/90">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 7l6 6 4-4 6 6" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M20 19H4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span className="font-medium">{t("home_v2_hero_value_modal_example_if_eur_falls", "Si l'euro baisse")}</span>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] text-white/45 uppercase tracking-[0.18em] mb-1">
                          {t("home_v2_hero_value_modal_example_today", "Aujourd'hui")}
                        </div>
                        <div className="text-[14px] text-white">1 EUR = 1,18$</div>
                        <div className="text-[12px] text-white/55">
                          {t("home_v2_hero_value_modal_example_ref", "Réf")} : 1,18$
                        </div>
                      </div>

                      {t("home_v2_hero_value_modal_example_rate_moves", "").trim() ? (
                        <div className="flex items-center justify-center gap-2 text-[11px] text-white/45">
                          <span>{t("home_v2_hero_value_modal_example_rate_moves", "Le taux change")}</span>
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M7 14l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ) : null}

                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                        <div className="text-[10px] text-white/45 uppercase tracking-[0.18em] mb-1">
                          {t("home_v2_hero_value_modal_example_later", "Plus tard")}
                        </div>
                        <div className="text-[14px] text-white">1 EUR = 1,10$</div>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-white">EUR ≈ 1,07</span>
                            <span className="text-[10px] text-white/45 uppercase tracking-wide">
                              {t("home_v2_hero_value_modal_example_change", "change")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[12px]">
                            <span className="text-xcannes-green">USD = 1,18$</span>
                            <span className="text-[10px] text-white/45 uppercase tracking-wide">
                              {t("home_v2_hero_value_modal_example_stable", "stable")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-[12px] text-white/60">
                      <div className="flex items-center justify-center w-6 h-6 rounded-md border border-white/10 bg-white/[0.03] text-xcannes-green/90">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 3l8 4v6c0 5-4 7.5-8 8-4-0.5-8-3-8-8V7l8-4z" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <span>{t("home_v2_hero_value_modal_example_usd_anchor", "Référence USD inchangée")}</span>
                    </div>
                  </div>

                  {t("home_v2_hero_value_modal_example_conclusion", "").trim() ? (
                    <div className="mt-4 text-[13.5px] text-white/65 leading-relaxed border-t border-white/10 pt-3">
                      {t(
                        "home_v2_hero_value_modal_example_conclusion",
                        "Si le taux passe à 1,10, l'affichage devient ≈ 1,07 EUR, mais la référence reste 1,18 RLUSD. Vous décidez quand reconvertir."
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Note finale */}
                <div className="mt-5 text-[12.5px] text-white/50 italic leading-relaxed">
                  {t(
                    "home_v2_hero_value_modal_note",
                    "L'affichage local varie avec le marché ; la référence reste USD (RLUSD)."
                  )}
                </div>

                {/* Bouton CTA discret */}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={() => closeValueModal()}
                    className="px-6 py-2 rounded-lg border border-white/15 bg-white/[0.04] text-white text-[14px] font-medium backdrop-blur-md transition-all duration-200 hover:border-xcannes-green/40 hover:bg-white/[0.08] hover:shadow-[0_0_18px_rgba(24,169,113,0.25)]"
                  >
                    {t("home_v2_hero_value_modal_cta", "Compris")}
                  </button>
                </div>
              </div>
            </div>,
            valueModalRoot
          )}
      </div>

      <SupportAssistantWidget />
    </>);

}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await getPageTranslations(locale, ["common"]))
    }
  };
}
