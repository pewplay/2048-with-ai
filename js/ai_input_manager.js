// Drives the game with a computer player. The page is watch-only: the player
// picks the AI mode, speed and tile generator, and can pause or restart.
function AIInputManager() {
  this.events = {};
  this.stats = [];
  this.paused = false;
  this.runningAI = false;
  this.aiID = null;
  this.restartTimer = null;
  this.countdownTimer = null;
  this.loopToken = 0;
  this.listen();
}

var AIMode = { RNG: 0, PRIORITY: 1, ALGORITHM: 2, SMART: 3 };
var AISpeed = { FULL: 0, FAST: 1, SLOW: 2 };
var TileGenerator = { RANDOM: 0, EVIL: 1 };

AIInputManager.prototype.mode = AIMode.SMART;
AIInputManager.prototype.speed = AISpeed.FAST;
AIInputManager.prototype.tileGenerator = TileGenerator.RANDOM;
AIInputManager.prototype.fastMoveTime = 200;  // milliseconds
AIInputManager.prototype.slowMoveTime = 750;  // milliseconds
AIInputManager.prototype.restartDelay = 5;    // seconds after a game over
AIInputManager.prototype.game = null;

AIInputManager.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

AIInputManager.prototype.emit = function (event, data) {
  var callbacks = this.events[event];
  if (callbacks) {
    callbacks.forEach(function (callback) {
      callback(data);
    });
  }
};

AIInputManager.prototype.listen = function () {
  var self = this;

  this.bindButtonPress(".retry-button", this.newGame);
  this.bindButtonPress(".new-game-button", this.newGame);
  this.bindButtonPress(".pause-button", this.pauseOrResume);

  this.bindRadio("ai-mode", function (v) { this.setAIMode(v); });
  this.bindRadio("ai-speed", function (v) { this.setAISpeed(v); });
  this.bindRadio("ai-tilegen", function (v) { this.setTileGenerator(v); });

  // Space / P toggles pause, N starts a new game.
  document.addEventListener("keydown", function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    var onControl = event.target.closest && event.target.closest("button, input, label");
    if ((event.code === "Space" && !onControl) || event.code === "KeyP") {
      event.preventDefault();
      self.pauseOrResume();
    } else if (event.code === "KeyN") {
      self.newGame();
    }
  });

  document.addEventListener("visibilitychange", function () { self.sync(); });
  document.getElementById("app").addEventListener("contextmenu", function (e) { e.preventDefault(); });
};

// Called by the GameManager once the game exists.
AIInputManager.prototype.ready = function () {
  var store = this.game.storageManager;
  this.stats = store.getStats();
  var settings = store.getSettings();
  if (settings) {
    if (settings.mode >= 0 && settings.mode <= 3) this.mode = settings.mode;
    if (settings.speed >= 0 && settings.speed <= 2) this.speed = settings.speed;
    if (settings.tiles === 0 || settings.tiles === 1) this.tileGenerator = settings.tiles;
  }
  this.checkRadio("ai-mode", this.mode);
  this.checkRadio("ai-speed", this.speed);
  this.checkRadio("ai-tilegen", this.tileGenerator);
  this.setAIMode(this.mode);
  this.setTileGenerator(this.tileGenerator);
  this.renderStats();
  this.sync();
};

AIInputManager.prototype.saveSettings = function () {
  if (!this.game) return;
  this.game.storageManager.setSettings({ mode: this.mode, speed: this.speed, tiles: this.tileGenerator });
};

// ---------- Running state ----------

AIInputManager.prototype.shouldRun = function () {
  return !!this.game && !this.paused && !document.hidden && !this.game.over;
};

AIInputManager.prototype.sync = function () {
  var run = this.shouldRun();
  if (run && !this.runningAI) this.startAI();
  else if (!run && this.runningAI) this.stopAI();
  var container = document.querySelector(".game-container");
  container.classList.toggle("is-paused", this.paused && !!this.game && !this.game.over);
  var pause = document.querySelector(".pause-button");
  pause.textContent = this.paused ? "Resume" : "Pause";
  pause.setAttribute("aria-pressed", this.paused ? "true" : "false");
};

AIInputManager.prototype.startAI = function () {
  var self = this;
  this.stopAI();
  this.runningAI = true;
  var token = ++this.loopToken;
  if (this.speed === AISpeed.FULL) {
    var loop = function () {
      if (token !== self.loopToken || !self.runningAI) return;
      self.nextMove();
      if (token === self.loopToken && self.runningAI) setTimeout(loop, 0);
    };
    setTimeout(loop, 0);
  } else {
    var delay = this.speed === AISpeed.SLOW ? this.slowMoveTime : this.fastMoveTime;
    this.aiID = setInterval(function () {
      if (token === self.loopToken) self.nextMove();
    }, delay);
  }
};

AIInputManager.prototype.stopAI = function () {
  this.runningAI = false;
  this.loopToken++;
  clearInterval(this.aiID);
  this.aiID = null;
};

AIInputManager.prototype.nextMove = function () {
  var game = this.game;
  if (!game || game.over) return;
  if (!game.movesAvailable()) {
    game.over = true;
    game.actuate();
  } else {
    if (!this.ai) this.setAIMode(this.mode);
    this.emit("move", this.ai.nextMove());
  }

  if (game.over) {
    this.stopAI();
    this.updateStats();
    this.scheduleRestart();
    this.sync();
  }
};

AIInputManager.prototype.scheduleRestart = function () {
  var self = this;
  this.clearRestart();
  var left = this.restartDelay;
  var label = document.querySelector(".next-game");
  function show() {
    label.textContent = "Next game in " + left + " s";
  }
  show();
  this.countdownTimer = setInterval(function () {
    if (document.hidden) return; // wait while the page is hidden
    left--;
    if (left <= 0) {
      self.newGame();
    } else {
      show();
    }
  }, 1000);
};

AIInputManager.prototype.clearRestart = function () {
  clearInterval(this.countdownTimer);
  this.countdownTimer = null;
  var label = document.querySelector(".next-game");
  if (label) label.textContent = "";
};

AIInputManager.prototype.newGame = function (event) {
  if (event && event.preventDefault) event.preventDefault();
  this.clearRestart();
  this.stopAI();
  this.emit("restart");
  if (this.ai && this.ai.prevMove !== undefined) this.ai.prevMove = -1;
  this.sync();
};

AIInputManager.prototype.pauseOrResume = function (event) {
  if (event && event.preventDefault) event.preventDefault();
  this.paused = !this.paused;
  this.sync();
};

// ---------- Settings ----------

AIInputManager.prototype.setAIMode = function (mode) {
  this.mode = mode;
  switch (mode) {
    case AIMode.RNG:       this.ai = new RNGAI(this.game); break;
    case AIMode.PRIORITY:  this.ai = new PriorityAI(this.game); break;
    case AIMode.ALGORITHM: this.ai = new AlgorithmAI(this.game); break;
    default:               this.ai = new SmartAI(this.game); break;
  }
  this.saveSettings();
};

AIInputManager.prototype.setAISpeed = function (speed) {
  this.speed = speed;
  // Restart the loop at the new speed.
  if (this.runningAI) this.startAI();
  this.saveSettings();
};

AIInputManager.prototype.setTileGenerator = function (gen) {
  this.tileGenerator = gen;
  if (this.game) {
    this.game.generateTile = gen === TileGenerator.EVIL ? this.game.addEvilTile : this.game.addRandomTile;
  }
  this.saveSettings();
};

// ---------- Statistics ----------

if (!Math.log2) {
  Math.log2 = function (x) {
    return Math.log(x) / Math.LN2;
  };
}

// Tile colours for the statistics list (index = log2 of the tile value)
var STAT_COLORS = [
  ["#eee4da", "#776e65"], ["#eee4da", "#776e65"], ["#eee4da", "#776e65"], ["#f2b179", "#f9f6f2"],
  ["#f59563", "#f9f6f2"], ["#f67c5f", "#f9f6f2"], ["#f65e3b", "#f9f6f2"], ["#edcf72", "#f9f6f2"],
  ["#edcc61", "#f9f6f2"], ["#edc850", "#f9f6f2"], ["#edc53f", "#f9f6f2"], ["#edc22e", "#f9f6f2"],
  ["#3c3a32", "#f9f6f2"]
];

AIInputManager.prototype.updateStats = function () {
  var maxValue = 0;
  this.game.grid.eachCell(function (x, y, tile) {
    if (tile) maxValue = Math.max(tile.value, maxValue);
  });
  if (!maxValue) return;
  var index = Math.round(Math.log2(maxValue));
  while (index >= this.stats.length) this.stats.push(0);
  this.stats[index] += 1;
  this.game.storageManager.setStats(this.stats);
  this.renderStats();
};

AIInputManager.prototype.renderStats = function () {
  var container = document.querySelector(".stats-container");
  var countEl = document.querySelector(".games-count");
  var total = 0, max = 0, i;
  for (i = 0; i < this.stats.length; i++) {
    total += this.stats[i];
    max = Math.max(max, this.stats[i]);
  }
  countEl.textContent = total ? "(" + total + (total === 1 ? " game)" : " games)") : "";

  while (container.firstChild) container.removeChild(container.firstChild);
  if (!total) {
    var empty = document.createElement("div");
    empty.className = "stats-empty";
    empty.textContent = "No finished games yet.";
    container.appendChild(empty);
    return;
  }

  // Highest tiles first; keep the list short so it always fits.
  var rows = 0;
  for (i = this.stats.length - 1; i >= 0 && rows < 6; i--) {
    if (!this.stats[i]) continue;
    rows++;
    var percentage = Math.round(this.stats[i] / total * 1000) / 10;
    var row = document.createElement("div");
    row.className = "stats-row";
    var tile = document.createElement("span");
    tile.className = "stats-tile";
    tile.textContent = Math.pow(2, i);
    var colors = STAT_COLORS[Math.min(i, STAT_COLORS.length - 1)];
    tile.style.background = colors[0];
    tile.style.color = colors[1];
    var bar = document.createElement("span");
    bar.className = "stats-bar";
    var fill = document.createElement("i");
    fill.style.width = Math.max(4, this.stats[i] / max * 100) + "%";
    bar.appendChild(fill);
    var value = document.createElement("span");
    value.className = "stats-value";
    value.textContent = this.stats[i] + " · " + percentage + "%";
    row.appendChild(tile);
    row.appendChild(bar);
    row.appendChild(value);
    container.appendChild(row);
  }
  if (window.pewplayLayout) window.pewplayLayout();
};

// ---------- DOM helpers ----------

AIInputManager.prototype.bindButtonPress = function (selector, fn) {
  var button = document.querySelector(selector);
  if (button) button.addEventListener("click", fn.bind(this));
};

AIInputManager.prototype.bindRadio = function (name, fn) {
  var self = this;
  var inputs = document.querySelectorAll('input[name="' + name + '"]');
  Array.prototype.forEach.call(inputs, function (input) {
    input.addEventListener("change", function () {
      if (input.checked) fn.call(self, +input.value);
    });
  });
};

AIInputManager.prototype.checkRadio = function (name, value) {
  var input = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
  if (input) input.checked = true;
};
