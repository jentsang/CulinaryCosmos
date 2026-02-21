"use client";

import { type ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: string;
  variant?: "primary" | "secondary";
};

export function Button({
  title,
  variant = "primary",
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "py-3 px-6 rounded-lg font-semibold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-primary text-white hover:opacity-90",
    secondary:
      "bg-transparent border border-primary text-primary hover:opacity-80",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {title}
    </button>
  );
}
