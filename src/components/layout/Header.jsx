import Link from "next/link";
import HeaderLanguageStrip from "./HeaderLanguageStrip";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { lockBodyScroll } from "@/utils/bodyScrollLock";
import { useXumm } from "@/context/XummContext";

export default function Header({ fixed = true }) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const isHome = router.pathname === "/";
  const { isConnected, isConnecting, connect, disconnect } = useXumm();

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Animation du header sur la page index (desktop uniquement)
  const [showHeroHeader, setShowHeroHeader] = useState(false);
  const [animationComplete, setAnimationComplete] = useState(false);
  const hasAnimatedRef = useRef(false);
  
  // État pour l'affichage temporaire des boutons sur mobile après l'animation
  const [showMobileButtons, setShowMobileButtons] = useState(false);

  const withHardNavFallback = useCallback(
    (href, { onBeforeFallback } = {}) =>
    (e) => {
      if (typeof window === "undefined") return;
      if (!e || e.defaultPrevented) return;
      if (e.button != null && e.button !== 0) return; // only left click
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // keep new-tab behavior

      const rawHref =
      e?.currentTarget?.getAttribute?.("href") || String(href || "");
      if (!rawHref) return;

      let didStart = false;
      let didComplete = false;
      let didError = false;
      let didFallback = false;
      const events = router?.events;
      let quickFallbackTimer;
      let stuckFallbackTimer;

      const hrefUrl = new URL(rawHref, window.location.origin);
      const targetPath = hrefUrl.pathname + hrefUrl.search + hrefUrl.hash;

      const normalizeAsPath = (value) => {
        if (!value) return "";
        try {
          const u = new URL(String(value), window.location.origin);
          return u.pathname + u.search + u.hash;
        } catch {
          return String(value);
        }
      };

      const stripLocalePrefix = (asPath) => {
        const normalized = normalizeAsPath(asPath);
        const locales = router?.locales || [];
        for (const locale of locales) {
          const prefix = `/${locale}`;
          if (normalized === prefix) return "/";
          if (normalized.startsWith(`${prefix}/`)) {
            return normalized.slice(prefix.length) || "/";
          }
        }
        return normalized;
      };

      const matchesTarget = (url) => {
        const normalized = normalizeAsPath(url);
        return stripLocalePrefix(normalized) === stripLocalePrefix(targetPath);
      };

      const cleanup = () => {
        if (!events?.off) return;
        events.off("routeChangeStart", markStart);
        events.off("routeChangeComplete", markComplete);
        events.off("routeChangeError", markError);
        if (quickFallbackTimer) window.clearTimeout(quickFallbackTimer);
        if (stuckFallbackTimer) window.clearTimeout(stuckFallbackTimer);
      };

      const doFallback = () => {
        if (didFallback) return;
        if (didComplete) return;
        didFallback = true;
        cleanup();
        onBeforeFallback?.();
        window.location.assign(hrefUrl.toString());
      };

      const markStart = (url) => {
        if (!matchesTarget(url)) return;
        didStart = true;
      };
      const markComplete = (url) => {
        if (!matchesTarget(url)) return;
        didComplete = true;
        cleanup();
      };
      const markError = (url) => {
        if (!matchesTarget(url)) return;
        didError = true;
        cleanup();
        window.setTimeout(doFallback, 0);
      };

      if (events?.on) {
        events.on("routeChangeStart", markStart);
        events.on("routeChangeComplete", markComplete);
        events.on("routeChangeError", markError);
      }

      // If Next router doesn't even start, fallback quickly.
      quickFallbackTimer = window.setTimeout(() => {
        if (didComplete) return;
        if (!didStart) doFallback();
      }, 450);

      // If router started but got stuck (or errored without proper recovery), fallback later.
      stuckFallbackTimer = window.setTimeout(() => {
        if (didComplete) return;
        if (didError || didStart) doFallback();
      }, 2200);
    },
    [router?.events, router?.locales]
  );

  const withMobileNavDelay = useCallback(
    (href, { delay = 350 } = {}) =>
    (e) => {
      if (typeof window === "undefined") return;
      if (!e || e.defaultPrevented) return;
      if (e.button != null && e.button !== 0) return; // only left click
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // keep new-tab behavior

      e.preventDefault();

      const linkEl = e.currentTarget;
      if (linkEl?.classList) linkEl.classList.add("is-animating");

      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const effectiveDelay = reduceMotion ? 0 : delay;

      window.setTimeout(() => {
        if (linkEl?.classList) linkEl.classList.remove("is-animating");
        setMenuOpen(false);

        const safeTarget = linkEl || { getAttribute: () => String(href || "") };
        const handler = withHardNavFallback(href);
        handler({
          defaultPrevented: false,
          button: 0,
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          currentTarget: safeTarget,
        });

        router.push(href);
      }, effectiveDelay);
    },
    [router, withHardNavFallback]
  );

  const walletActionLabel = isConnected
    ? t("nav_sign_out", "Se déconnecter")
    : t("nav_sign_in", "Se connecter");
  const showHomeWalletLink = isHome && isConnected;
  const walletActionToneClass = isConnected
    ? "text-white hover:text-white border border-white/25 hover:border-white/40 bg-transparent hover:bg-white/10 transition-transform duration-200 hover:scale-105 active:scale-95 header-nav-link-no-arrow-anim"
    : "text-white/80 hover:text-white bg-transparent header-nav-link-no-arrow-anim";

  const handleWalletAction = useCallback(async () => {
    if (isConnecting) return;

    if (isConnected) {
      await disconnect();
      if (router.pathname === "/wallet") {
        router.replace("/");
      }
      return;
    }

    connect();
  }, [connect, disconnect, isConnected, isConnecting, router]);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Ferme le menu mobile lors du scroll
  useEffect(() => {
    if (!menuOpen) return;
    
    const handleScroll = () => {
      setMenuOpen(false);
    };
    
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [menuOpen]);

  // Animation d'ouverture du header sur la page index (desktop ET mobile)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isHome) return;
    
    // L'animation ne se joue qu'une seule fois
    if (hasAnimatedRef.current) {
      setAnimationComplete(true);
      return;
    }
    
    hasAnimatedRef.current = true;
    setShowHeroHeader(true);
    
    // Ajoute la classe au body pour ajuster le padding du contenu
    document.body.classList.add('header-hero-mode');
    
    // Titre complet : "XCANNES" (8 lettres seulement pour l'animation)
    // Durée : ~120ms par caractère pour l'apparition + 1200ms pour arrière-avant
    const titleLength = "XCANNES".length;
    const charDelay = 120; // ms par caractère pour l'apparition (ralenti pour plus d'effet)
    const backForwardDuration = 1200; // 500ms arrière + 700ms avant (plus long et visible)
    const totalAnimationDuration = titleLength * charDelay + backForwardDuration + 300; // +300ms de pause
    
    const timer = setTimeout(() => {
      setShowHeroHeader(false);
      setAnimationComplete(true);
      // Retire la classe du body pour que le contenu remonte
      document.body.classList.remove('header-hero-mode');
      
      // Sur mobile uniquement : affiche les boutons pendant 3 secondes
      if (window.matchMedia("(max-width: 767px)").matches) {
        setShowMobileButtons(true);
        
        const mobileButtonsTimer = setTimeout(() => {
          setShowMobileButtons(false);
        }, 3000); // 3 secondes
        
        return () => clearTimeout(mobileButtonsTimer);
      }
    }, totalAnimationDuration);
    
    return () => {
      clearTimeout(timer);
      document.body.classList.remove('header-hero-mode');
    };
  }, [isHome]);

  const headerBgClass = (() => {
    // Home: fond noir uniforme
    if (isHome) {
      return scrolled ?
      "bg-[#07090A] backdrop-blur-md border-white/10" :
      "bg-[#07090A] backdrop-blur-sm border-white/5";
    }

    // Autres pages : header sombre classique
    return scrolled ?
    "bg-[#07090A] backdrop-blur-md border-white/10" :
    "bg-[#07090A] backdrop-blur-sm border-white/5";
  })();

  // Composant pour l'animation lettre par lettre
  const AnimatedTitle = ({ text, delay = 50, isMobile = false }) => {
    const [displayedText, setDisplayedText] = useState("");
    const [showSubtitle, setShowSubtitle] = useState(false);
    const [finalAnimation, setFinalAnimation] = useState(''); // '', 'back', 'forward'
    
    useEffect(() => {
      const xcannesText = "XCANNES";
      let currentIndex = 0;
      const interval = setInterval(() => {
        if (currentIndex <= xcannesText.length) {
          setDisplayedText(xcannesText.slice(0, currentIndex));
          currentIndex++;
        } else {
          clearInterval(interval);
          // Affiche immédiatement le sous-titre après XCANNES
          setShowSubtitle(true);
          // Après l'apparition complète, animation arrière-avant
          setTimeout(() => {
            setFinalAnimation('back');
            setTimeout(() => {
              setFinalAnimation('forward');
            }, 500); // Durée de l'arrière (augmentée pour visibilité)
          }, 200); // Pause avant le début de l'animation
        }
      }, delay);
      
      return () => clearInterval(interval);
    }, [text, delay]);
    
    // "XCANNES" avec animation
    const xcannesToShow = displayedText;
    // "Compte multi-devises" apparaît directement
    const subtitle = "Compte multi-devises";
    
    const renderText = (textPart, className) => {
      return textPart.split('').map((char, idx) => {
        // Pour les espaces, utiliser un caractère non-sécable et une largeur minimale
        const isSpace = char === ' ';
        return (
          <span
            key={idx}
            className={`inline-block ${className} ${isSpace ? 'min-w-[0.5rem]' : ''}`}
          >
            {isSpace ? '\u00A0' : char}
          </span>
        );
      });
    };
    
    // Classes pour l'animation arrière-avant finale
    const getContainerClass = () => {
      if (finalAnimation === 'back') {
        return 'animate-title-back';
      }
      if (finalAnimation === 'forward') {
        return 'animate-title-forward';
      }
      return '';
    };
    
    // Desktop ET Mobile : retour à la ligne, sans pipe
    return (
      <span className={`relative ${getContainerClass()} flex flex-col items-center gap-2 md:gap-3`}>
        <span className="font-bold block">
          {renderText(xcannesToShow, '')}
        </span>
        {showSubtitle && (
          <span className="font-thin italic text-white/90 block text-3xl md:text-5xl">
            {subtitle}
          </span>
        )}
      </span>
    );
  };

  // État hero avec animation (desktop ET mobile, page index)
  const isHeroMode = isHome && showHeroHeader;
  const [isMobileView, setIsMobileView] = useState(false);
  
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const checkMobile = () => {
      setIsMobileView(window.matchMedia("(max-width: 767px)").matches);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <header
      className={`w-full ${isHeroMode ? 'h-96 md:h-[28rem]' : 'h-16 md:h-20'} ${
      fixed ? "fixed top-0 left-0 z-50" : "relative z-20"} px-6 flex items-center ${isHeroMode ? 'justify-center' : 'justify-between'} font-montserrat transition-all duration-500 border-b ${
      headerBgClass} text-white ${isHeroMode ? 'header-with-shadow' : ''}`}
      style={isHeroMode ? { boxShadow: '0 8px 32px rgba(255, 255, 255, 0.15), 0 4px 16px rgba(255, 255, 255, 0.1)' } : {}}>

      {isHeroMode ? (
        // Mode Hero : titre centré avec animation lettre par lettre + effet high-tech
        <div className="flex flex-col items-center justify-center" style={{ perspective: '2000px', perspectiveOrigin: 'center center' }}>
          <h1 className="text-5xl md:text-9xl font-orbitron tracking-tight text-white" style={{ textShadow: '0 0 30px rgba(59, 130, 246, 0.5), 0 0 60px rgba(59, 130, 246, 0.3), 0 0 90px rgba(59, 130, 246, 0.2)' }}>
            <AnimatedTitle text="XCANNES | Compte multi-devises" delay={120} isMobile={isMobileView} />
          </h1>
        </div>
      ) : (
        <>
          {/* Logo simple texte style banque suisse */}
          <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
            <span className="text-lg sm:text-xl md:text-3xl font-orbitron font-bold tracking-tight text-white">
              {t("ui_xcannes_43b38baa2c", "XCANNES")}
            </span>
            <span className="hidden sm:inline text-[10px] sm:text-[11px] md:text-[13px] text-white/40 font-light">
              |
            </span>
            <span className="hidden sm:inline text-[15px] sm:text-[17px] md:text-[19px] text-white/60 font-light italic tracking-wide truncate">
              {t("header_tagline", "Compte multi-devises")}
            </span>
          </div>

          <div className="flex items-center gap-5">
        {/* Navigation épurée - Desktop toujours, Mobile temporairement après animation */}
        <nav className={`items-center gap-30 font-[300] transition-opacity duration-300 ${
          // Desktop : hidden md:flex avec text-xl
          // Mobile : affichage conditionnel avec showMobileButtons et text réduit
          showMobileButtons ? 'flex md:flex text-sm md:text-xl' : 'hidden md:flex md:text-xl'
        } ${animationComplete || !isHome ? 'opacity-100' : 'opacity-0'}`}>
          {!isHome &&
          <Link
            href="/"
            className="header-nav-link"
            onClick={withHardNavFallback("/")}>

              <span className="header-nav-label">{t("nav_home")}</span>
              <span aria-hidden="true" className="header-nav-arrow">&gt;</span>
            </Link>
          }

	          {showHomeWalletLink &&
	          <Link
	            href="/wallet"
	            className="header-nav-link header-nav-link-white-hover"
	            onClick={withHardNavFallback("/wallet")}>

	              <span className="header-nav-label">
	                {t("nav_multi_currency_account", "Mes comptes")}
	              </span>
	            </Link>
	          }

	          <button
	            type="button"
	            className={`header-nav-link rounded-md px-3 py-1.5 ${walletActionToneClass} disabled:opacity-60 disabled:cursor-not-allowed`}
	            onClick={handleWalletAction}
	            disabled={isConnecting}>

	            <span className="header-nav-label">{walletActionLabel}</span>
	          </button>

        </nav>

        <HeaderLanguageStrip 
          className={`${showMobileButtons ? 'flex md:flex' : 'hidden md:flex'} ml-4 transition-opacity duration-300 ${animationComplete || !isHome ? 'opacity-100' : 'opacity-0'}`} 
          compact={showMobileButtons}
        />

	        {/* Menu mobile minimaliste - masqué pendant l'animation et pendant l'affichage des boutons, puis visible */}
	        <button
	          className={`md:hidden text-white focus:outline-none hover:text-white/90 transition-opacity duration-300 ${
	            (animationComplete || !isHome) && !showMobileButtons ? 'opacity-100' : 'opacity-0 pointer-events-none'
	          }`}
	          onClick={() => setMenuOpen(!menuOpen)}
	          aria-label={t("ui_toggle_menu_9e88e70e51", "Toggle menu")}
	          aria-expanded={menuOpen}>
          <span className={`header-burger ${menuOpen ? "is-open" : ""}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <div
        className={`fixed ${isHeroMode ? 'top-96' : 'top-16'} left-0 right-0 bottom-0 md:hidden bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />

      <div
        className={`absolute ${isHeroMode ? 'top-96' : 'top-16'} left-0 w-full bg-black/95 backdrop-blur-md text-white flex flex-col items-center gap-6 md:hidden border-b border-white/10 overflow-hidden transition-all duration-500 ease-out z-50 ${
          menuOpen
            ? "opacity-100 translate-y-0 pointer-events-auto max-h-[420px] py-8"
            : "opacity-0 -translate-y-2 pointer-events-none max-h-0 py-0"
        }`}
        aria-hidden={!menuOpen}
      >
          {!isHome &&
        <Link
          href="/"
          onClick={withMobileNavDelay("/")}
          className="header-nav-link w-full justify-between px-8">

              <span className="header-nav-label">{t("nav_home")}</span>
              <span aria-hidden="true" className="header-nav-arrow">&gt;</span>
            </Link>
        }

	          {showHomeWalletLink &&
	          <Link
	            href="/wallet"
	            onClick={withMobileNavDelay("/wallet")}
	            className="header-nav-link header-nav-link-white-hover w-full justify-between px-8">

	              <span className="header-nav-label">
	                {t("nav_multi_currency_account", "Mes comptes")}
	              </span>
	            </Link>
	          }

	          <button
	            type="button"
	            onClick={() => {
	              setMenuOpen(false);
	              handleWalletAction();
	            }}
	            className={`header-nav-link w-full justify-between px-8 rounded-md ${walletActionToneClass} disabled:opacity-60 disabled:cursor-not-allowed`}
	            disabled={isConnecting}>

	            <span className="header-nav-label">{walletActionLabel}</span>
	          </button>

          <div className="pt-2 w-full flex justify-start px-8">
            <HeaderLanguageStrip />
          </div>

        </div>
        </>
      )}
    </header>
  );

}
