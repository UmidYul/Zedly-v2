import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type CardVariant = "default" | "flat" | "elevated";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

function CardRoot({ className, variant = "default", ...props }: CardProps) {
  return <article className={cn("ui-card", `ui-card-${variant}`, className)} {...props} />;
}

function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <header className={cn("ui-card-header", className)} {...props} />;
}

function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-card-body", className)} {...props} />;
}

function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <footer className={cn("ui-card-footer", className)} {...props} />;
}

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter
});
