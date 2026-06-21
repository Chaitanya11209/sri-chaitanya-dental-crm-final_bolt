import { useState } from 'react';
import { X, ZoomIn } from 'lucide-react';
import { useDarkMode } from '../App';

const galleryImages = [
  {
    src: 'https://plus.unsplash.com/premium_photo-1661901543371-0d1279a79645?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8RGVudGFsJTIwTW9kZXJuJTIwcmVjZXB0aW9uJTIwYXJlYXxlbnwwfHwwfHx8MA%3D%3D',
    alt: 'Modern reception area',
  },
  {
    src: 'https://plus.unsplash.com/premium_photo-1675686363507-22a8d0e11b4c?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8RGVudGFsJTIwVHJlYXRtZW50JTIwcm9vbXxlbnwwfHwwfHx8MA%3D%3D',
    alt: 'Treatment room',
  },
  {
    src: 'https://images.unsplash.com/photo-1643660526741-094639fbe53a?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fERlbnRhbCUyMGVxdWlwbWVudHxlbnwwfHwwfHx8MA%3D%3D',
    alt: 'Dental equipment',
  },
  {
    src: 'https://plus.unsplash.com/premium_photo-1675686363504-ba2df7786f16?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8RGVudGFsJTIwV2FpdGluZyUyMGFyZWF8ZW58MHx8MHx8fDA%3D',
    alt: 'Waiting area',
  },
  {
    src: 'https://plus.unsplash.com/premium_photo-1661769167673-cfdb37f156d8?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8Q29uc3VsdGF0aW9uJTIwcm9vbXxlbnwwfHwwfHx8MA%3D%3D',
    alt: 'Consultation room',
  },
  {
    src: 'https://images.unsplash.com/photo-1758691462878-6edc3d3da1be?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Nnx8Q29uc3VsdGF0aW9uJTIwcm9vbXxlbnwwfHwwfHx8MA%3D%3D',
    alt: 'Sterilization area',
  },
];

export default function Gallery() {
  const { darkMode } = useDarkMode();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState(0);

  const openLightbox = (index: number) => {
    setCurrentImage(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => setLightboxOpen(false);

  return (
    <section className={`py-12 sm:py-16 lg:py-28 ${darkMode ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-teal-100 dark:bg-teal-900/50 rounded-full mb-4 sm:mb-6">
            <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600" />
            <span className="text-xs sm:text-sm font-medium text-teal-700 dark:text-teal-300">Our Clinic</span>
          </div>

          <h2 className={`text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold mb-4 sm:mb-6 ${darkMode ? 'text-white' : 'text-slate-800'}`}>
            State-of-the-Art Facilities
            <span className="block mt-1 sm:mt-2 text-teal-600">Modern & Comfortable</span>
          </h2>

          <p className={`text-base sm:text-lg max-w-2xl mx-auto px-4 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
            Experience dental care in a relaxing, modern environment designed for your comfort.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {galleryImages.map((image, index) => (
            <div
              key={index}
              onClick={() => openLightbox(index)}
              className="group relative overflow-hidden rounded-xl sm:rounded-2xl cursor-pointer aspect-[4/3]"
            >
              <img
                src={image.src}
                alt={image.alt}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <p className="text-white font-medium text-xs sm:text-sm">{image.alt}</p>
              </div>
              <div className="absolute top-2 sm:top-4 right-2 sm:right-4 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 sm:top-6 right-4 sm:right-6 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors z-10"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>

          <img
            src={galleryImages[currentImage].src}
            alt={galleryImages[currentImage].alt}
            className="max-w-full max-h-[85vh] sm:max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </section>
  );
}
