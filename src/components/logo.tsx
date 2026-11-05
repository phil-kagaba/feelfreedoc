import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden="true">
  <rect width="32" height="32" rx="9" fill="#A3E4B0" />
  <path
    d="M12 24V8h5.5a4.5 4.5 0 0 1 0 9H12"
    fill="none"
    stroke="#171717"
    strokeWidth="2.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
</svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 rounded-lg", className)} aria-label="feelfreedoc home">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight text-ink">
        feelfree<span className="text-brand-ink">doc</span>
      </span>
    </Link>
  );
}
