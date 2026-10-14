import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "dark";
  size?: "sm" | "md";
};

const variantClasses = {
  primary: "btn-blue",
  dark: "btn-dark",
} as const;

export function Button({ variant = "dark", size = "sm", className = "", ...props }: ButtonProps) {
  return <button className={`btn ${variantClasses[variant]} btn-${size} ${className}`.trim()} {...props} />;
}
