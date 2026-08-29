import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { CURRENCIES } from '../../data/initialData';
import { CurrencyCode } from '../../types';
import { ChevronDown, Globe } from 'lucide-react';

export const CurrencySelector: React.FC<{ isCompact?: boolean }> = ({ isCompact = false }) => {
  const { selectedCurrency, setSelectedCurrency } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        id="currency-selector-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 text-xs tracking-wider uppercase font-medium hover:text-[#C5A059] transition-colors py-1 px-2 rounded-md hover:bg-black/5"
      >
        {!isCompact && <Globe className="w-3.5 h-3.5 text-[#C5A059]" />}
        <span>{selectedCurrency}</span>
        <span className="text-[10px] text-gray-500">({CURRENCIES[selectedCurrency]?.symbol.trim()})</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          id="currency-dropdown-menu"
          className="absolute right-0 mt-1 w-52 bg-[#FAF7F2] border border-[#E6D5B8] rounded-md shadow-2xl z-50 py-1 divide-y divide-[#E6D5B8]/40"
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold text-[#8B1E3F] uppercase tracking-wider">
            Select Currency
          </div>
          {Object.values(CURRENCIES).map((curr) => (
            <button
              key={curr.code}
              id={`curr-select-${curr.code}`}
              onClick={() => {
                setSelectedCurrency(curr.code as CurrencyCode);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                selectedCurrency === curr.code
                  ? 'bg-[#8B1E3F]/10 text-[#8B1E3F] font-semibold'
                  : 'text-[#1A1715] hover:bg-[#EFE7DA]'
              }`}
            >
              <span>{curr.label}</span>
              <span className="font-mono text-[#8B1E3F]">{curr.symbol}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
