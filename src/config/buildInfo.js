const fallbackBuildInfo = {
  commit: "unknown",
  buildTime: "unknown",
  appVersion: "0.0.0",
};

export const BUILD_INFO =
  typeof __MGX_BUILD_INFO__ !== "undefined"
    ? __MGX_BUILD_INFO__
    : fallbackBuildInfo;

export default BUILD_INFO;
