import React from "react";
import { classNames } from "../utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={classNames(
        "bg-white rounded-xl border border-gray-200 shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={classNames("px-6 py-5 border-b border-gray-100", className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={classNames("text-lg font-semibold text-gray-900", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames("p-6", className)} {...props} />;
}

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost";
}) {
  const baseClasses =
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none text-sm px-4 py-2";

  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    secondary: "bg-brand-50 text-brand-700 hover:bg-brand-100",
    outline: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
    ghost: "hover:bg-gray-100 text-gray-700 hover:text-gray-900",
  };

  return (
    <button
      className={classNames(baseClasses, variants[variant], className)}
      {...props}
    />
  );
}
