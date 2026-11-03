import clsx from "clsx";

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
      <div className="max-w-7xl mx-auto flex items-center justify-center">
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-wide select-none">
          Made by{" "}
          <span className="text-slate-600 dark:text-slate-300 font-semibold">
            Aditya Misra
          </span>
        </p>
      </div>
    </footer>
  );
}
