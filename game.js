// ================= USER PROFILE, LOGIN, DAILY REWARD ===================
let username = localStorage.getItem('username') || '';
let coins = parseInt(localStorage.getItem('coins'), 10) || 50;
let attemptsLeft = parseInt(localStorage.getItem('attemptsLeft'), 10) || 3;
let lastLogin = localStorage.getItem('lastLogin') || '';
let firstInstall = !localStorage.getItem('firstInstall');

// Username modal elements
const usernameModal = document.getElementById('usernameModal');
const usernameInput = document.getElementById('usernameInput');
const setUsernameBtn = document.getElementById('setUsernameBtn');

// Modal event for username
if (!username) usernameModal.style.display = 'flex';
setUsernameBtn.onclick = function() {
  const val = usernameInput.value.trim();
  if (val.length < 2) return alert('Name too short!');
  username = val;
  localStorage.setItem('username', username);
  usernameModal.style.display = 'none';
  updateStats();
};
if (username) usernameModal.style.display = 'none';

// First install bonus
if (firstInstall) {
  coins = 50;
  attemptsLeft = 3;
  localStorage.setItem('coins', coins);
  localStorage.setItem('attemptsLeft', attemptsLeft);
  localStorage.setItem('firstInstall', 'done');
}

// Daily attempt reset & login bonus
function checkDailyReset() {
  const today = (new Date()).toDateString();
  if (lastLogin !== today) {
    attemptsLeft = 3;
    coins += 10; // Daily login bonus
    localStorage.setItem('coins', coins);
    localStorage.setItem('attemptsLeft', attemptsLeft);
    lastLogin = today;
    localStorage.setItem('lastLogin', today);
    alert('Daily login bonus! +10 coins & attempts reset.');
  }
}
checkDailyReset();

// ================== ECONOMY / SHOP / UI STATS ====================
function updateStats() {
  document.getElementById('progCoinVal').textContent = coins;
  document.getElementById('progAttemptVal').textContent = attemptsLeft;
  if (document.getElementById('score')) document.getElementById('score').textContent = '🪙 ' + coins;
  if (document.getElementById('attempts')) document.getElementById('attempts').textContent = '🔁'.repeat(attemptsLeft);
}

// Coin → attempt conversion
document.getElementById('progRefillBtn').onclick = function() {
  if (coins >= 10 && attemptsLeft < 3) {
    coins -= 10;
    attemptsLeft += 1;
    localStorage.setItem('coins', coins);
    localStorage.setItem('attemptsLeft', attemptsLeft);
    updateStats();
    alert('+1 attempt for 10 coins!');
  } else {
    alert('Not enough coins or already at max attempts.');
  }
};

// Buy coins button (placeholder for real IAP)
document.getElementById('progBuyCoinsBtn').onclick = function() {
  coins += 50;
  localStorage.setItem('coins', coins);
  updateStats();
  alert('You bought 50 coins!');
};

// =============== PACKS/QUESTS/WORD DATA LOADING ==================
const PACK_ORDER = [
  "Starter Pack",
  "Nature & Living Things",
  "Food & Drinks",
  "Urban Life",
  "World & Travel",
  "Art’s & Culture"
];
const PACK_SIZES = PACK_ORDER.reduce((m, p) => (m[p] = 5, m), {});
const PACK_DATA_URL = {
  "Starter Pack": "https://raw.githubusercontent.com/5Tries/5Tries/main/data/Starter%20Pack.json",
  "Nature & Living Things": "https://raw.githubusercontent.com/5Tries/5Tries/main/data/Nature%20%26%20Living%20Things.json",
  "Food & Drinks": "https://raw.githubusercontent.com/5Tries/5Tries/main/data/Food%20%26%20Drinks.json",
  "Urban Life": "https://raw.githubusercontent.com/5Tries/5Tries/main/data/Urban%20Life.json",
  "World & Travel": "https://raw.githubusercontent.com/5Tries/5Tries/main/data/World%20%26%20Travel.json",
  "Art’s & Culture": "https://raw.githubusercontent.com/5Tries/5Tries/main/data/Arts%20%26%20Culture.json"
};
const packCache = {};
let currentPack = '', currentQuestIdx = 0, words = [], usedWords = [];
let validWords = new Set();
let targetWord = '', currentGuess = ["", "", "", "", ""], currentRow = 0, revealedLetters = {}, gameActive = false;
let guessesArr = [], resultsArr = [], currentHint = "";

// ========== DICTIONARY LOAD ===============
async function loadDictionary() {
  const res = await fetch("https://cdn.jsdelivr.net/gh/5Tries/5Tries@main/words_alpha.txt");
  const text = await res.text();
  text.split("\n").forEach(raw => {
    const w = raw.trim();
    if (w.length === 5) validWords.add(w.toUpperCase());
  });
}

// ========== LOADING / INITIALIZE ==========
const loadingScreen     = document.getElementById("loadingScreen");
const loadingProgress   = document.getElementById("loadingProgress");
const startBtn          = document.getElementById("startBtn");
const progressionScreen = document.getElementById("progressionScreen");
const questScreen       = document.getElementById("questScreen");
const gameContainer     = document.getElementById("gameContainer");
const backBtn           = document.getElementById("backBtn");
const backGameBtn       = document.getElementById("backGameBtn");
const hintBtn           = document.getElementById("hintBtn");
const hintBox           = document.getElementById("hintBox");
const scoreEl           = document.getElementById("score");
const attemptsEl        = document.getElementById("attempts");
const revealBtn         = document.getElementById("revealLetterBtn");
const removeBtn         = document.getElementById("removeLetterBtn");
const refillBtn         = document.getElementById("refillAttemptBtn");
const nextBtn           = document.getElementById("nextWordBtn");
const board             = document.getElementById("board");
const keyboard          = document.getElementById("keyboard");
const messageEl         = document.getElementById("message");

// Persistent coins, attempts helpers
function saveCoins(val) {
  coins = val;
  localStorage.setItem("coins", val);
  updateStats();
}
function saveAttempts(val) {
  attemptsLeft = val;
  localStorage.setItem("attemptsLeft", val);
  updateStats();
}

// === Per-quest progress system ===
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
function usedWordsKey(pack, quest) { return `usedWords_${pack}_q${quest}`; }
function loadUsedWords(pack, quest) {
  let arr = [];
  try { arr = JSON.parse(localStorage.getItem(usedWordsKey(pack, quest))) || []; } catch {}
  return arr;
}
function saveUsedWords(pack, quest, arr) { localStorage.setItem(usedWordsKey(pack, quest), JSON.stringify(arr)); }

// ======= INITIALIZE =======
async function prepareGame() {
  await loadDictionary();
  loadingProgress.style.width = "100%";
  updateStats();
  unlockPacksBasedOnCompletion();
  updatePackLevelsUI();
  startBtn.style.display = "block";
}
prepareGame();

startBtn.onclick = function() {
  loadingScreen.style.display = "none";
  progressionScreen.style.display = "flex";
  updatePackLevelsUI();
};

// ========== PACK/QUEST UI LOGIC ==========
function updatePackLevelsUI() {
  document.querySelectorAll(".pack").forEach((sec, idx) => {
    const packName = PACK_ORDER[idx];
    const levels = sec.querySelector(".levels");
    levels.innerHTML = "";
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
      if (unlocked && !complete) {
        span.onclick = () => {
          currentPack = packName;
          currentQuestIdx = q;
          fetchAndStartQuest(packName, q);
        };
      }
      levels.appendChild(span);
    }
    // Pack lock state
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
    usedWords   = loadUsedWords(packName, questIdx);
    currentHint = q.hint || "";
    questScreen.style.display = "none";
    if (attemptsLeft <= 0) {
      showMessage("You are out of attempts! Use 'Refill Attempt' or come back tomorrow.");
      showReturnToTheme();
      return;
    }
    startGame();
  })();
}

function showReturnToTheme() {
  nextBtn.textContent = "Return to Theme Menu";
  nextBtn.style.display = "block";
  nextBtn.onclick = function() {
    gameContainer.style.display = "none";
    progressionScreen.style.display = "flex";
    updatePackLevelsUI();
    nextBtn.textContent = "Next Word";
    nextBtn.onclick = nextWordHandler;
  };
}
backBtn.addEventListener("click", () => {
  questScreen.style.display = "none";
  progressionScreen.style.display = "flex";
  updatePackLevelsUI();
});
backGameBtn.addEventListener("click", () => {
  if (gameActive && (currentRow > 0 || currentGuess.some(l => l))) {
    if (confirm("Leaving now will lose an attempt. Continue?")) {
      attemptsLeft--;
      saveAttempts(attemptsLeft);
      gameActive = false;
      showMessage("Left early. Attempt lost!");
      markWordComplete();
      gameContainer.style.display = "none";
      progressionScreen.style.display = "flex";
      updatePackLevelsUI();
      updateStats();
    }
    return;
  }
  gameContainer.style.display = "none";
  progressionScreen.style.display = "flex";
  updatePackLevelsUI();
});

function startGame() {
  progressionScreen.style.display = "none";
  questScreen.style.display = "none";
  gameContainer.style.display = "block";
  usedWords       = loadUsedWords(currentPack, currentQuestIdx);

  // All words completed
  if (loadQuestProgress(currentPack, currentQuestIdx) >= 10 || usedWords.length >= words.length) {
    showMessage("All words in this quest completed!");
    nextBtn.style.display = "none";
    gameActive = false;
    initBoard();
    buildKeyboard();
    updateStats();
    return;
  }

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
  initBoard();
  buildKeyboard();
  updateBoard();
  updateStats();
}

// ========== BOARD/KEYBOARD LOGIC ==========
function initBoard() {
  board.innerHTML = "";
  for (let i = 0; i < 25; i++) {
    const c = document.createElement("div");
    c.className = "cell";
    board.appendChild(c);
  }
}
function updateBoard() {
  for (let i = 0; i < 5; i++) {
    const cell = board.children[currentRow * 5 + i];
    cell.textContent = currentGuess[i] ? currentGuess[i].toUpperCase() : "";
    cell.className   = "cell";
    if (revealedLetters[i]) cell.classList.add("correct");
  }
}
function addKey(row, key, cls="") {
  const btn = document.createElement("button");
  btn.textContent = key.toUpperCase();
  btn.className = cls ? `key ${cls}` : "key";
  if (/^[A-Z]$/.test(key.toUpperCase())) btn.id = `key-${key.toUpperCase()}`;
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

// ========== GUESS/CHECKING LOGIC ==========
function pickWord() {
  let unused = words.filter(w => !usedWords.includes(w));
  if (!unused.length) return null;
  return unused[Math.floor(Math.random() * unused.length)];
}
function checkGuess() {
  const guess = currentGuess.join("").toUpperCase();
  if (!validWords.has(guess)) { showMessage("Not a valid word"); return; }

  // Coloring/feedback logic
  const freq = {};
  for (let c of targetWord) freq[c] = (freq[c] || 0) + 1;
  const result = Array(5).fill("absent");
  for (let i = 0; i < 5; i++) {
    if (guess[i] === targetWord[i]) {
      result[i] = "correct";
      freq[guess[i]]--;
    }
  }
  for (let i = 0; i < 5; i++) {
    if (result[i] !== "correct" && freq[guess[i]] > 0) {
      result[i] = "present";
      freq[guess[i]]--;
    }
  }

  guessesArr.push(currentGuess.map(l => l.toUpperCase()));
  resultsArr.push([...result]);
  for (let i = 0; i < 5; i++) {
    const cell = board.children[currentRow * 5 + i];
    cell.classList.add(result[i]);
  }
  // Keyboard color feedback
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
  // WIN
  if (guess === targetWord) {
    if (!usedWords.includes(targetWord)) {
      usedWords.push(targetWord);
      saveUsedWords(currentPack, currentQuestIdx, usedWords);
    }
    markWordComplete();
    unlockPacksBasedOnCompletion();
    updatePackLevelsUI();
    // Coins reward by try
    let reward = 5 - currentRow;
    coins += reward;
    saveCoins(coins);
    showMessage(`Correct! +${reward} coins`);
    gameActive = false;
    nextBtn.textContent = "Next Word";
    nextBtn.style.display = (loadQuestProgress(currentPack, currentQuestIdx) < 10 && attemptsLeft > 0) ? "block" : "none";
    if (loadQuestProgress(currentPack, currentQuestIdx) >= 10 || usedWords.length >= words.length) {
      showMessage("All words in this quest completed!");
      showReturnToTheme();
      gameActive = false;
    }
    return;
  }
  // FAIL
  currentRow++;
  if (currentRow >= 5) {
    attemptsLeft--;
    saveAttempts(attemptsLeft);
    showMessage(`Out of guesses! Word was ${targetWord}`);
    if (!usedWords.includes(targetWord)) {
      usedWords.push(targetWord);
      saveUsedWords(currentPack, currentQuestIdx, usedWords);
    }
    markWordComplete();
    gameActive = false;
    if (attemptsLeft <= 0) {
      showMessage("Out of attempts! Come back tomorrow or refill.");
      showReturnToTheme();
      return;
    }
    if (loadQuestProgress(currentPack, currentQuestIdx) >= 10 || usedWords.length >= words.length) {
      showMessage("All words in this quest completed!");
      showReturnToTheme();
      return;
    }
    nextBtn.textContent = "Next Word";
    nextBtn.style.display = "block";
    return;
  }
  currentGuess    = ["", "", "", "", ""];
  revealedLetters = {};
  updateBoard();
}
function markWordComplete() {
  let progress = loadQuestProgress(currentPack, currentQuestIdx);
  if (progress < 10) {
    saveQuestProgress(currentPack, currentQuestIdx, progress + 1);
  }
}

// ========== HINT BUTTON/REVEAL/REMOVE ==========
hintBtn.onclick = () => {
  if (hintBox.style.display === "block") hintBox.style.display = "none";
  else {
    hintBox.innerHTML = `<button class="close-btn">&times;</button>${currentHint}`;
    hintBox.style.display = "block";
    hintBox.querySelector(".close-btn").onclick = () => hintBox.style.display = "none";
  }
};
revealBtn.onclick = () => {
  if (coins < 5) return alert("Not enough coins!");
  const spots = [];
  for (let i = 0; i < 5; i++) {
    if (
      !revealedLetters[i] &&
      (!currentGuess[i] || currentGuess[i].toUpperCase() !== targetWord[i])
    ) {
      spots.push(i);
    }
  }
  if (!spots.length) return alert("No more letters to reveal!");
  const idx = spots[Math.floor(Math.random() * spots.length)];
  revealedLetters[idx] = true;
  currentGuess[idx] = targetWord[idx];
  coins -= 5;
  saveCoins(coins);
  updateBoard();
};
removeBtn.onclick = () => {
  if (coins < 3) return alert("Not enough coins!");
  const wrong = Array.from(document.querySelectorAll(".key"))
    .filter(b => /^[A-Z]$/.test(b.textContent) && !targetWord.includes(b.textContent) && !b.classList.contains("absent"));
  if (!wrong.length) return alert("No letters to remove!");
  const btn = wrong[Math.floor(Math.random() * wrong.length)];
  btn.classList.add("absent");
  btn.disabled = true;
  coins -= 3;
  saveCoins(coins);
  updateStats();
};
refillBtn.onclick = () => {
  if (coins < 10 || attemptsLeft >= 3) return alert("Not enough coins or already at max attempts.");
  coins -= 10;
  attemptsLeft++;
  saveCoins(coins);
  saveAttempts(attemptsLeft);
  updateStats();
};

// ========== NEXT WORD HANDLER ==========
function nextWordHandler() {
  usedWords = loadUsedWords(currentPack, currentQuestIdx);
  if (loadQuestProgress(currentPack, currentQuestIdx) >= 10 || usedWords.length >= words.length) {
    showMessage("All words in this quest completed!");
    nextBtn.style.display = "none";
    gameActive = false;
    initBoard();
    buildKeyboard();
    updateStats();
    return;
  }
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
  updateStats();
  messageEl.textContent = "";
  nextBtn.style.display = "none";
}
nextBtn.onclick = nextWordHandler;

// ========== PHYSICAL KEYBOARD ==========
window.addEventListener("keydown", e => {
  if (e.key === "Enter") handleKey("Enter");
  else if (e.key === "Backspace") handleKey("←");
  else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key);
});

// ========== UNLOCK/PROGRESSION ==========
function unlockPacksBasedOnCompletion() {
  PACK_ORDER.forEach((pack, idx) => {
    if (idx === 0) return;
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

// ========== MESSAGE DISPLAY ==========
function showMessage(msg) {
  messageEl.textContent = msg;
}

// ========== INITIALIZE ON LOAD ==========
window.onload = function() {
  updateStats();
  updatePackLevelsUI();
};
