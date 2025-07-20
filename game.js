// script.js

// 1) your small target list
const words = ["lemon","grape","honey","clear","amber"].map(w=>w.toUpperCase());

// 2) dictionary set
let validWords = new Set();

const maxGuesses       = 5;
const maxDailyAttempts = 3;
const hintCosts        = { reveal:5, remove:3, refill:10 };

let targetWord, currentGuess, currentRow, attemptsLeft, coins;
let revealedLetters, gameActive;

// DOM refs
const loadingScreen   = document.getElementById("loadingScreen");
const loadingProgress = document.getElementById("loadingProgress");
const startBtn        = document.getElementById("startBtn");
const gameContainer   = document.getElementById("gameContainer");

const board       = document.getElementById("board");
const keyboard    = document.getElementById("keyboard");
const messageEl   = document.getElementById("message");
const scoreEl     = document.getElementById("score");
const attemptsEl  = document.getElementById("attempts");
const revealBtn   = document.getElementById("revealLetterBtn");
const removeBtn   = document.getElementById("removeLetterBtn");
const refillBtn   = document.getElementById("refillAttemptBtn");
const nextBtn     = document.getElementById("nextWordBtn");

// ─── load full 5‑letter dictionary ─────────────────────────────────────────
async function loadDictionary() {
  const res  = await fetch(
    "https://cdn.jsdelivr.net/gh/5Tries/5Tries@main/words_alpha.txt"
  );
  const txt  = await res.text();
  txt.split("\n").forEach(raw=>{
    const w = raw.trim();
    if(w.length===5) validWords.add(w.toUpperCase());
  });
}

// ─── daily attempts persistence ────────────────────────────────────────────
function loadDailyAttempts(){
  const last = localStorage.getItem("lastReset"), now=Date.now();
  if(!last|| now - new Date(last).getTime()>=24*60*60*1000){
    attemptsLeft = maxDailyAttempts;
    localStorage.setItem("lastReset", new Date().toISOString());
  } else {
    const stored = parseInt(localStorage.getItem("attemptsLeft"),10);
    attemptsLeft = isNaN(stored)? maxDailyAttempts: stored;
  }
  localStorage.setItem("attemptsLeft",attemptsLeft);
}
function saveDailyAttempts(){
  localStorage.setItem("attemptsLeft",attemptsLeft);
}

// ─── pick word ─────────────────────────────────────────────────────────────
function pickWord(){
  return words[Math.floor(Math.random()*words.length)];
}

// ─── start & hide loading screen ───────────────────────────────────────────
function startGame(){
  loadingScreen.style.display = "none";
  gameContainer.style.display = "block";
  // initialize game state
  coins           = 50;
  targetWord      = pickWord();
  currentGuess    = ["","","","",""];
  currentRow      = 0;
  revealedLetters = {};
  gameActive      = true;
  initBoard();
  buildKeyboard();
  updateBoard();
  updateScore();
  updateAttempts();
}

// ─── prepare: load resources then show Start ───────────────────────────────
async function prepareGame(){
  // kick off dictionary load
  await loadDictionary();
  // show progress bar at 100%
  loadingProgress.style.width = "100%";
  // load or reset attempts
  loadDailyAttempts();
  // reveal Start button
  startBtn.style.display = "block";
}

startBtn.onclick = startGame;
prepareGame();  // begin loading on script load

// ─── the rest of your existing game code unchanged ─────────────────────────

// build board
function initBoard(){
  board.innerHTML="";
  for(let i=0;i<25;i++){
    const cell = document.createElement("div");
    cell.className="cell";
    board.appendChild(cell);
  }
}

// stats
function updateScore()   { scoreEl.textContent    = `🪙 ${coins}`; }
function updateAttempts(){ attemptsEl.textContent = "🔁".repeat(attemptsLeft); }

// render letters
function updateBoard(){
  for(let i=0;i<5;i++){
    const cell = board.children[currentRow*5+i];
    cell.textContent = currentGuess[i]?.toUpperCase()||"";
    cell.className   = "cell";
    if(revealedLetters[i]) cell.classList.add("correct");
  }
}

// messaging
function showMessage(msg){ messageEl.textContent=msg; }

// keyboard
function addKey(row,key,cls=""){
  const btn=document.createElement("button");
  btn.textContent=key.toUpperCase();
  btn.className=cls?`key ${cls}`:"key";
  if(/^[A-Z]$/.test(key.toUpperCase())) btn.id=`key-${key.toUpperCase()}`;
  btn.onclick=()=>handleKey(key);
  row.appendChild(btn);
}
function buildKeyboard(){
  const layout=["qwertyuiop","asdfghjkl","zxcvbnm"];
  keyboard.innerHTML="";
  layout.forEach((row,idx)=>{
    const div=document.createElement("div");
    div.className="keyboard-row";
    if(idx===2) addKey(div,"Enter","wide");
    row.split("").forEach(k=>addKey(div,k));
    if(idx===2) addKey(div,"←","wide");
    keyboard.appendChild(div);
  });
}

// key handling
function handleKey(k){
  if(!gameActive) return;
  if(k==="Enter"){
    if(currentGuess.includes("")){ showMessage("Incomplete word"); return; }
    checkGuess(); return;
  }
  if(k==="←"){
    for(let i=4;i>=0;i--){
      if(!revealedLetters[i]&&currentGuess[i]){
        currentGuess[i]="";
        break;
      }
    }
    updateBoard(); return;
  }
  if(/^[a-zA-Z]$/.test(k)){
    for(let i=0;i<5;i++){
      if(!currentGuess[i]&&!revealedLetters[i]){
        currentGuess[i]=k.toLowerCase();
        break;
      }
    }
    updateBoard();
  }
}

// guess checking
function checkGuess(){
  const guess=currentGuess.join("").toUpperCase();
  if(!validWords.has(guess)) return;
  const freq={};
  for(let c of targetWord) freq[c]=(freq[c]||0)+1;
  const result=Array(5).fill("absent");
  // correct
  for(let i=0;i<5;i++){
    if(guess[i]===targetWord[i]){
      result[i]="correct"; freq[guess[i]]--;
    }
  }
  // present
  for(let i=0;i<5;i++){
    if(result[i]==="correct") continue;
    if(freq[guess[i]]>0){
      result[i]="present"; freq[guess[i]]--;
    }
  }
  // apply
  for(let i=0;i<5;i++){
    const cell=board.children[currentRow*5+i];
    const keyBtn=document.getElementById(`key-${guess[i]}`);
    cell.classList.add(result[i]);
    if(keyBtn&&!keyBtn.classList.contains("correct")){
      keyBtn.classList.remove("present","absent");
      keyBtn.classList.add(result[i]);
    }
  }
  // win
  if(guess===targetWord){
    const reward=maxGuesses-currentRow;
    coins+=reward; updateScore();
    showMessage(`Correct! +${reward} coins`);
    gameActive=false;
    nextBtn.style.display="block";
    return;
  }
  // next row or end
  currentRow++;
  if(currentRow>=maxGuesses){
    attemptsLeft--; saveDailyAttempts(); updateAttempts();
    messageEl.innerHTML=
      `Out of guesses! Word was <span class="reveal-word">${targetWord}</span>`;
    gameActive=false;
    nextBtn.style.display="block";
    return;
  }
  currentGuess=["","","","",""];
  revealedLetters={};
  updateBoard();
}

// hints
revealBtn.onclick=()=>{
  if(coins<hintCosts.reveal){ showMessage("Not enough coins."); return; }
  const spots=[];
  for(let i=0;i<5;i++) if(!revealedLetters[i]) spots.push(i);
  if(!spots.length) return;
  const idx=spots[Math.floor(Math.random()*spots.length)];
  revealedLetters[idx]=true;
  currentGuess[idx]=targetWord[idx].toLowerCase();
  updateBoard();
  coins-=hintCosts.reveal; updateScore();
};

removeBtn.onclick=()=>{
  if(coins<hintCosts.remove){ showMessage("Not enough coins."); return; }
  const wrong=Array.from(document.querySelectorAll(".key"))
    .filter(b=>/^[A-Z]$/.test(b.textContent)&&
                !targetWord.includes(b.textContent)&&
                !b.classList.contains("absent"));
  if(!wrong.length){ showMessage("No removable letters left."); return; }
  const btn=wrong[Math.floor(Math.random()*wrong.length)];
  btn.classList.add("absent"); btn.disabled=true;
  coins-=hintCosts.remove; updateScore();
};

refillBtn.onclick=()=>{
  if(coins<hintCosts.refill){ showMessage("Not enough coins."); return; }
  if(attemptsLeft>=maxDailyAttempts){ showMessage("Attempts are full!"); return; }
  coins-=hintCosts.refill; attemptsLeft++;
  saveDailyAttempts(); updateScore(); updateAttempts();
  showMessage("One attempt replenished!");
};

// next-word
nextBtn.onclick=nextWord;
function nextWord(){
  targetWord=pickWord();
  currentGuess=["","","","",""];
  currentRow=0;
  // attemptsLeft persists
  revealedLetters={};
  gameActive=true;
  initBoard(); buildKeyboard();
  updateBoard(); updateScore(); updateAttempts();
  messageEl.textContent="";
  nextBtn.style.display="none";
}

// physical keyboard
window.addEventListener("keydown",e=>{
  if(e.key==="Enter") handleKey("Enter");
  else if(e.key==="Backspace") handleKey("←");
  else if(/^[a-zA-Z]$/.test(e.key)) handleKey(e.key);
});
