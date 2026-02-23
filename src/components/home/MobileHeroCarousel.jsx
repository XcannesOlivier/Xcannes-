import { useCallback, useEffect, useState, useRef } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import Image from 'next/image';
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
      duration: 40,
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
      image: '/images/Exécution instantanée et finance numérique.png',
      onClick: onSpeedClick,
    },
    {
      title: t('home_v2_hero_pillar_2_title', 'Contrôle des transactions'),
      image: '/images/Contrôle sécurisé des transactions numériques.png',
      onClick: onSecurityClick,
    },
    {
      title: t('home_v2_hero_pillar_3_title', 'Transparence des frais'),
      image: '/images/Transparence des frais en Suisse et Colombie.png',
      onClick: onFeesClick,
    },
    {
      title: t('home_v2_hero_pillar_4_title', 'Stabilité réglementée'),
      image: '/images/Stabilité réglementée.png',
      onClick: onValueClick,
    },
    {
      title: t('home_v2_hero_pillar_5_title', 'Pour qui ?'),
      image: '/images/Pour qui.png',
    },
  ];

  return (
    <div className={`mt-12 md:hidden transition-opacity duration-700 delay-300 ${
      show ? 'opacity-100' : 'opacity-0'
    }`}>
      <div className="relative">
        {/* Embla Carousel */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex touch-pan-y">
            {heroCards.map((card, index) => (
              <div
                key={index}
                className="flex-[0_0_85%] min-w-0 px-2"
              >
                <div 
                  className={`rounded-xl overflow-hidden transition-transform duration-300 ${
                    card.onClick ? 'cursor-pointer active:scale-[0.97]' : ''
                  }`}
                  onClick={card.onClick ? card.onClick : undefined}
                >
                  <Image
                    src={card.image}
                    alt={card.title}
                    width={600}
                    height={800}
                    className="w-full h-auto object-cover rounded-xl"
                    loading="lazy"
                    unoptimized
                  />
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
