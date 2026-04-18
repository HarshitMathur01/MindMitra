import { useEffect, useRef, useState } from 'react';

interface UseIntersectionObserverOptions {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}

export function useIntersectionObserver(
  options: UseIntersectionObserverOptions = {}
) {
  const [isVisible, setIsVisible] = useState(false);
  const [hasTriggered, setHasTriggered] = useState(false);
  const elementRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isIntersecting = entry.isIntersecting;
        
        if (options.triggerOnce) {
          if (isIntersecting && !hasTriggered) {
            setIsVisible(true);
            setHasTriggered(true);
          }
        } else {
          setIsVisible(isIntersecting);
        }
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '0px 0px -50px 0px',
      }
    );

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [options.threshold, options.rootMargin, options.triggerOnce, hasTriggered]);

  return [elementRef, isVisible] as const;
}

// Enhanced scroll animations hook
export function useScrollAnimations() {
  const [scrollY, setScrollY] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('down');
  
  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;
    
    const updateScrollDirection = () => {
      const currentScrollY = window.scrollY;
      
      setScrollDirection((prevDirection) => {
        const direction = currentScrollY > lastScrollY ? 'down' : 'up';
        if (direction !== prevDirection && Math.abs(currentScrollY - lastScrollY) > 10) {
          return direction;
        }
        return prevDirection;
      });
      
      setScrollY((prevScrollY) => {
          // To dramatically reduce re-renders, only update state if we crossed key thresholds
          // or changed significantly (50px)
          if (
              (prevScrollY <= 100 && currentScrollY > 100) ||
              (prevScrollY > 100 && currentScrollY <= 100) ||
              Math.abs(currentScrollY - prevScrollY) > 50
          ) {
              return currentScrollY;
          }
          return prevScrollY;
      });
      
      lastScrollY = currentScrollY > 0 ? currentScrollY : 0;
      ticking = false;
    };
    
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(updateScrollDirection);
        ticking = true;
      }
    };
    
    window.addEventListener('scroll', onScroll, { passive: true });
    // Initialize properly on mount
    updateScrollDirection();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return { scrollY, scrollDirection };
}
