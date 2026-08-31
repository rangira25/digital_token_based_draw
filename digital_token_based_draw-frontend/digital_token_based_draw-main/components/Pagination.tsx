'use client';

import { Button } from '@/components/ui/button';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

interface PaginationProps {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalItems, pageSize, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-xs text-muted-foreground font-mono">
        Showing {start}–{end} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="h-8 w-8 p-0 border-primary/20">
          <IconChevronLeft size={14} />
        </Button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="px-1 text-muted-foreground text-xs">...</span>
          ) : (
            <Button key={p} variant={p === page ? 'default' : 'outline'} size="sm"
              onClick={() => onPageChange(p)}
              className={`h-8 w-8 p-0 text-xs ${p === page ? 'bg-slate-800 text-white' : 'border-primary/20'}`}>
              {p}
            </Button>
          )
        )}
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="h-8 w-8 p-0 border-primary/20">
          <IconChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
