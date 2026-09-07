"use client";
import React from "react";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-[10px] transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 whitespace-nowrap select-none";
  const sizes = {
    sm: "h-9 px-3.5 text-[13px]",
    md: "h-10 px-5 text-[14px]",
    lg: "h-11 px-6 text-[15px]",
  };
  const variants = {
    primary:
      "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-sm active:scale-[0.98]",
    secondary:
      "bg-white border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)] shadow-sm active:scale-[0.98]",
    outline:
      "bg-transparent border border-[var(--border-strong)] text-[var(--foreground)] hover:bg-white",
    ghost:
      "bg-transparent text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)]",
    danger:
      "bg-[var(--danger)] text-white hover:bg-[#b91c1c] shadow-sm active:scale-[0.98]",
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  padding = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { padding?: boolean }) {
  return (
    <div
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-[14px] shadow-[var(--shadow-sm)] ${padding ? "p-5" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full h-10 px-3.5 rounded-[10px] bg-white border border-[var(--border)] text-[14px] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[#2563eb0f] transition ${props.className || ""}`}
    />
  );
}

export function Label(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      {...props}
      className={`text-[13px] font-medium text-[var(--foreground)] ${props.className || ""}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full min-h-[88px] px-3.5 py-2.5 rounded-[10px] bg-white border border-[var(--border)] text-[14px] placeholder:text-[var(--muted-2)] focus:outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[#2563eb0f] transition resize-none ${props.className || ""}`}
    />
  );
}

export function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "live";
  className?: string;
}) {
  const map: Record<string, string> = {
    default: "bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)]",
    success: "bg-[#ecfdf5] text-[#065f46] border border-[#a7f3d0]",
    warning: "bg-[#fffbeb] text-[#92400e] border border-[#fde68a]",
    danger: "bg-[#fef2f2] text-[#991b1b] border border-[#fecaca]",
    live: "bg-[#fef2f2] text-[#dc2626] border border-[#fecaca]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase border ${map[variant]} ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && <div className="mb-4 text-[var(--muted-2)]">{icon}</div>}
      <h3 className="text-[15px] font-semibold text-[var(--foreground)]">{title}</h3>
      {description && <p className="mt-1 text-[13px] leading-5 text-[var(--muted)] max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
