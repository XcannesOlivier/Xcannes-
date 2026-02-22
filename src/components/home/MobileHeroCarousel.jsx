import { useCallback, useEffect, useState, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { useTranslation } from 'next-i18next';

export default function MobileHeroCarousel({ show, onSpeedClick, onSecurityClick, onFeesClick, onValueClick }) {
  const { t } = useTranslation('common');
  const autoplayRef = useRef(
    Autoplay({ delay: 5000, stopOnInteraction: false })
  );
  
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: true,
      align: 'center',
      skipSnaps: false,
      dragFree: false,
    },
    [autoplayRef.current]
  );
  
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollTo = useCallback(
    (index) => emblaApi && emblaApi.scrollTo(index),
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    
    return () => {
      if (emblaApi) emblaApi.destroy();
    };
  }, [emblaApi, onSelect]);

  const heroCards = [
    {
      title: t('home_v2_hero_pillar_1_title', 'Exécution instantanée'),
      stat: t('home_v2_hero_pillar_1_stat', '≤ 3 s'),
      subtitle: t('home_v2_hero_pillar_1_caption', 'Paiement et conversion en temps réel.'),
      onClick: onSpeedClick,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/65">
          <path d="M10 13l2 2 7-7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 22A10 10 0 1 0 2 12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: t('home_v2_hero_pillar_2_title', 'Contrôle des transactions'),
      desc: t('home_v2_hero_pillar_2_desc', 'Validation sécurisée sous votre autorité.'),
      onClick: onSecurityClick,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/65">
          <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 0 0 8 11a4 4 0 1 1 8 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0 0 15.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 0 0 8 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: t('home_v2_hero_pillar_3_title', 'Transparence des frais'),
      desc: t('home_v2_hero_pillar_3_desc', 'Frais affichés avant chaque confirmation.'),
      onClick: onFeesClick,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/65">
          <path d="M7 7h11l-2-2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M17 17H6l2 2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: t('home_v2_hero_pillar_4_title', 'Stabilité réglementée'),
      desc: t('home_v2_hero_pillar_4_desc', 'Indexation USD conforme aux standards financiers.\nConversion multi-devises instantanée.'),
      onClick: onValueClick,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/65">
          <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      title: t('home_v2_hero_pillar_5_title', 'Pour qui ?'),
      desc: t('home_v2_hero_pillar_5_desc', 'Particuliers et entreprises recherchant stabilité et contrôle.'),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/65">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className={`mt-12 md:hidden transition-all duration-700 delay-300 ${
      show ? 'opacity-100 translate-x-0 translate-y-0' : 'opacity-0 -translate-x-16 translate-y-8'
    }`}>
      <div className="relative">
        {/* Embla Carousel */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex touch-pan-y">
            {heroCards.map((card, index) => (
              <div
                key={index}
                className="flex-[0_0_80%] min-w-0 px-3"
              >
                <div 
                  className={`bg-white/90 rounded-lg px-5 py-6 min-h-[180px] flex items-start gap-3 transition-transform duration-300 ${
                    card.onClick ? 'cursor-pointer active:scale-95' : ''
                  }`}
                  onClick={card.onClick ? card.onClick : undefined}
                >
                  <div className="flex items-center justify-center w-10 h-10 shrink-0 mt-0.5">
                    {card.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-[19px] font-semibold text-black/90 mb-1">
                      {card.title}
                    </div>
                    {card.subtitle && (
                      <div className="text-[15px] text-black/70 italic leading-relaxed">
                        {card.subtitle}
                      </div>
                    )}
                    {card.stat && (
                      <div className="mt-3 text-center">
                        <div className="text-3xl font-semibold text-black/90 leading-tight">
                          {card.stat}
                        </div>
                      </div>
                    )}
                    {card.desc && (
                      <div className="text-[15px] text-black/70 leading-relaxed italic mt-1">
                        {card.title === t('home_v2_hero_pillar_4_title', 'Stabilité réglementée')
                          ? card.desc.split('\n')[0]
                          : card.desc}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Indicateurs de pagination */}
        <div className="mt-4 flex justify-center gap-2">
          {heroCards.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                index === selectedIndex
                  ? 'bg-white/50 scale-125'
                  : 'bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Aller à la carte ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
