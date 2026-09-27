import React, { useState, useEffect, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface TimePickerInputProps {
  value?: string | null; // format 24 jam "HH:mm", misal "09:00" atau "16:40"
  onChange: (value24: string) => void;
  onCommit?: () => void;
  referenceStartTime?: string | null; // jam mulai referensi untuk kalkulasi durasi
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export interface TimeOption {
  time24: string; // "16:40"
  time12: string; // "4:40 PM"
  durationLabel?: string; // misal "(1 jam 30 mnt)"
  isPrimary?: boolean;
}

/**
 * Konversi "HH:mm" (24 jam) ke "h:mm A" (12 jam)
 * Contoh: "16:40" -> "4:40 PM", "04:40" -> "4:40 AM", "00:00" -> "12:00 AM"
 */
export function time24To12(time24?: string | null): string {
  if (!time24) return '';
  const parts = time24.trim().split(':');
  if (parts.length < 2) return time24;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Mengurai string waktu ke jumlah menit dari 00:00
 */
function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
  }
  return null;
}

/**
 * Hitung label durasi antara jam mulai dan jam selesai
 */
function formatDurationLabel(startStr?: string | null, endStr?: string | null): string | undefined {
  if (!startStr || !endStr) return undefined;
  const startM = parseTimeToMinutes(startStr);
  const endM = parseTimeToMinutes(endStr);
  if (startM === null || endM === null) return undefined;
  let diff = endM - startM;
  if (diff < 0) diff += 1440; // melewati tengah malam
  if (diff === 0) return '0 mnt';
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours > 0 && mins > 0) return `${hours} jam ${mins} mnt`;
  if (hours > 0) return `${hours} jam`;
  return `${mins} mnt`;
}

/**
 * Generate semua slot waktu standar 15 menitan (24 jam)
 */
function getAllDaySlots(referenceStartTime?: string | null): TimeOption[] {
  const slots: TimeOption[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const h24 = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const h12 = time24To12(h24);
      const duration = referenceStartTime ? formatDurationLabel(referenceStartTime, h24) : undefined;
      slots.push({
        time24: h24,
        time12: h12,
        durationLabel: duration,
      });
    }
  }
  return slots;
}

/**
 * Logika parsing pencarian jam cerdas ala Notion Calendar:
 * - "4" -> 4:00 PM, 4:00 AM (serta 4:15, 4:30, 4:45)
 * - "440" -> 4:40 PM, 4:40 AM
 * - "1030" -> 10:30 AM, 10:30 PM
 * - "16" -> 4:00 PM
 * - "1640" -> 4:40 PM
 */
export function generateTimeSuggestions(
  query: string,
  referenceStartTime?: string | null,
): TimeOption[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return getAllDaySlots(referenceStartTime);
  }

  const isPm = q.includes('p');
  const isAm = q.includes('a');
  const digits = q.replace(/[^0-9]/g, '');

  const buildOption = (hour24: number, minute: number, isPrimary = false): TimeOption => {
    const time24 = `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const time12 = time24To12(time24);
    const duration = referenceStartTime ? formatDurationLabel(referenceStartTime, time24) : undefined;
    return {
      time24,
      time12,
      durationLabel: duration,
      isPrimary,
    };
  };

  const results: TimeOption[] = [];
  const seen = new Set<string>();

  const add = (h24: number, m: number, isPrimary = false) => {
    if (h24 < 0 || h24 > 23 || m < 0 || m > 59) return;
    const key = `${h24}:${m}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(buildOption(h24, m, isPrimary));
  };

  // 1 Digit (misal: "4")
  if (digits.length === 1) {
    const h = parseInt(digits, 10);
    const pmHour = h === 12 ? 12 : h + 12;
    const amHour = h === 12 ? 0 : h;

    // Utamakan PM dan AM tepat
    if (!isAm) add(pmHour, 0, true);
    if (!isPm) add(amHour, 0, true);

    // Tambahkan variasi menit standar (:15, :30, :45) untuk jam tersebut
    if (!isAm) {
      add(pmHour, 15);
      add(pmHour, 30);
      add(pmHour, 45);
    }
    if (!isPm) {
      add(amHour, 15);
      add(amHour, 30);
      add(amHour, 45);
    }
    return results;
  }

  // 2 Digit (misal: "11", "16", "04", "45")
  if (digits.length === 2) {
    const num = parseInt(digits, 10);
    if (num <= 12) {
      const pmHour = num === 12 ? 12 : num + 12;
      const amHour = num === 12 ? 0 : num;
      if (!isAm) add(pmHour, 0, true);
      if (!isPm) add(amHour, 0, true);
      if (!isAm) {
        add(pmHour, 15);
        add(pmHour, 30);
        add(pmHour, 45);
      }
      if (!isPm) {
        add(amHour, 15);
        add(amHour, 30);
        add(amHour, 45);
      }
      return results;
    } else if (num >= 13 && num <= 23) {
      // 24 jam (misal 16 -> 4:00 PM)
      add(num, 0, true);
      add(num, 15);
      add(num, 30);
      add(num, 45);
      return results;
    } else {
      // digit pertama jam, digit kedua menit (misal 45 -> 4:50 atau 4:05)
      const h = Math.floor(num / 10);
      const m = (num % 10) * 10;
      if (m < 60) {
        const pmHour = h === 12 ? 12 : h + 12;
        const amHour = h === 12 ? 0 : h;
        if (!isAm) add(pmHour, m, true);
        if (!isPm) add(amHour, m, true);
      }
      return results;
    }
  }

  // 3 Digit (misal: "440", "930", "105")
  if (digits.length === 3) {
    const h = parseInt(digits.slice(0, 1), 10);
    const m = parseInt(digits.slice(1), 10);
    if (m < 60) {
      const pmHour = h === 12 ? 12 : h + 12;
      const amHour = h === 12 ? 0 : h;
      if (!isAm) add(pmHour, m, true);
      if (!isPm) add(amHour, m, true);
    }
    return results;
  }

  // 4 Digit (misal: "0440", "1640", "1030")
  if (digits.length >= 4) {
    const h = parseInt(digits.slice(0, 2), 10);
    const m = parseInt(digits.slice(2, 4), 10);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) {
      if (h > 12) {
        // format 24 jam eksplisit
        add(h, m, true);
      } else if (h === 0) {
        add(0, m, true);
      } else {
        const pmHour = h === 12 ? 12 : h + 12;
        const amHour = h === 12 ? 0 : h;
        if (!isAm) add(pmHour, m, true);
        if (!isPm) add(amHour, m, true);
      }
    }
    return results;
  }

  return results;
}

export default function TimePickerInput({
  value,
  onChange,
  onCommit,
  referenceStartTime,
  placeholder = 'Pilih jam',
  disabled = false,
  className = '',
}: TimePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number }>({
    top: -9999,
    left: -9999,
    width: 180,
  });

  // Teks terformat yang ditampilkan saat input tidak sedang diketik bebas
  const displayFormatted = useMemo(() => {
    return time24To12(value) || '';
  }, [value]);

  // Sinkronkan nilai typedText dengan value
  useEffect(() => {
    if (!isOpen) {
      setTypedText(displayFormatted);
    }
  }, [displayFormatted, isOpen]);

  // Ambil opsi yang cocok berdasarkan typedText saat menu terbuka
  const suggestions = useMemo(() => {
    if (!isOpen) return [];
    return generateTimeSuggestions(typedText, referenceStartTime);
  }, [isOpen, typedText, referenceStartTime]);

  // Reset indeks sorotan saat daftar saran berubah
  useEffect(() => {
    setHighlightedIndex(0);
  }, [suggestions]);

  // Hitung posisi popover di bawah input secara akurat
  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const inputEl = inputRef.current;
      const menuEl = menuRef.current;
      if (!inputEl) return;

      const inputRect = inputEl.getBoundingClientRect();
      const menuRect = menuEl?.getBoundingClientRect() || { width: 190, height: 260 };
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const margin = 8;

      const width = Math.max(inputRect.width, 180);
      let left = inputRect.left;
      if (left + width > viewportW - margin) {
        left = viewportW - width - margin;
      }
      if (left < margin) left = margin;

      let top = inputRect.bottom + 4;
      // Jika melebihi batas bawah layar, munculkan di atas input
      if (top + menuRect.height > viewportH - margin) {
        top = Math.max(margin, inputRect.top - menuRect.height - 4);
      }

      setMenuPos({ top, left, width });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  // Scroll otomatis ke item yang cocok dengan value saat pertama buka
  useEffect(() => {
    if (isOpen && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen]);

  // Tutup menu saat klik di luar
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
      // Terapkan nilai kembali jika ditutup tanpa memilih
      setTypedText(displayFormatted);
      onCommit?.();
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen, displayFormatted, onCommit]);

  // Terapkan pilihan jam
  const handleSelectTime = useCallback(
    (opt: TimeOption) => {
      onChange(opt.time24);
      setTypedText(opt.time12);
      setIsOpen(false);
      onCommit?.();
    },
    [onChange, onCommit],
  );

  // Tangani interaksi keyboard (Panah Bawah, Panah Atas, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) => (prev + 1 < suggestions.length ? prev + 1 : prev));
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && suggestions.length > 0) {
        const chosen = suggestions[highlightedIndex] || suggestions[0];
        handleSelectTime(chosen);
      } else {
        // Coba uraikan teks yang diketik sekarang
        const parsed = generateTimeSuggestions(typedText, referenceStartTime);
        if (parsed.length > 0) {
          handleSelectTime(parsed[0]);
        } else {
          setIsOpen(false);
          setTypedText(displayFormatted);
        }
      }
      inputRef.current?.blur();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setTypedText(displayFormatted);
      inputRef.current?.blur();
      return;
    }

    if (e.key === 'Tab') {
      if (isOpen && suggestions.length > 0) {
        const chosen = suggestions[highlightedIndex] || suggestions[0];
        handleSelectTime(chosen);
      }
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block font-givonic">
      {/* Input Teks Jam Interaktif */}
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        value={typedText}
        placeholder={placeholder}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.select();
          }
        }}
        onFocus={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.select();
          }
        }}
        onChange={(e) => {
          setTypedText(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={`rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-medium text-gray-800 transition shadow-2xs hover:border-gray-300 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:opacity-60 cursor-pointer ${className}`}
      />

      {/* Menu Popover Dropdown Portal (Anti Terpotong Container) */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={{
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
              minWidth: `${menuPos.width}px`,
            }}
            className="fixed z-9999 max-h-64 overflow-y-auto nice-scroll rounded-xl border border-gray-200 bg-white py-1 shadow-xl font-givonic animate-in fade-in zoom-in-95 duration-100"
          >
            {suggestions.length === 0 ? (
              <div className="px-3 py-2 text-center text-xs text-gray-400">
                Waktu tidak valid
              </div>
            ) : (
              suggestions.map((opt, idx) => {
                const isSelected = value === opt.time24;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={`${opt.time24}-${idx}`}
                    ref={isSelected ? selectedItemRef : undefined}
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelectTime(opt)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs transition cursor-pointer select-none ${
                      isHighlighted
                        ? 'bg-blue-50 text-blue-700'
                        : isSelected
                          ? 'bg-gray-50 font-semibold text-gray-900'
                          : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {/* Waktu 12 Jam (AM / PM) */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          isSelected ? 'bg-blue-600' : 'bg-transparent'
                        }`}
                      />
                      <span className="font-medium text-[11.5px]">
                        {opt.time12}
                      </span>
                    </div>

                    {/* Format 24 Jam atau Durasi Relatif */}
                    <span className="shrink-0 text-[10px] font-mono text-gray-400">
                      {opt.durationLabel ? opt.durationLabel : opt.time24}
                    </span>
                  </button>
                );
              })
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
