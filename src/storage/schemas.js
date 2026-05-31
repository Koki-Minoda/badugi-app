import { STORAGE_SCHEMA_VERSIONS } from "./keys.js";

export function isPlainObject(value) {
  if (value == null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function validateVersionedObject(value, expectedVersion) {
  return isPlainObject(value) && Number(value.version) === Number(expectedVersion);
}

export function validateTournamentV2(value) {
  return (
    validateVersionedObject(value, STORAGE_SCHEMA_VERSIONS.TOURNAMENT_V2) &&
    isPlainObject(value.tournament) &&
    isPlainObject(value.tournament.stageWins) &&
    Array.isArray(value.tournament.completedTournaments) &&
    Array.isArray(value.tournament.history) &&
    isPlainObject(value.career) &&
    isPlainObject(value.career.statistics) &&
    isPlainObject(value.career.worldChampionship) &&
    isPlainObject(value.rivals) &&
    isPlainObject(value._meta)
  );
}

export function validateCareerProfile(value) {
  return (
    validateVersionedObject(value, STORAGE_SCHEMA_VERSIONS.CAREER_PROFILE) &&
    Array.isArray(value.unlockedVariants) &&
    Array.isArray(value.completedTournaments) &&
    Array.isArray(value.achievements) &&
    isPlainObject(value.statistics)
  );
}

export function validateRivalHistory(value) {
  return (
    validateVersionedObject(value, STORAGE_SCHEMA_VERSIONS.CAREER_RIVALS) &&
    isPlainObject(value.rivals)
  );
}
