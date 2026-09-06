import React from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { useToast, ToastType } from "./ToastContext";

const Toast: React.FC = () => {
  const { toasts, removeToast } = useToast();

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-clean-600" />;
      case "error":
        return <XCircle className="w-5 h-5 text-owed-500" />;
      case "info":
      default:
        return <Info className="w-5 h-5 text-ink-muted" />;
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case "success":
        return "bg-clean-50 border-clean-100 text-clean-700";
      case "error":
        return "bg-owed-50 border-owed-100 text-owed-700";
      case "info":
      default:
        return "bg-paper-sunk border-line text-ink";
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg animate-slide-down ${getStyles(toast.type)}`}
        >
          {getIcon(toast.type)}
          <span className="flex-1 text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 hover:bg-black/5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;
