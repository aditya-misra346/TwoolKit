import clsx from "clsx";
import Link from "next/link";

interface FooterProps {
  className?: string;
}

export function Footer({ className }: FooterProps) {
  return (
    <footer
      className={clsx(
        "w-full border-t border-slate-200/60 dark:border-slate-800/60 mt-auto py-5 px-4 text-center pb-20 md:pb-6",
        className
      )}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-wide select-none">
          Made by{" "}
          <span className="text-slate-600 dark:text-slate-300 font-semibold">
            Aditya Misra
          </span>
        </p>
        <span className="hidden sm:inline text-slate-300 dark:text-slate-700">·</span>
        <Link
          href="/brand"
          className="text-xs text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition-colors"
        >
          Brand & Logo Identity
        </Link>
      </div>
    </footer>
  );
}
