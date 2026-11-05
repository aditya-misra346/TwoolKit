import clsx from "clsx";
import Link from "next/link";

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  return (
    <footer
      className={clsx(
        "w-full border-t border-slate-800/80 mt-auto py-6 px-4 text-center pb-24 md:pb-6",
        className
      )}
    >
      <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-5">
        <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide select-none">
          Made by{" "}
          <span className="text-slate-200 font-semibold">
            Aditya Misra
          </span>
        </p>
        <span className="hidden sm:inline text-slate-700">·</span>
        <Link
          href="/brand"
          className="text-xs sm:text-sm text-slate-400 hover:text-blue-400 font-medium transition-colors"
        >
          Brand & Logo Identity
        </Link>
      </div>
    </footer>
  );
}
