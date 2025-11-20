import { useEffect, useState } from "react";
import { loadRatingState } from "../utils/ratingState.js";

export function useRatingState() {
  const [rating, setRating] = useState(() => loadRatingState());

  useEffect(() => {
    function handleChange() {
      setRating(loadRatingState());
    }
    if (typeof window !== "undefined") {
      window.addEventListener("badugi:ratingState-changed", handleChange);
      window.addEventListener("storage", handleChange);
      return () => {
        window.removeEventListener("badugi:ratingState-changed", handleChange);
        window.removeEventListener("storage", handleChange);
      };
    }
    return undefined;
  }, []);

  return rating;
}
