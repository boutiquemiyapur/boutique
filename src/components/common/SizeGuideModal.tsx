import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { SIZE_CHART_DATA } from '../../data/initialData';
import { X, Ruler, CheckCircle2, Scissors } from 'lucide-react';
import { motion } from 'motion/react';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

export const SizeGuideModal: React.FC = () => {
  const { isSizeGuideOpen, setIsSizeGuideOpen, navigate } = useStore();
  const [unit, setUnit] = useState<'inches' | 'cm'>('inches');

  useBodyScrollLock(isSizeGuideOpen);

  if (!isSizeGuideOpen) return null;

  const toUnit = (valInchesStr: string) => {
    const inches = parseFloat(valInchesStr);
    if (unit === 'inches') return `${inches}"`;
    return `${Math.round(inches * 2.54)} cm`;
  };

  return (
    <div
      id="size-guide-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={() => setIsSizeGuideOpen(false)}
    >
      <motion.div
        id="size-guide-modal-card"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FAF7F2] border border-[#C5A059]/40 rounded-xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto overscroll-contain shadow-2xl relative"
      >
        <button
          id="close-size-guide-modal"
          onClick={() => setIsSizeGuideOpen(false)}
          className="absolute top-5 right-5 text-gray-500 hover:text-black p-1 rounded-full hover:bg-black/5"
          aria-label="Close Size Guide"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 text-[#8B1E3F] mb-1">
          <Ruler className="w-5 h-5 text-[#C5A059]" />
          <span className="text-xs uppercase tracking-widest font-semibold">Haute Couture Fit</span>
        </div>
        <h2 className="text-2xl font-serif font-bold text-[#1A1715]">Standard Size & Measurement Chart</h2>
        <p className="text-sm text-stone-600 mt-1">
          Product-specific fit and alteration information will be confirmed by AB Collection before purchase.
        </p>

        {/* Unit switch */}
        <div className="flex items-center justify-between mt-6 mb-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">Unit of Measurement:</span>
          <div className="inline-flex rounded-lg border border-[#E6D5B8] p-0.5 bg-[#EFE7DA]/50">
            <button
              id="switch-unit-inches"
              onClick={() => setUnit('inches')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                unit === 'inches' ? 'bg-[#8B1E3F] text-white shadow-xs' : 'text-stone-700 hover:text-black'
              }`}
            >
              Inches (in)
            </button>
            <button
              id="switch-unit-cm"
              onClick={() => setUnit('cm')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                unit === 'cm' ? 'bg-[#8B1E3F] text-white shadow-xs' : 'text-stone-700 hover:text-black'
              }`}
            >
              Centimeters (cm)
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-[#E6D5B8] rounded-lg bg-white shadow-xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-[#FAF7F2] text-[#8B1E3F] uppercase tracking-wider font-semibold border-b border-[#E6D5B8]">
              <tr>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Bust</th>
                <th className="py-3 px-4">Waist</th>
                <th className="py-3 px-4">Hips</th>
                <th className="py-3 px-4">Shoulder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6D5B8]/60 text-stone-700">
              {SIZE_CHART_DATA.map((row) => (
                <tr key={row.size} className="hover:bg-[#FAF7F2]/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-[#8B1E3F]">{row.size}</td>
                  <td className="py-3 px-4">{toUnit(row.bustInches)}</td>
                  <td className="py-3 px-4">{toUnit(row.waistInches)}</td>
                  <td className="py-3 px-4">{toUnit(row.hipsInches)}</td>
                  <td className="py-3 px-4">{toUnit(row.shoulderInches)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Custom tailoring highlight */}
        <div className="mt-6 bg-[#8B1E3F]/5 border border-[#8B1E3F]/20 rounded-lg p-4 flex items-start gap-3">
          <Scissors className="w-5 h-5 text-[#8B1E3F] mt-0.5 shrink-0" />
          <div className="text-xs text-stone-700">
            <h4 className="font-bold text-[#8B1E3F]">Prefer a 100% Made-to-Measure Custom Fit?</h4>
            <p className="mt-0.5">
              Select <strong>Custom Made-to-Measure</strong> on any product page to enter your exact neck, armhole, sleeve, and blouse measurements.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            id="view-custom-tailoring-guide"
            onClick={() => {
              setIsSizeGuideOpen(false);
              navigate('tailoring-guide');
            }}
            className="text-xs uppercase tracking-wider font-semibold text-[#8B1E3F] hover:underline py-2 px-3"
          >
            How to Measure Guide →
          </button>
          <button
            id="close-size-guide-btn"
            onClick={() => setIsSizeGuideOpen(false)}
            className="bg-[#1A1715] text-[#FAF7F2] hover:bg-[#8B1E3F] transition-colors text-xs font-semibold tracking-wider uppercase px-5 py-2.5 rounded-md"
          >
            Got It
          </button>
        </div>
      </motion.div>
    </div>
  );
};
