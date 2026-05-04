import { useEffect, useState } from "react";

function computeProfile() {
  if (typeof window === "undefined") {
    return {
      width: 1024,
      height: 768,
      isPortrait: false,
      isMobile: false,
      isTouch: false,
      isLandscape: true,
      isPhoneLike: false,
      shortSide: 768,
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isPortrait = height >= width;
  const isLandscape = width > height;
  const shortSide = Math.min(width, height);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const coarseNoHover =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse) and (hover: none)").matches;
  const isTouch =
    typeof navigator !== "undefined" &&
    (navigator.maxTouchPoints > 1 || "ontouchstart" in window || coarseNoHover);
  const isMobileUA = /iphone|ipod|android|mobile/i.test(ua);
  const isPhoneLike = (coarseNoHover || isTouch || isMobileUA) && shortSide <= 900;
  const isMobile = isPhoneLike;
  return {
    width,
    height,
    isPortrait,
    isLandscape,
    isMobile,
    isTouch,
    isPhoneLike,
    shortSide,
  };
}

export function useDeviceProfile() {
  const [profile, setProfile] = useState(() => computeProfile());

  useEffect(() => {
    const handle = () => setProfile(computeProfile());
    window.addEventListener("resize", handle);
    window.addEventListener("orientationchange", handle);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("orientationchange", handle);
    };
  }, []);

  return profile;
}

export default useDeviceProfile;
