/**
 * Penanda posisi drop: garis oranye lurus penanda celah tempat item
 * atau section akan mendarat. Tanpa lengkung, tanpa glow.
 */
export default function DropIndicator() {
  return (
    <div
      aria-hidden="true"
      className="h-[3px] w-full shrink-0 rounded-full bg-perrific-violet"
    />
  );
}
