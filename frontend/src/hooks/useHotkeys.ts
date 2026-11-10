import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function useHotkeys() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger hotkeys if user is typing in an editable field
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        // If Escape pressed inside input, blur it
        if (event.key === "Escape") {
          target.blur();
        }
        return;
      }

      // Modifier keys: ignore if Ctrl, Alt, or Meta is held
      if (event.ctrlKey || event.altKey || event.metaKey) {
        return;
      }

      // 'n' -> Navigate to /scrape/new
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        navigate("/scrape/new");
        return;
      }

      // '/' -> Focus search input
      if (event.key === "/") {
        event.preventDefault();
        const searchInput =
          document.querySelector<HTMLInputElement>("[data-search-input]") ||
          document.querySelector<HTMLInputElement>("input[type='search']") ||
          document.querySelector<HTMLInputElement>("#table-search");
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);
}
