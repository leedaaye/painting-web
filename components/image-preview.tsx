'use client';

import * as React from 'react';

export function ImagePreview({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [scale, setScale] = React.useState(1);
  const overlayRef = React.useRef<HTMLDivElement>(null);

  const close = React.useCallback(() => {
    setIsOpen(false);
    setScale(1);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) close();
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((prev) => Math.min(Math.max(0.5, prev + (e.deltaY > 0 ? -0.1 : 0.1)), 3));
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      overlayRef.current?.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      overlayRef.current?.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen, close]);

  return (
    <>
      <div className="relative rounded-xl border bg-card max-w-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setIsOpen(true)}>
        {children}
      </div>
      {isOpen && (
        <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer" onClick={close}>
          <div className="max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()} style={{ transform: `scale(${scale})`, transition: 'transform 0.1s ease-out' }}>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
