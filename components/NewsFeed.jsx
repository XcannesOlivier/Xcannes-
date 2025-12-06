"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://149.28.238.173:3001";

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

        const url = `${API_BASE_URL}/news?locale=${currentLocale}&limit=20`;
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
        
        console.log(`[NewsFeed] Loaded ${data.count} ${data.language} articles`);
      } catch (err) {
        console.error('[NewsFeed] Error fetching news:', err);
        setError('Unable to load news');
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
    
    // Recharger toutes les 5 minutes pour avoir les nouvelles données
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currentLocale]);

  // Auto-scroll doux
  useEffect(() => {
    if (!autoScroll || !scrollContainerRef.current || news.length === 0) {
      return;
    }

    const container = scrollContainerRef.current;
    
    const startAutoScroll = () => {
      autoScrollIntervalRef.current = setInterval(() => {
        if (!container) return;
        
        const isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10;
        
        if (isAtBottom) {
          // Retour en haut en douceur
          container.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          // Descendre doucement (1 pixel toutes les 50ms = lent et fluide)
          container.scrollBy({ top: 1, behavior: 'auto' });
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

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-xcannes-black via-xcannes-black to-xcannes-dark">
      {/* Header avec stats */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-white">📰 Financial News</h3>
          <div className="flex items-center gap-2">
            {loading && (
              <div className="w-4 h-4 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin"></div>
            )}
            {/* Indicateur auto-scroll */}
            {autoScroll && news.length > 5 && (
              <div className="text-xs text-xcannes-green/60 flex items-center gap-1">
                <span>⬇️</span>
              </div>
            )}
          </div>
        </div>
        <p className="text-xs text-white/50">
          {stats.language} • {stats.count} articles • {totalCached} total cached
        </p>
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
        {news.map((article, index) => (
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
                <div className="flex-shrink-0 w-20 h-20 rounded overflow-hidden bg-white/5">
                  <img
                    src={article.image}
                    alt={article.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Contenu */}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-semibold text-white line-clamp-2 mb-1 group-hover:text-xcannes-green transition-colors">
                  {article.title}
                </h4>
                
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <span className="truncate">{article.source}</span>
                  {article.language && (
                    <>
                      <span>•</span>
                      <span>{article.language}</span>
                    </>
                  )}
                </div>

                {article.publishedAt && (
                  <p className="text-xs text-white/30 mt-1">
                    {new Date(article.publishedAt).toLocaleDateString(currentLocale, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-white/10 text-center">
        <p className="text-xs text-white/30">
          Powered by GDELT • Updated every 15min
        </p>
      </div>
    </div>
  );
}
