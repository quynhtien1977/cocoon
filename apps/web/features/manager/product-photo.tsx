"use client";
import { useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductPhoto({ src, name, className = "" }: { src: string | null; name: string; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  return <span className={cn("@container relative grid shrink-0 place-items-center overflow-hidden rounded-lg bg-muted", className)}>
    {src && failed !== src ? <Image src={src} alt={name} fill unoptimized sizes="(max-width: 767px) 90vw, 360px" className="object-contain" onError={() => setFailed(src)} /> : <span className="flex flex-col items-center gap-2 p-2 text-center text-[10px] text-muted-foreground"><ImageOff size={20} strokeWidth={1.3} aria-hidden="true" /><span className="sr-only @[5rem]:not-sr-only">Chưa có ảnh</span></span>}
  </span>;
}
