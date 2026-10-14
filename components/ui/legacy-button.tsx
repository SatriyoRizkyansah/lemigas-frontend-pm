import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "dark";
  size?: "sm" | "md";
};

export function Button({ children, variant = "primary", size = "md", className = "", ...props }: Props) {
  return (
    <button className={`btn btn-${variant === "primary" ? "blue" : "dark"} btn-${size} ${className}`} {...props}>
      {children}
    </button>
  );
}
