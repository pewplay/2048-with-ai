window.fakeStorage = {
  _data: {},

  setItem: function (id, val) {
    return this._data[id] = String(val);
  },

  getItem: function (id) {
    return this._data.hasOwnProperty(id) ? this._data[id] : null;
  },

  removeItem: function (id) {
    return delete this._data[id];
  },

  clear: function () {
    return this._data = {};
  }
};

// Every PewPlay game shares one domain, so all keys carry the game slug.
function LocalStorageManager() {
  this.prefix        = "2048-with-ai:";
  this.bestScoreKey  = this.prefix + "bestScore";
  this.gameStateKey  = this.prefix + "gameState";
  this.statsKey      = this.prefix + "stats";
  this.settingsKey   = this.prefix + "settings";

  var supported = this.localStorageSupported();
  this.storage = supported ? window.localStorage : window.fakeStorage;
}

LocalStorageManager.prototype.localStorageSupported = function () {
  var testKey = "2048-with-ai:test";

  try {
    var storage = window.localStorage;
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
};

LocalStorageManager.prototype.validState = function (json) {
  try {
    var state = typeof json === "string" ? JSON.parse(json) : json;
    return !!(state && state.grid && state.grid.size === 4 && state.grid.cells &&
              state.grid.cells.length === 4 && !state.over);
  } catch (e) {
    return false;
  }
};

LocalStorageManager.prototype.set = function (key, value) {
  try { this.storage.setItem(key, value); } catch (e) {}
};

// Best score getters/setters
LocalStorageManager.prototype.getBestScore = function () {
  return +this.storage.getItem(this.bestScoreKey) || 0;
};

LocalStorageManager.prototype.setBestScore = function (score) {
  this.set(this.bestScoreKey, score);
};

// Game state getters/setters and clearing
LocalStorageManager.prototype.getGameState = function () {
  var stateJSON = this.storage.getItem(this.gameStateKey);
  if (!stateJSON || !this.validState(stateJSON)) return null;
  return JSON.parse(stateJSON);
};

LocalStorageManager.prototype.setGameState = function (gameState) {
  this.set(this.gameStateKey, JSON.stringify(gameState));
};

LocalStorageManager.prototype.clearGameState = function () {
  try { this.storage.removeItem(this.gameStateKey); } catch (e) {}
};

// Highest tile reached in each finished game: stats[n] = games that ended with 2^n
LocalStorageManager.prototype.getStats = function () {
  try {
    var stats = JSON.parse(this.storage.getItem(this.statsKey));
    if (Array.isArray(stats) && stats.length <= 20) {
      return stats.map(function (n) { return Math.max(0, Math.floor(+n) || 0); });
    }
  } catch (e) {}
  return [];
};

LocalStorageManager.prototype.setStats = function (stats) {
  this.set(this.statsKey, JSON.stringify(stats));
};

LocalStorageManager.prototype.getSettings = function () {
  try {
    var settings = JSON.parse(this.storage.getItem(this.settingsKey));
    return settings && typeof settings === "object" ? settings : null;
  } catch (e) {
    return null;
  }
};

LocalStorageManager.prototype.setSettings = function (settings) {
  this.set(this.settingsKey, JSON.stringify(settings));
};
