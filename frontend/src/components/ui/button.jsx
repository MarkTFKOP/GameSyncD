import { cva } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center rounded-md border text-sm font-medium uppercase tracking-[0.08em] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_20px_rgba(0,0,0,0.16)] transition-[transform,box-shadow,background-color,border-color,filter] duration-150 focus-visible:outline-none focus-visible:ring-[4px] focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'border-primary/70 bg-[linear-gradient(135deg,hsl(var(--primary)),hsl(var(--accent)))] pl-5 text-primary-foreground before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] before:rounded-l-md before:bg-white/70 hover:-translate-y-px hover:brightness-[1.03] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_12px_24px_rgba(0,0,0,0.22)]',
        secondary:
          'border-border/70 bg-secondary/90 text-primary hover:-translate-y-px hover:border-primary/30 hover:bg-secondary hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_24px_rgba(0,0,0,0.18)]',
        outline:
          'border-border/70 bg-background/80 text-foreground hover:-translate-y-px hover:border-primary/25 hover:bg-muted hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_22px_rgba(0,0,0,0.16)]',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export function Button({ className, variant, size, ...props }) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
