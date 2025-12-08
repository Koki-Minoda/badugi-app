import { useEffect, useState } from "react";

const MOBILE_MAX_WIDTH = 900;

function computeProfile() {
  if (typeof window === "undefined") {
    return {
      width: 1024,
      height: 768,
      isPortrait: false,
      isMobile: false,
      isTouch: false,
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const isPortrait = height >= width;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isTouch =
    typeof navigator !== "undefined" &&
    (navigator.maxTouchPoints > 1 || "ontouchstart" in window);
  const isMobileViewport = width <= MOBILE_MAX_WIDTH;
  const isMobileUA = /iphone|ipod|android|mobile/i.test(ua);
  const isMobile = isMobileViewport && (isTouch || isMobileUA);
  return {
    width,
    height,
    isPortrait,
    isMobile,
    isTouch,
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
