"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FAQ } from "@/lib/faq";
import { cn } from "@/lib/utils";

export function FaqList() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
      {FAQ.map((item, i) => (
        <div key={item.q}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            aria-controls={`faq-${i}`}
          >
            <span className="font-medium text-ink">{item.q}</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open === i && "rotate-180")} />
          </button>
          <div id={`faq-${i}`} hidden={open !== i} className="px-5 pb-5 text-[15px] leading-7 text-muted sm:px-6">
            {item.a}
          </div>
        </div>
      ))}
    </div>
  );
}
