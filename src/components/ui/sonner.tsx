import { Toaster as Sonner } from "sonner";
import { AlertCircle, CheckCircle2 } from "@/components/icons";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const tile = (tone: string, icon: React.ReactNode) => (
  <span className={`gw-toast-tile ${tone}`} aria-hidden="true">{icon}</span>
);

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{
        success: tile("is-success", <CheckCircle2 />),
        error: tile("is-error", <AlertCircle />),
        warning: tile("is-warning", <AlertCircle />),
        info: tile("is-info", <AlertCircle />),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-[var(--e2)] group-[.toaster]:rounded-[16px]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
