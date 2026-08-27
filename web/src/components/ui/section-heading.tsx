import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-signal-400">{eyebrow}</p>
      ) : null}
      <h2 className="font-display text-3xl leading-[1.1] text-paper sm:text-4xl">{title}</h2>
      {description ? <p className="mt-4 text-base leading-relaxed text-ink-200">{description}</p> : null}
    </div>
  );
}
