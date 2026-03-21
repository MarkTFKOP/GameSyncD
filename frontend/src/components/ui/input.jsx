import { cn } from '../../lib/utils';

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-md border border-input/80 bg-secondary/90 px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_6px_16px_rgba(0,0,0,0.12)] ring-offset-background placeholder:text-muted-foreground transition-[border-color,box-shadow,background-color] duration-150 focus-visible:border-primary/70 focus-visible:bg-secondary focus-visible:outline-none focus-visible:ring-[4px] focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
