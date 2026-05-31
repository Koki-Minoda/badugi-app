/**
 * @typedef {Object} TournamentSeries
 * @property {string} id
 * @property {string} name
 * @property {string} variantId
 * @property {string[]} stageIds
 */

/**
 * @typedef {Object} TournamentStage
 * @property {string} id
 * @property {string} name
 * @property {string} seriesLabel
 * @property {string} blindSheetId
 * @property {string} gameVariant
 * @property {number} startingStack
 * @property {number} seatsPerTable
 * @property {number} totalPlayers
 */

/**
 * @typedef {Object} BlindLevel
 * @property {number} levelIndex
 * @property {number} smallBlind
 * @property {number} bigBlind
 * @property {number} ante
 * @property {number} handsThisLevel
 */

/**
 * @typedef {Object} BlindStructure
 * @property {string} id
 * @property {string} label
 * @property {BlindLevel[]} levels
 */

/**
 * @typedef {Object} PayoutStructure
 * @property {Array<{place: number, percent: number}>} payouts
 */

/**
 * @typedef {Object} UnlockCondition
 * @property {string} id
 * @property {Object} requires
 * @property {Object} unlocks
 */

/**
 * @typedef {Object} TournamentReward
 * @property {number} place
 * @property {number} amount
 * @property {number} percent
 */

/**
 * @typedef {Object} TournamentDefinition
 * @property {string} id
 * @property {string} stageId
 * @property {string} variantId
 * @property {TournamentStage} stage
 * @property {BlindStructure|null} blindStructure
 * @property {PayoutStructure} payoutStructure
 * @property {UnlockCondition[]} unlockConditions
 * @property {Object} config
 */

export const TOURNAMENT_DEFINITION_SCHEMA_VERSION = 1;
