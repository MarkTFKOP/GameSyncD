import { cn } from '../../lib/utils';

export function Table({ className, ...props }) {
  return (
    <div className="relative w-full overflow-auto border border-border/70 bg-card">
      <table className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }) {
  return <thead className={cn('[&_tr]:border-b', className)} {...props} />;
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />;
}

export function TableRow({ className, ...props }) {
  return <tr className={cn('border-b transition-colors hover:bg-muted/50', className)} {...props} />;
}

export function TableHead({ className, ...props }) {
  return <th className={cn('font-display h-10 px-3 text-left align-middle text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground', className)} {...props} />;
}

export function TableCell({ className, ...props }) {
  return <td className={cn('p-3 align-middle', className)} {...props} />;
}
