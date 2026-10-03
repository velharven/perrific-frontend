import { useDisplayScale } from '@/hooks/useDisplayScale';
import { CUSTOM_SCALE_PRESETS } from '@/lib/displayScale';
import { SettingsBlock } from '@/components/ui/SettingsShell';
import { Monitor, Check, Sparkles, Sliders, Smartphone } from 'lucide-react';

export default function DisplayScaleSettings() {
  const {
    mode,
    customScale,
    activeScale,
    screenWidth,
    screenHeight,
    isDesktop,
    setMode,
    setCustomScale,
  } = useDisplayScale();

  const activePercent = Math.round(activeScale * 100);

  return (
    <SettingsBlock
      title="Tampilan & Skala Layar"
      desc="Sesuaikan skala ukuran card, popup modal, dan antarmuka desktop agar konsisten di berbagai layar laptop"
    >
      <div className="space-y-4 pt-1">
        {/* Banner Status Resolusi & Skala Aktif */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-perrific-line bg-perrific-paper/80 p-3.5 sm:p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-perrific-violet">
              {isDesktop ? <Monitor size={20} strokeWidth={1.8} /> : <Smartphone size={20} strokeWidth={1.8} />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-manrope text-xs font-semibold text-perrific-graphite">
                  Resolusi Layar Saat Ini:
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs font-bold text-perrific-graphite shadow-2xs border border-gray-200">
                  {screenWidth} × {screenHeight}
                </span>
              </div>
              <p className="mt-0.5 font-manrope text-xs text-perrific-graphite/60">
                {isDesktop
                  ? screenWidth === 1600
                    ? 'Sama dengan resolusi acuan (1600x900).'
                    : 'Skala disesuaikan otomatis terhadap acuan 1600x900.'
                  : 'Mode mobile/tablet aktif — skala dinonaktifkan otomatis agar nyaman disentuh.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 border border-perrific-line shadow-2xs">
            <span className="font-manrope text-xs text-perrific-graphite/60">Skala aktif:</span>
            <span className="font-mono text-sm font-extrabold text-perrific-violet">
              {activePercent}%
            </span>
            {mode === 'auto' && (
              <span className="rounded-full bg-orange-100 px-2 py-0.2 font-manrope text-[10px] font-bold text-perrific-violet">
                Auto
              </span>
            )}
          </div>
        </div>

        {/* 3 Pilihan Mode Skala */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Pilihan mode skala tampilan">
          {/* Opsi 1: Otomatis (Adaptif 1600x900) */}
          <button
            type="button"
            role="radio"
            aria-label="Mode Otomatis (Adaptif 1600x900)"
            aria-checked={mode === 'auto'}
            onClick={() => setMode('auto')}
            className={`relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
              mode === 'auto'
                ? 'border-perrific-violet bg-orange-50/50 shadow-sm ring-1 ring-perrific-violet/30'
                : 'border-perrific-line bg-white hover:border-gray-300 hover:bg-gray-50/60'
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex items-center gap-1.5 font-manrope text-xs font-bold text-perrific-violet">
                <Sparkles size={14} /> Rekomendasi
              </span>
              {mode === 'auto' && <Check size={16} className="text-perrific-violet" />}
            </div>
            <p className="mt-1.5 font-manrope text-sm font-extrabold text-perrific-graphite">
              Otomatis (Adaptif 1600x900)
            </p>
            <p className="mt-1 font-manrope text-xs leading-relaxed text-perrific-graphite/65">
              Ukuran card, popup modal, dan font otomatis proporsional seperti di layar 1600x900.
            </p>
          </button>

          {/* Opsi 2: Standar 100% */}
          <button
            type="button"
            role="radio"
            aria-label="Mode Standar 100%"
            aria-checked={mode === 'standard'}
            onClick={() => setMode('standard')}
            className={`relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
              mode === 'standard'
                ? 'border-perrific-violet bg-orange-50/50 shadow-sm ring-1 ring-perrific-violet/30'
                : 'border-perrific-line bg-white hover:border-gray-300 hover:bg-gray-50/60'
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="font-mono text-xs font-semibold text-gray-500">1:1 Browser</span>
              {mode === 'standard' && <Check size={16} className="text-perrific-violet" />}
            </div>
            <p className="mt-1.5 font-manrope text-sm font-extrabold text-perrific-graphite">
              Standar 100%
            </p>
            <p className="mt-1 font-manrope text-xs leading-relaxed text-perrific-graphite/65">
              Menggunakan skala bawaan peramban asli tanpa perbesaran otomatis.
            </p>
          </button>

          {/* Opsi 3: Kustom */}
          <button
            type="button"
            role="radio"
            aria-label="Mode Kustom"
            aria-checked={mode === 'custom'}
            onClick={() => setMode('custom')}
            className={`relative flex flex-col items-start rounded-xl border p-3.5 text-left transition-all ${
              mode === 'custom'
                ? 'border-perrific-violet bg-orange-50/50 shadow-sm ring-1 ring-perrific-violet/30'
                : 'border-perrific-line bg-white hover:border-gray-300 hover:bg-gray-50/60'
            }`}
          >
            <div className="flex w-full items-center justify-between">
              <span className="flex items-center gap-1.5 font-manrope text-xs font-semibold text-gray-500">
                <Sliders size={13} /> Manual
              </span>
              {mode === 'custom' && <Check size={16} className="text-perrific-violet" />}
            </div>
            <p className="mt-1.5 font-manrope text-sm font-extrabold text-perrific-graphite">
              Kustom
            </p>
            <p className="mt-1 font-manrope text-xs leading-relaxed text-perrific-graphite/65">
              Pilih persentase skala manual sesuai kenyamanan Anda pribadi.
            </p>
          </button>
        </div>

        {/* Pilihan Tombol Preset (Aktif saat Kustom, atau langsung klik untuk mengaktifkan kustom) */}
        <div className="rounded-xl border border-perrific-line bg-white p-3.5 sm:p-4">
          <div className="flex items-center justify-between">
            <span className="font-manrope text-xs font-semibold text-perrific-graphite">
              Preset Persentase Manual:
            </span>
            {mode !== 'custom' && (
              <span className="font-manrope text-[11px] text-perrific-graphite/50">
                (Klik salah satu untuk mengaktifkan mode Kustom)
              </span>
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2">
            {CUSTOM_SCALE_PRESETS.map((preset) => {
              const percent = Math.round(preset * 100);
              const isSelected = mode === 'custom' && Math.abs(customScale - preset) < 0.01;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    if (mode !== 'custom') setMode('custom');
                    setCustomScale(preset);
                  }}
                  className={`rounded-lg px-3.5 py-1.5 font-mono text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-perrific-violet text-white shadow-sm ring-2 ring-perrific-violet/30 scale-105'
                      : 'border border-perrific-line bg-gray-50 text-perrific-graphite hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  {percent}% {preset === 0.8 ? '(Kompak)' : preset === 1.2 ? '(Besar)' : ''}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </SettingsBlock>
  );
}
