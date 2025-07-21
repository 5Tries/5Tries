let currentQuestIdx = 0; // For tracking current quest number in pack

// ─── 1) Word setup ─────────────────────────────────────────────────────────
let words = [];

// ─── 2) Dictionary set ─────────────────────────────────────────────────────
let validWords = new Set();

// ─── 3) Game config ────────────────────────────────────────────────────────
const maxGuesses       = 5;
const maxDailyAttempts = 3;
const hintCosts        = { reveal: 5, remove: 3, refill: 10 };

// --- Persistent coins ---
function loadCoins() {
  return parseInt(localStorage.getItem("coins"), 10) || 50;
}
function saveCoins(val) {
  localStorage.setItem("coins", val);
}

// --- Per-quest progress system ---
function questKey(pack, quest) {
  return `progress_${pack}_q${quest}`;
}
function loadQuestProgress(pack, quest) {
  return parseInt(localStorage.getItem(questKey(pack, quest)), 10) || 0;
}
function saveQuestProgress(pack, quest, val) {
  localStorage.setItem(questKey(pack, quest), val);
}
function isQuestComplete(pack, quest) {
  return loadQuestProgress(pack, quest) >= 10;
}
function isQuestUnlocked(pack, quest) {
  return quest === 0 || isQuestComplete(pack, quest - 1);
}

// Completed board state storage
function saveCompletedBoard(pack, quest, guesses, results, row) {
  localStorage.setItem(
    `completedBoard_${pack}_${quest}`,
    JSON.stringify({ guesses, results, row })
  );
}
function clearCompletedBoard(pack, quest) {
  localStorage.removeItem(`completedBoard_${pack}_${quest}`);
}
function loadCompletedBoard(pack, quest) {
  const val = localStorage.getItem(`completedBoard_${pack}_${quest}`);
  return val ? JSON.parse(val) : null;
}

// ─── 4) Pack order & sizes ─────────────────────────────────────────────────
const PACK_ORDER = [
  "Starter Pack",
  "Nature & Living Things",
  "Food & Drinks",
  "Urban Life",
  "World & Travel",
  "Art’s & Culture"
];
const PACK_SIZES = PACK_ORDER.reduce((m, p) => (m[p] = 5, m), {});

// ─── 5) Pack JSON URLs & cache ─────────────────────────────────────────────
const PACK_DATA_URL = {
  "Starter Pack": "https://raw.githubusercontent.com/5Tries/5Tries/main/data/Starter%20Pack.json", 
  "Nature & Living Things": "https://raw.githubusercontent.com/5Tries/5Tries/main/data/Nature%20%26%20Living%20Things.json",
  "Food & Drinks": "https://raw.githubusercontent.com/5Tries/5Tries/main/data/Food%20%26%20Drinks.json",
  "Urban Life": "https://raw.githubusercontent.com/5Tries/5Tries/main/data/Urban%20Life.json",
  "World & Travel": "https://raw.githubusercontent.com/5Tries/5Tries/main/data/World%20%26%20Travel.json",
  "Art’s & Culture": "https://raw.githubusercontent.com/5Tries/5Tries/main/data/Arts%20%26%20Culture.json"
};
const packCache = {};

// ─── 6) Game state ─────────────────────────────────────────────────────────
let targetWord, currentGuess, currentRow, attemptsLeft, coins;
let revealedLetters, gameActive, currentPack = "", currentHint = "";
let guessesArr = [];      // To save past guesses for completed board state
let resultsArr = [];
let leavingMidGame = false; // Used for exit warning

// ─── 7) DOM refs ───────────────────────────────────────────────────────────
const board             = document.getElementById("board");
const keyboard          = document.getElementById("keyboard");
const messageEl         = document.getElementById("message");
const scoreEl           = document.getElementById("score");
const attemptsEl        = document.getElementById("attempts");
const revealBtn         = document.getElementById("revealLetterBtn");
const removeBtn         = document.getElementById("removeLetterBtn");
const refillBtn         = document.getElementById("refillAttemptBtn");
const nextBtn           = document.getElementById("nextWordBtn");
const startBtn          = document.getElementById("startBtn");
const loadingScreen     = document.getElementById("loadingScreen");
const loadingProgress   = document.getElementById("loadingProgress");
const progressionScreen = document.getElementById("progressionScreen");
const questScreen       = document.getElementById("questScreen");
const backBtn           = document.getElementById("backBtn");
const gameContainer     = document.getElementById("gameContainer");
const backGameBtn       = document.getElementById("backGameBtn");
const hintBtn           = document.getElementById("hintBtn");
const hintBox           = document.getElementById("hintBox");

// ─── 8) Load 5‑letter dictionary ──────────────────────────────────────────
async function loadDictionary() {
  const res = await fetch("https://cdn.jsdelivr.net/gh/5Tries/5Tries@main/words_alpha.txt");
  const text = await res.text();
  text.split("\n").forEach(raw => {
    const w = raw.trim();
    if (w.length === 5) validWords.add(w.toUpperCase());
  });
}

// ─── 9) Daily attempts persistence ────────────────────────────────────────
function loadDailyAttempts() {
  const last = localStorage.getItem("lastReset"), now = Date.now();
  if (!last || now - new Date(last).getTime() >= 24 * 60 * 60 * 1000) {
    attemptsLeft = maxDailyAttempts;
    localStorage.setItem("lastReset", new Date().toISOString());
  } else {
    const s = parseInt(localStorage.getItem("attemptsLeft"), 10);
    attemptsLeft = isNaN(s) ? maxDailyAttempts : s;
  }
  localStorage.setItem("attemptsLeft", attemptsLeft);
}
function saveDailyAttempts() {
  localStorage.setItem("attemptsLeft", attemptsLeft);
}

// ─── 10) Pick a random target word ─────────────────────────────────────────
function pickWord() {
  return words[Math.floor(Math.random() * words.length)];
}

// ─── 11) Prepare game & pack UI ─────────────────────────────────────────────
async function prepareGame() {
  await loadDictionary();
  loadingProgress.style.width = "100%";
  loadDailyAttempts();
  coins = loadCoins();
  unlockPacksBasedOnCompletion();
  updatePackLevelsUI();
  startBtn.style.display = "block";
}
prepareGame();

// ─── 12) Render pack/quest progress circles dynamically ────────────────────
function updatePackLevelsUI() {
  document.querySelectorAll(".pack").forEach((sec, idx) => {
    const packName = PACK_ORDER[idx];
    const levels = sec.querySelector(".levels");
    levels.innerHTML = ""; // Clear old

    for (let q = 0; q < 5; q++) {
      const progress = loadQuestProgress(packName, q);
      const unlocked = isQuestUnlocked(packName, q) && (idx === 0 || isPackUnlocked(idx));
      const complete = progress >= 10;

      const span = document.createElement("span");
      span.className = "level";
      if (!unlocked) {
        span.classList.add("locked");
        span.innerHTML = `<span class="level-lock">🔒</span>`;
      } else if (complete) {
        span.classList.add("completed");
        span.innerHTML = `<span class="level-progress">✅</span>`;
      } else {
        span.classList.add("unlocked");
        span.innerHTML = `<span class="level-progress">${progress}/10</span>`;
      }

      // Only add click for unlocked/incomplete
      if (unlocked && !complete) {
        span.onclick = () => {
          currentPack = packName;
          currentQuestIdx = q;
          fetchAndStartQuest(packName, q);
        };
      }

      levels.appendChild(span);
    }
    // Pack lock state for styling
    if (!isPackUnlocked(idx)) {
      sec.classList.add("locked");
      sec.classList.remove("unlocked");
    } else {
      sec.classList.add("unlocked");
      sec.classList.remove("locked");
    }
  });
}
function isPackUnlocked(idx) {
  if (idx === 0) return true;
  const prev = PACK_ORDER[idx - 1];
  let prevDone = 0;
  for (let q = 0; q < 5; q++) prevDone += Math.min(10, loadQuestProgress(prev, q));
  return prevDone >= 50;
}
function fetchAndStartQuest(packName, questIdx) {
  (async () => {
    if (!packCache[packName]) {
      const res = await fetch(PACK_DATA_URL[packName]);
      packCache[packName] = await res.json();
    }
    const q = packCache[packName].quests[questIdx];
    words       = q.words.map(w => w.toUpperCase());
    currentHint = q.hint || "";
    questScreen.style.display = "none";
    startGame();
  })();
}

// ─── 13) Back handlers (w/ warning if mid-game) ────────────────────────────
backBtn.addEventListener("click", () => {
  questScreen.style.display       = "none";
  progressionScreen.style.display = "flex";
  updatePackLevelsUI();
});
backGameBtn.addEventListener("click", () => {
  // If game is active and user already started guessing, warn & penalize
  if (gameActive && (currentRow > 0 || currentGuess.some(l => l))) {
    if (confirm("Leaving now will lose an attempt. Continue?")) {
      attemptsLeft--;
      saveDailyAttempts();
      gameActive = false; // To prevent re-trigger
      saveCoins(coins); // Do not reset coins!
      showMessage("Left early. Attempt lost!");
      updateAttempts();
      // Optionally, you may want to save the grid as "failed"/completed
      markWordComplete();
      saveCompletedBoard(currentPack, currentQuestIdx, guessesArr, resultsArr, currentRow-1);
      gameContainer.style.display = "none";
      progressionScreen.style.display = "flex";
      updatePackLevelsUI();
    }
    return;
  }
  gameContainer.style.display     = "none";
  progressionScreen.style.display = "flex";
  updatePackLevelsUI();
});

// ─── 14) Start → show pack list ────────────────────────────────────────────
startBtn.addEventListener("click", () => {
  loadingScreen.style.display     = "none";
  progressionScreen.style.display = "flex";
  updatePackLevelsUI();
});

// ─── 15) Start game UI (with restore last-completed) ───────────────────────
function startGame() {
  progressionScreen.style.display = "none";
  questScreen.style.display       = "none";
  gameContainer.style.display     = "block";

  coins           = loadCoins();
  targetWord      = pickWord();
  currentGuess    = ["", "", "", "", ""];
  currentRow      = 0;
  revealedLetters = {};
  gameActive      = true;
  guessesArr      = [];
  resultsArr      = [];

  hintBtn.style.display = currentHint ? "inline-block" : "none";
  hintBox.style.display = "none";
  hintBox.textContent   = "";

  // Try to restore last completed board
  const completed = loadCompletedBoard(currentPack, currentQuestIdx);
  if (completed) {
    renderCompletedBoard(completed);
    gameActive = false;
    nextBtn.style.display = "block";
    updateScore();
    updateAttempts();
    return;
  }

  initBoard();
  buildKeyboard();
  updateBoard();
  updateScore();
  updateAttempts();
}

function renderCompletedBoard(completed) {
  board.innerHTML = "";
  for (let r = 0; r <= completed.row; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.textContent = completed.guesses[r][c] || "";
      if (completed.results[r][c]) cell.classList.add(completed.results[r][c]);
      board.appendChild(cell);
    }
  }
  // Fill out rest of board (empty rows)
  for (let i = (completed.row + 1) * 5; i < 25; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    board.appendChild(cell);
  }
}

// ─── 16) Hint toggle ───────────────────────────────────────────────────────
hintBtn.addEventListener("click", () => {
  if (hintBox.style.display === "block") hintBox.style.display = "none";
  else {
    hintBox.innerHTML = `<button class="close-btn">&times;</button>${currentHint}`;
    hintBox.style.display = "block";
    hintBox.querySelector(".close-btn").onclick = () => hintBox.style.display = "none";
  }
});

// ─── 17) Build 5×5 board ───────────────────────────────────────────────────
function initBoard() {
  board.innerHTML = "";
  for (let i = 0; i < 25; i++) {
    const c = document.createElement("div");
    c.className = "cell";
    board.appendChild(c);
  }
}

// ─── 18) Update stats ─────────────────────────────────────────────────────
function updateScore()   { scoreEl.textContent = `🪙 ${coins}`; }
function updateAttempts(){ attemptsEl.textContent = "🔁".repeat(attemptsLeft); }

// ─── 19) Render current guess ─────────────────────────────────────────────
function updateBoard() {
  for (let i = 0; i < 5; i++) {
    const cell = board.children[currentRow * 5 + i];
    cell.textContent = currentGuess[i] ? currentGuess[i].toUpperCase() : "";
    cell.className   = "cell";
    if (revealedLetters[i]) cell.classList.add("correct");
  }
}

// ─── 20) Show a message ───────────────────────────────────────────────────
function showMessage(msg) {
  messageEl.textContent = msg;
}

// ─── 21) On‑screen keyboard ───────────────────────────────────────────────
function addKey(row, key, cls="") {
  const btn = document.createElement("button");
  btn.textContent = key.toUpperCase();
  btn.className = cls ? `key ${cls}` : "key";
  if (/^[A-Z]$/.test(key.toUpperCase()))
    btn.id = `key-${key.toUpperCase()}`;
  btn.onclick = () => handleKey(key);
  row.appendChild(btn);
}
function buildKeyboard() {
  const layout = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  keyboard.innerHTML = "";
  layout.forEach((r, i) => {
    const div = document.createElement("div");
    div.className = "keyboard-row";
    if (i === 2) addKey(div, "Enter", "wide");
    r.split("").forEach(k => addKey(div, k));
    if (i === 2) addKey(div, "←", "wide");
    keyboard.appendChild(div);
  });
}

// ─── 22) Handle key input ─────────────────────────────────────────────────
function handleKey(k) {
  if (!gameActive) return;
  if (k === "Enter") {
    if (currentGuess.includes("")) {
      showMessage("Incomplete word");
    } else {
      checkGuess();
    }
    return;
  }
  if (k === "←") {
    for (let i = 4; i >= 0; i--) {
      if (!revealedLetters[i] && currentGuess[i]) {
        currentGuess[i] = "";
        break;
      }
    }
    updateBoard();
    return;
  }
  if (/^[a-zA-Z]$/.test(k)) {
    for (let i = 0; i < 5; i++) {
      if (!currentGuess[i] && !revealedLetters[i]) {
        currentGuess[i] = k.toLowerCase();
        break;
      }
    }
    updateBoard();
  }
}

// ─── 23) Check guess & coloring ───────────────────────────────────────────
function checkGuess() {
  const guess = currentGuess.join("").toUpperCase();
  if (!validWords.has(guess)) return;  // silently ignore non-valid words

  // frequency map for targetWord
  const freq = {};
  for (let c of targetWord) freq[c] = (freq[c] || 0) + 1;

  // first pass: correct letters in correct position
  const result = Array(5).fill("absent");
  for (let i = 0; i < 5; i++) {
    if (guess[i] === targetWord[i]) {
      result[i] = "correct";
      freq[guess[i]]--;
    }
  }
  // second pass: correct letters in wrong position
  for (let i = 0; i < 5; i++) {
    if (result[i] !== "correct" && freq[guess[i]] > 0) {
      result[i] = "present";
      freq[guess[i]]--;
    }
  }

  // Save this guess/result for the completed board, if finished
  guessesArr.push(currentGuess.map(l => l.toUpperCase()));
  resultsArr.push([...result]);

  // update board tiles
  for (let i = 0; i < 5; i++) {
    const cell = board.children[currentRow * 5 + i];
    cell.classList.add(result[i]);
  }

  // update keyboard keys: only upgrade, never downgrade
  const keyStatus = {};
  for (let i = 0; i < 5; i++) {
    const ltr = guess[i];
    if (result[i] === "correct") keyStatus[ltr] = "correct";
    else if (result[i] === "present" && keyStatus[ltr] !== "correct") keyStatus[ltr] = "present";
    else if (!keyStatus[ltr]) keyStatus[ltr] = "absent";
  }
  for (let ltr in keyStatus) {
    const btn = document.getElementById(`key-${ltr}`);
    if (!btn) continue;
    if (
      (keyStatus[ltr] === "correct") ||
      (keyStatus[ltr] === "present" && !btn.classList.contains("correct")) ||
      (keyStatus[ltr] === "absent" && !btn.classList.contains("present") && !btn.classList.contains("correct"))
    ) {
      btn.classList.remove("correct", "present", "absent");
      btn.classList.add(keyStatus[ltr]);
    }
  }

  // win condition: word guessed correctly
  if (guess === targetWord) {
    markWordComplete();
    unlockPacksBasedOnCompletion();
    updatePackLevelsUI();
    coins = loadCoins() + (maxGuesses - currentRow); // Add reward
    saveCoins(coins);
    updateScore();
    showMessage(`Correct! +${maxGuesses - currentRow} coins`);
    gameActive = false;
    nextBtn.style.display = "block";
    saveCompletedBoard(currentPack, currentQuestIdx, guessesArr, resultsArr, currentRow);
    return;
  }

  // if the guess was not correct, go to next row or mark failure
  currentRow++;
  if (currentRow >= maxGuesses) {
    attemptsLeft--;
    saveDailyAttempts();
    updateAttempts();
    messageEl.innerHTML = `Out of guesses! Word was <span class="reveal-word">${targetWord}</span>`;
    markWordComplete();
    gameActive = false;
    nextBtn.style.display = "block";
    saveCompletedBoard(currentPack, currentQuestIdx, guessesArr, resultsArr, currentRow-1);
    return;
  }

  // prepare for the next guess
  currentGuess    = ["", "", "", "", ""];
  revealedLetters = {};
  updateBoard();
}

// ─── 24) Mark word complete (per-quest) ───────────────────────────────────
function markWordComplete() {
  let progress = loadQuestProgress(currentPack, currentQuestIdx);
  if (progress < 10) {
    saveQuestProgress(currentPack, currentQuestIdx, progress + 1);
  }
}

// ─── 25) Unlock packs based on quest completion ────────────────────────────
function unlockPacksBasedOnCompletion() {
  PACK_ORDER.forEach((pack, idx) => {
    if (idx === 0) return; // Starter always unlocked
    const prev = PACK_ORDER[idx - 1];
    const sec  = document.querySelector(`.pack:nth-child(${idx + 1})`);
    let prevDone = 0;
    for (let q = 0; q < 5; q++) prevDone += Math.min(10, loadQuestProgress(prev, q));
    if (prevDone >= 50) {
      sec.classList.add("unlocked");
      sec.classList.remove("locked");
    } else {
      sec.classList.remove("unlocked");
      sec.classList.add("locked");
    }
  });
}

// ─── 26) Hints & economy ───────────────────────────────────────────────────
revealBtn.onclick = () => {
  if (coins < hintCosts.reveal) return;
  const spots = [];
  for (let i = 0; i < 5; i++) {
    // Only reveal if not already filled with correct letter (either revealed or guessed by player)
    if (
      !revealedLetters[i] &&
      (!currentGuess[i] || currentGuess[i].toUpperCase() !== targetWord[i])
    ) {
      spots.push(i);
    }
  }
  if (!spots.length) return;
  const idx = spots[Math.floor(Math.random() * spots.length)];
  revealedLetters[idx] = true;
  currentGuess[idx] = targetWord[idx];
  updateBoard();
  coins -= hintCosts.reveal;
  saveCoins(coins);
  updateScore();
};
removeBtn.onclick = () => {
  if (coins < hintCosts.remove) return;
  const wrong = Array.from(document.querySelectorAll(".key"))
    .filter(b => /^[A-Z]$/.test(b.textContent) && !targetWord.includes(b.textContent) && !b.classList.contains("absent"));
  if (!wrong.length) return;
  const btn = wrong[Math.floor(Math.random() * wrong.length)];
  btn.classList.add("absent");
  btn.disabled = true;
  coins -= hintCosts.remove;
  saveCoins(coins);
  updateScore();
};
refillBtn.onclick = () => {
  if (coins < hintCosts.refill || attemptsLeft >= maxDailyAttempts) return;
  coins -= hintCosts.refill;
  saveCoins(coins);
  attemptsLeft++;
  saveDailyAttempts();
  updateScore();
  updateAttempts();
};

// ─── 27) Next‑word ─────────────────────────────────────────────────────────
nextBtn.onclick = () => {
  clearCompletedBoard(currentPack, currentQuestIdx);
  targetWord      = pickWord();
  currentGuess    = ["", "", "", "", ""];
  currentRow      = 0;
  revealedLetters = {};
  gameActive      = true;
  guessesArr      = [];
  resultsArr      = [];
  initBoard();
  buildKeyboard();
  updateBoard();
  updateScore();
  updateAttempts();
  messageEl.textContent = "";
  nextBtn.style.display = "none";
};

// ─── 28) Physical keyboard input ─────────────────────────────────────────
window.addEventListener("keydown", e => {
  if (e.key === "Enter") handleKey("Enter");
  else if (e.key === "Backspace") handleKey("←");
  else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key);
});
