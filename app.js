const exercises = [
  { id: "shoulder", name: "肩", count: 40, color: "#275d8f" },
  { id: "large", name: "大", count: 60, color: "#cf3f2e" },
  { id: "middle", name: "中", count: 40, color: "#236b4b" },
  { id: "small", name: "小", count: 40, color: "#8a5a22" },
  { id: "zero", name: "零", count: 20, color: "#5d4a8f" },
];

const targetTotal = exercises.reduce((sum, exercise) => sum + exercise.count, 0);
const todayKey = new Date().toLocaleDateString("sv-SE");
const storageKey = `pushup-200:${todayKey}`;

const state = loadState();

const todayLabel = document.querySelector("#todayLabel");
const resetButton = document.querySelector("#resetButton");
const drawButton = document.querySelector("#drawButton");
const copyButton = document.querySelector("#copyButton");
const currentExercise = document.querySelector("#currentExercise");
const drawNotice = document.querySelector("#drawNotice");
const excludeCompleted = document.querySelector("#excludeCompleted");
const avoidRepeat = document.querySelector("#avoidRepeat");
const halveWeight = document.querySelector("#halveWeight");
const drawTotalOutput = document.querySelector("#drawTotalOutput");
const totalOutput = document.querySelector("#totalOutput");
const meterFill = document.querySelector("#meterFill");
const exerciseList = document.querySelector("#exerciseList");
const historyList = document.querySelector("#historyList");

todayLabel.textContent = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "full",
}).format(new Date());

excludeCompleted.checked = state.settings.excludeCompleted;
avoidRepeat.checked = state.settings.avoidRepeat;
halveWeight.checked = state.settings.halveWeight;

drawButton.addEventListener("click", drawNext);
copyButton.addEventListener("click", copySummary);
resetButton.addEventListener("click", resetToday);

[excludeCompleted, avoidRepeat, halveWeight].forEach((input) => {
  input.addEventListener("change", () => {
    state.settings = {
      excludeCompleted: excludeCompleted.checked,
      avoidRepeat: avoidRepeat.checked,
      halveWeight: halveWeight.checked,
    };
    saveState();
    render();
  });
});

render();

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      localStorage.removeItem(storageKey);
    }
  }

  return {
    completed: {},
    hits: {},
    history: [],
    lastDrawnId: null,
    settings: {
      excludeCompleted: true,
      avoidRepeat: true,
      halveWeight: true,
    },
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function drawNext() {
  const candidate = pickCandidate();

  if (!candidate) {
    drawNotice.textContent = "今日は200回完了です。お疲れさま。";
    render();
    return;
  }

  const alreadyCompleted = Boolean(state.completed[candidate.id]);
  const hitNumber = (state.hits[candidate.id] || 0) + 1;
  state.hits[candidate.id] = hitNumber;
  state.lastDrawnId = candidate.id;

  if (!alreadyCompleted) {
    state.completed[candidate.id] = true;
    state.history.push({
      id: candidate.id,
      name: candidate.name,
      count: candidate.count,
      hitNumber,
      counted: true,
      repeated: false,
      at: new Date().toISOString(),
    });
    drawNotice.textContent = `${candidate.name}${candidate.count}回を記録しました。`;
  } else {
    state.history.push({
      id: candidate.id,
      name: candidate.name,
      count: candidate.count,
      hitNumber,
      counted: true,
      repeated: true,
      at: new Date().toISOString(),
    });
    drawNotice.textContent = `${candidate.name}${candidate.count}回を追加しました。`;
  }

  saveState();
  render(candidate);
}

function pickCandidate() {
  const allDone = exercises.every((exercise) => state.completed[exercise.id]);
  if (allDone) return null;

  let candidates = exercises.filter((exercise) => {
    if (state.settings.excludeCompleted && state.completed[exercise.id]) return false;
    if (state.settings.avoidRepeat && exercise.id === state.lastDrawnId) {
      const alternatives = exercises.filter((item) => {
        if (state.settings.excludeCompleted && state.completed[item.id]) return false;
        return item.id !== state.lastDrawnId;
      });
      return alternatives.length === 0;
    }
    return true;
  });

  if (candidates.length === 0) {
    candidates = exercises.filter((exercise) => !state.completed[exercise.id]);
  }

  const weighted = candidates.map((exercise) => {
    const hits = state.hits[exercise.id] || 0;
    const weight = state.settings.halveWeight ? 1 / Math.pow(2, hits) : 1;
    return { exercise, weight };
  });

  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.exercise;
  }

  return weighted.at(-1)?.exercise || null;
}

function getCompletedTotal() {
  return state.history.reduce((sum, item) => sum + (item.count || 0), 0);
}

function render(latest = null) {
  const total = getCompletedTotal();
  const remaining = exercises.filter((exercise) => !state.completed[exercise.id]).length;

  if (latest) {
    currentExercise.innerHTML = `
      <span class="current-name">${latest.name}</span>
      <span class="current-count">${latest.count}回</span>
    `;
  } else if (state.history.length > 0) {
    const last = state.history[state.history.length - 1];
    const exercise = exercises.find((item) => item.id === last.id);
    currentExercise.innerHTML = `
      <span class="current-name">${exercise.name}</span>
      <span class="current-count">${exercise.count}回</span>
    `;
  }

  drawTotalOutput.textContent = `${total} 回`;
  totalOutput.textContent = `${total} / ${targetTotal}`;
  meterFill.style.width = `${Math.min(100, (total / targetTotal) * 100)}%`;
  drawButton.disabled = remaining === 0;
  drawButton.textContent = remaining === 0 ? "完了" : "次を引く";

  exerciseList.innerHTML = exercises
    .map((exercise) => {
      const done = state.completed[exercise.id];
      const hits = state.hits[exercise.id] || 0;
      const totalCount = state.history
        .filter((item) => item.id === exercise.id)
        .reduce((sum, item) => sum + (item.count || 0), 0);
      return `
        <article class="exercise-row ${done ? "done" : ""}">
          <span class="badge" style="background:${done ? "var(--green)" : exercise.color}">
            ${done ? "✓" : exercise.name}
          </span>
          <span>
            <strong>${exercise.name}</strong>
            <small>${hits}回出現</small>
          </span>
          <span class="row-count">${totalCount} / ${exercise.count}</span>
        </article>
      `;
    })
    .join("");

  historyList.innerHTML =
    state.history.length === 0
      ? `<li>まだ記録がありません</li>`
      : state.history
          .map((item, index) => {
            const hitNumber = item.hitNumber || getHitNumberAt(index);
            const count = item.count || exercises.find((exercise) => exercise.id === item.id)?.count || 0;
            const label = `${item.name} ${count}回 × ${hitNumber}`;
            return `<li>${label}</li>`;
          })
          .join("");
}

async function copySummary() {
  const total = getCompletedTotal();
  const rows = exercises.map((exercise) => {
    const totalForExercise = state.history
      .filter((item) => item.id === exercise.id)
      .reduce((sum, item) => sum + (item.count || 0), 0);
    return `${exercise.name}: ${totalForExercise}`;
  });
  const order = state.history
    .map((item, index) => {
      const hitNumber = item.hitNumber || getHitNumberAt(index);
      const count = item.count || exercises.find((exercise) => exercise.id === item.id)?.count || 0;
      return `${item.name}${count}x${hitNumber}`;
    })
    .join(" → ");
  const text = [`${todayKey}`, ...rows, `合計: ${total}`, `順番: ${order || "なし"}`].join("\n");

  await navigator.clipboard.writeText(text);
  drawNotice.textContent = "今日の記録をコピーしました。";
}

function resetToday() {
  if (!confirm("今日の記録をリセットしますか？")) return;

  state.completed = {};
  state.hits = {};
  state.history = [];
  state.lastDrawnId = null;
  saveState();
  currentExercise.innerHTML = `<span class="placeholder">まだ引いていません</span>`;
  drawNotice.textContent = "今日の記録をリセットしました。";
  render();
}

function getHitNumberAt(historyIndex) {
  const item = state.history[historyIndex];
  return state.history.slice(0, historyIndex + 1).filter((entry) => entry.id === item.id).length;
}
