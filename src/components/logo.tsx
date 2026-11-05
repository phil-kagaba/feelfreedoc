import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-8 w-8", className)} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#A3E4B0" />
      <path d="M10 7.5h8.2L23 12.3V23a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 9 23V9a1.5 1.5 0 0 1 1-1.5Z" fill="#fff" />
      <path d="M18 7.5V11a1.3 1.3 0 0 0 1.3 1.3H23" fill="none" stroke="#171717" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M10 7.5h8.2L23 12.3V23a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 9 23V9a1.5 1.5 0 0 1 1-1.5Z" fill="none" stroke="#171717" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12.5 16.5l2.4 2.4 4.6-4.8" fill="none" stroke="#1f7a3d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
