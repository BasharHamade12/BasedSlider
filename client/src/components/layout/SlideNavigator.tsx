import { useStore } from '../../store/useStore';

export function SlideNavigator() {
  const slides = useStore(s => s.slides);
  const activeSlideIndex = useStore(s => s.activeSlideIndex);
  const setActiveSlide = useStore(s => s.setActiveSlide);
  const selectElement = useStore(s => s.selectElement);

  const handleClick = (i: number) => {
    setActiveSlide(i);
    selectElement(null);
  };

  if (slides.length === 0) return null;

  return (
    <div className="slide-navigator">
      {slides.map((slide, i) => (
        <button
          key={slide.id}
          className={`slide-tab ${i === activeSlideIndex ? 'active' : ''}`}
          onClick={() => handleClick(i)}
        >
          {slide.name || `Slide ${i + 1}`}
        </button>
      ))}
    </div>
  );
}
