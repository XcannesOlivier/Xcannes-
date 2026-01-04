"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { apiUrl } from "@/lib/runtimeConfig";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

export default function NewsFeed({ category = "finance" }) {
  const router = useRouter();
  const currentLocale = router.locale || "en";
  
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ locale: '', language: '', count: 0 });
  const [autoScroll, setAutoScroll] = useState(true);
  
  const scrollContainerRef = useRef(null);
  const autoScrollIntervalRef = useRef(null);

  // Charger les articles depuis l'API backend
  useEffect(() => {
    const fetchNews = async () => {
      try {
        setLoading(true);
        setError(null);

        // Récupérer le pays depuis localStorage (défaut: United Kingdom)
        const selectedCountry = typeof window !== 'undefined' 
          ? localStorage.getItem('selectedCountry') || 'United Kingdom'
          : 'United Kingdom';

        const url = apiUrl(`/news?country=${encodeURIComponent(selectedCountry)}&limit=20`);
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        setNews(data.articles || []);
        setStats({
          locale: data.locale,
          language: data.language,
          count: data.count
        });

        if (DEBUG_LOGS) {
          console.log(`[NewsFeed] Loaded ${data.count} articles from ${selectedCountry}`);
        }
      } catch (err) {
        console.error('[NewsFeed] Error fetching news:', err);
        setError('Unable to load news');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    
    // Event listener pour détecter les changements de pays
    const handleCountryChange = () => {
      fetchNews();
    };
    
    window.addEventListener('countryChanged', handleCountryChange);
    
    // Recharger toutes les 5 minutes pour avoir les nouvelles données
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    
    return () => {
      window.removeEventListener('countryChanged', handleCountryChange);
      clearInterval(interval);
    };
  }, []); // Plus de dépendance à currentLocale

  // Auto-scroll doux avec boucle infinie (duplication de la liste)
  useEffect(() => {
    if (!autoScroll || !scrollContainerRef.current || news.length === 0) {
      return;
    }

    const container = scrollContainerRef.current;
    
    const startAutoScroll = () => {
      autoScrollIntervalRef.current = setInterval(() => {
        if (!container) return;

        const halfHeight = container.scrollHeight / 2;

        // Descendre doucement (1 pixel toutes les 50ms)
        container.scrollBy({ top: 1, behavior: 'auto' });

        // Quand on a parcouru la première moitié (liste originale),
        // on revient instantanément au début pour éviter tout "saut" visuel.
        if (container.scrollTop >= halfHeight) {
          container.scrollTop = 0;
        }
      }, 50);
    };

    startAutoScroll();

    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
      }
    };
  }, [autoScroll, news]);

  // Détecter l'interaction utilisateur pour arrêter l'auto-scroll
  const handleUserInteraction = () => {
    setAutoScroll(false);
    
    // Réactiver l'auto-scroll après 10 secondes d'inactivité
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
    }
    
    setTimeout(() => {
      setAutoScroll(true);
    }, 10000);
  };

  if (loading && news.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="w-6 h-6 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-xs text-white/40">Loading news...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-red-400">{error}</p>
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-white/40">No news available</p>
      </div>
    );
  }

  const languageStats = news.reduce((acc, article) => {
    acc[article.language] = (acc[article.language] || 0) + 1;
    return acc;
  }, {});

  const totalCached = Object.values(languageStats).reduce((sum, count) => sum + count, 0);

  // Pour un défilement sans "saut", on duplique la liste
  // lorsque l'auto-scroll est actif.
  const loopedNews =
    autoScroll && news.length > 0 ? [...news, ...news] : news;

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-xcannes-black via-xcannes-black to-xcannes-dark">
      {/* Header simple (masqué sur smartphone) */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="hidden md:block text-base md:text-sm font-bold text-white">
            News aggregated from local media sources.
          </h3>
          {loading && (
            <div className="w-4 h-4 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin"></div>
          )}
        </div>
      </div>

      {/* Liste des articles avec auto-scroll */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scroll-smooth"
        onWheel={handleUserInteraction}
        onTouchStart={handleUserInteraction}
        onClick={handleUserInteraction}
        style={{ scrollBehavior: autoScroll ? 'auto' : 'smooth' }}
      >
        {loopedNews.map((article, index) => {
          const isFirstCycle = index < news.length;
          const imageLoading = isFirstCycle ? "eager" : "lazy";

          return (
          <a
            key={`${article.url}-${index}`}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 border-b border-white/5 hover:bg-white/5 transition-colors group"
          >
            <div className="flex gap-3">
              {/* Image */}
              {article.image && (
                <div className="flex-shrink-0 w-24 h-24 md:w-20 md:h-20 rounded overflow-hidden bg-white/5">
                  <Image
                    src={article.image}
                    alt={article.title}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                    loading={imageLoading}
                    decoding="async"
                    unoptimized
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Contenu */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm md:text-xs font-semibold text-white line-clamp-2 mb-1 group-hover:text-xcannes-green transition-colors">
                  {article.title}
                </h4>
                
                <div className="flex items-center gap-2 text-sm md:text-xs text-white/40">
                  <span className="truncate">{article.source}</span>
                  {article.language && (
                    <>
                      <span>•</span>
                      <span>{article.language}</span>
                    </>
                  )}
                </div>

                <p className="text-sm md:text-xs text-white/30 mt-1">
                  {article.publishedAt && new Date(article.publishedAt).toLocaleDateString(currentLocale, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          </a>
          );
        })}
      </div>

      {/* Footer (mobile uniquement) */}
      <div className="p-2 border-t border-white/10 text-center md:hidden">
        <p className="text-sm md:text-xs text-white/30">
          News aggregated from local media sources.
        </p>
      </div>
    </div>
  );
}
