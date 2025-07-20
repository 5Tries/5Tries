const words = ["lemon", "grape", "honey", "clear", "amber"];
let targetWord = words[Math.floor(Math.random() * words.length)];
let currentGuess = ["", "", "", "", ""];
let currentRow = 0;
let attemptsLeft = 3;
let coins = 0;
let revealedLetters = {}; // Locked only for current row
let usedLetters = new Set();
let gameActive = true;

const board = document.getElementById("board");
const keyboard = document.getElementById("keyboard");
const message = document.getElementById("message");
const score = document.getElementById("score");
const attempts = document.getElementById("attempts");
const revealBtn = document.getElementById("revealLetterBtn");
const removeBtn = document.getElementById("removeLetterBtn");

function initBoard() {
  board.innerHTML = "";
  for (let i = 0; i < 25; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    board.appendChild(cell);
  }
}

function updateScore() {
  score.textContent = `🪙${coins}`;
}

function updateAttempts() {
  attempts.innerHTML = "🔁".repeat(attemptsLeft);
}

function updateBoard() {
  for (let i = 0; i < 5; i++) {
    const cell = board.children[currentRow * 5 + i];
    cell.textContent = currentGuess[i]?.toUpperCase() || "";
    cell.className = "cell";
    if (revealedLetters[i]) {
      cell.classList.add("correct");
    }
  }
}

function showMessage(msg) {
  message.textContent = msg;
  setTimeout(() => (message.textContent = ""), 2000);
}

function buildKeyboard() {
  const layout = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  keyboard.innerHTML = "";
  layout.forEach((row, rowIndex) => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "keyboard-row";
    if (rowIndex === 2) addKey(rowDiv, "Enter", "wide");
    for (let key of row) addKey(rowDiv, key);
    if (rowIndex === 2) addKey(rowDiv, "←", "wide");
    keyboard.appendChild(rowDiv);
  });
}

function addKey(row, key, extraClass = "") {
  const keyBtn = document.createElement("button");
  keyBtn.textContent = key.toUpperCase();
  keyBtn.className = `key ${extraClass}`;
  keyBtn.onclick = () => handleKey(key);
  keyBtn.id = `key-${key}`;
  row.appendChild(keyBtn);
}

function handleKey(k) {
  if (!gameActive) return;

  if (k === "Enter") {
    if (currentGuess.includes("")) {
      showMessage("Incomplete word");
      return;
    }
    checkGuess();
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

function checkGuess() {
  const guessWord = currentGuess.join("");
  const result = Array(5).fill("absent");

  for (let i = 0; i < 5; i++) {
    if (currentGuess[i] === targetWord[i]) {
      result[i] = "correct";
    } else if (targetWord.includes(currentGuess[i])) {
      result[i] = "present";
    }
    usedLetters.add(currentGuess[i]);
  }

  for (let i = 0; i < 5; i++) {
    const cell = board.children[currentRow * 5 + i];
    cell.classList.add(result[i]);
    const keyBtn = document.getElementById(`key-${currentGuess[i]}`);
    if (keyBtn && !keyBtn.classList.contains("correct")) {
      keyBtn.classList.add(result[i]);
    }
  }

  if (guessWord === targetWord) {
    const earned = 5 - (currentRow % 5);
    coins += earned;
    updateScore();
    showMessage(`Correct! +${earned} coins`);
    setTimeout(nextWord, 1500);
  } else {
    currentRow++;
    if (currentRow % 5 === 0) {
      attemptsLeft--;
      updateAttempts();
      if (attemptsLeft === 0) {
        showMessage(`Out of attempts! Word was: ${targetWord.toUpperCase()}`);
        gameActive = false;
        setTimeout(nextWord, 3000);
        return;
      }
    }
    currentGuess = ["", "", "", "", ""];
    revealedLetters = {};
    updateBoard();
  }
}

function nextWord() {
  targetWord = words[Math.floor(Math.random() * words.length)];
  currentGuess = ["", "", "", "", ""];
  currentRow = 0;
  attemptsLeft = 3;
  revealedLetters = {};
  usedLetters = new Set();
  gameActive = true;
  initBoard();
  buildKeyboard();
  updateBoard();
  updateScore();
  updateAttempts();
}

revealBtn.onclick = () => {
  if (coins < 5) return showMessage("Not enough coins.");
  const unrevealed = [];
  for (let i = 0; i < 5; i++) {
    if (!revealedLetters[i]) unrevealed.push(i);
  }
  if (unrevealed.length > 0) {
    const rand = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    revealedLetters[rand] = targetWord[rand];
    currentGuess[rand] = targetWord[rand];
    updateBoard();
    coins -= 5;
    updateScore();
  }
};

removeBtn.onclick = () => {
  if (coins < 3) return showMessage("Not enough coins.");
  const keyboardLetters = [..."abcdefghijklmnopqrstuvwxyz"];
  const notInWord = keyboardLetters.filter(
    l => !targetWord.includes(l) && !document.getElementById(`key-${l}`).classList.contains("absent")
  );

  if (notInWord.length > 0) {
    const toGray = notInWord[Math.floor(Math.random() * notInWord.length)];
    const keyBtn = document.getElementById(`key-${toGray}`);
    if (keyBtn) {
      keyBtn.classList.add("absent");
    }
    coins -= 3;
    updateScore();
  } else {
    showMessage("No removable letters left.");
  }
};

// Start Game
initBoard();
buildKeyboard();
updateBoard();
updateScore();
updateAttempts();
