export const STORAGE_KEYS = {
  LANGUAGE: "mgx_language",
  LEGACY_LANGUAGE: "language",
  AUTH: "mgx_auth",

  TOURNAMENT_PROGRESS: "progress.tournament",
  TOURNAMENT_HISTORY: "history.tournaments",
  PLAYER_PROGRESS: "playerProgress",
  TOURNAMENT_V2: "mgx.tournament.v2",
  CAREER_PROFILE: "mgx.career.profile",
  CAREER_RIVALS: "mgx.career.rivals",

  TOURNAMENT_SESSION_ACTIVE: "session.tournament.active",
  TOURNAMENT_MTT_ACTIVE: "mgx.tournament.mtt.active",

  TITLE_SETTINGS: "badugi.titleSettings",
  PLAYER_STATS: "badugi_player_stats_v1",
  PLAYER_RATING_STATE: "playerRatingState",

  SYNC_QUEUE: "sync.queue.v1",
  SYSTEM_EVENTS: "history.systemEvents",
  PLAY_FEEDBACK_RESULTS: "mgx.playFeedback.results.v1",

  MIXED_GAME_PROFILES: "mixedGameProfiles",
  DEALER_CHOICE_QUEUE: "dealersChoice.queue",
  DEALER_CHOICE_MODE: "dealersChoice.mode",
  FRIEND_MATCH_ACTIVE_ROOM: "mgx_friend_match_active_room_v1",

  DEV_AI_TIER_OVERRIDE: "dev.aiTierOverride",
  DEV_AI_KPI_SNAPSHOT: "dev.aiKpiSnapshot",
  DEV_P2P_CAPTURE: "dev.p2pCapture",
  DEV_PREVIEW_VARIANTS: "mgx.previewVariants",
  DEV_SHOW_BUILD_INFO: "mgx.showBuildInfo",
};

export const STORAGE_SCHEMA_VERSIONS = {
  TOURNAMENT_V2: 2,
  CAREER_PROFILE: 1,
  CAREER_RIVALS: 1,
  SYNC_QUEUE: 1,
};
