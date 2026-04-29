import React from "react";
import DesktopGameLayout from "./layouts/DesktopGameLayout.jsx";
import MobileGameLayout from "./layouts/MobileGameLayout.jsx";

export default function GameScreen(props) {
  const { layoutMode = "desktop" } = props;
  const isMobileLayout = layoutMode === "mobile";
  const LayoutComponent = isMobileLayout ? MobileGameLayout : DesktopGameLayout;

  return <LayoutComponent {...props} />;
}
