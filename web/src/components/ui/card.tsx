import { ReactNode } from "react";

interface CardProps {
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export const Card = ({ title, description, children, footer }: CardProps) => {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      {(title || description) && (
        <div className="border-b border-slate-200 px-4 py-3">
          {title && (
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          )}
          {description && (
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          )}
        </div>
      )}
      {children && <div className="flex-1 px-4 py-3 text-sm">{children}</div>}
      {footer && (
        <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
          {footer}
        </div>
      )}
    </div>
  );
};
