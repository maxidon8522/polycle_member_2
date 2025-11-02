import { ReactNode } from "react";

interface CardProps {
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

export const Card = ({ title, description, children, footer }: CardProps) => {
  return (
    <div className="flex flex-col rounded-2xl border border-[#ead8c4] bg-[#fffaf5] shadow-[0_18px_35px_-25px_rgba(173,122,70,0.55)] backdrop-blur-sm">
      {(title || description) && (
        <div className="border-b border-[#ecd7c2] bg-[#fef9f4] px-6 py-5">
          {title && (
            <h3 className="text-base font-semibold text-[#3d3128]">{title}</h3>
          )}
          {description && (
            <p className="mt-1 text-sm text-[#7f6b5a]">{description}</p>
          )}
        </div>
      )}
      {children && (
        <div className="flex-1 px-6 py-5 text-sm text-[#5b4c40]">{children}</div>
      )}
      {footer && (
        <div className="border-t border-[#ecd7c2] bg-[#fff7ed] px-6 py-4 text-xs text-[#7f6b5a]">
          {footer}
        </div>
      )}
    </div>
  );
};
