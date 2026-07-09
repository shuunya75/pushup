const exercises = [
  { id: "shoulder", name: "肩", count: 40, color: "#275d8f" },
  { id: "large", name: "大", count: 60, color: "#cf3f2e" },
  { id: "middle", name: "中", count: 40, color: "#236b4b" },
  { id: "small", name: "小", count: 40, color: "#8a5a22" },
  { id: "zero", name: "零", count: 20, color: "#5d4a8f" },
];

const todayKey = new Date().toLocaleDateString("sv-SE");
const storageKey = `pushup-200:${todayKey}`;

const state = loadState();

const todayLabel = document.querySelector("#todayLabel");
const resetButton = document.querySelector("#resetButton");
const drawButton = document.querySelector("#drawButton");
const copyButton = document.querySelector("#copyButton");
const manualButtons = document.querySelectorAll("[data-exercise-id]");
const currentExercise = document.querySelector("#currentExercise");
const drawNotice = document.querySelector("#drawNotice");
const excludeCompleted = document.querySelector("#excludeCompleted");
const halveWeight = document.querySelector("#halveWeight");
const menuStatus = document.querySelector("#menuStatus");
const historyList = document.querySelector("#historyList");

todayLabel.textContent = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "full",
}).format(new Date());

excludeCompleted.checked = state.settings.excludeCompleted;
halveWeight.checked = state.settings.halveWeight;

drawButton.addEventListener("click", drawNext);
copyButton.addEventListener("click", copySummary);
resetButton.addEventListener("click", resetToday);

manualButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const exercise = exercises.find((item) => item.id === button.dataset.exerciseId);
    if (!exercise) return;

    recordExercise(exercise, "manual");
  });
});

[excludeCompleted, halveWeight].forEach((input) => {
  input.addEventListener("change", () => {
    state.settings = {
      excludeCompleted: excludeCompleted.checked,
      avoidRepeat: true,
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
      const parsed = JSON.parse(saved);
      return {
        completed: parsed.completed || {},
        hits: parsed.hits || {},
        history: Array.isArray(parsed.history) ? parsed.history : [],
        lastDrawnId: parsed.lastDrawnId || null,
        settings: {
          excludeCompleted: parsed.settings?.excludeCompleted ?? true,
          avoidRepeat: true,
          halveWeight: parsed.settings?.halveWeight ?? true,
        },
      };
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
    drawNotice.textContent = "基本メニュー完了です。お疲れさま。";
    render();
    return;
  }

  recordExercise(candidate, "random");
}

function recordExercise(exercise, source) {
  const alreadyCompleted = Boolean(state.completed[exercise.id]);
  const hitNumber = (state.hits[exercise.id] || 0) + 1;
  state.hits[exercise.id] = hitNumber;
  state.lastDrawnId = exercise.id;

  if (!alreadyCompleted) {
    state.completed[exercise.id] = true;
    state.history.push({
      id: exercise.id,
      name: exercise.name,
      count: exercise.count,
      hitNumber,
      counted: true,
      source,
      repeated: false,
      at: new Date().toISOString(),
    });
    drawNotice.textContent =
      source === "manual" ? `${exercise.name}${exercise.count}回を手動で記録しました。` : `${exercise.name}${exercise.count}回を記録しました。`;
  } else {
    state.history.push({
      id: exercise.id,
      name: exercise.name,
      count: exercise.count,
      hitNumber,
      counted: true,
      source,
      repeated: true,
      at: new Date().toISOString(),
    });
    drawNotice.textContent =
      source === "manual" ? `${exercise.name}${exercise.count}回を手動で追加しました。` : `${exercise.name}${exercise.count}回を追加しました。`;
  }

  saveState();
  render(exercise);
}

function pickCandidate() {
  const allDone = exercises.every((exercise) => state.completed[exercise.id]);
  if (allDone) return null;

  let candidates = exercises.filter((exercise) => {
    if (state.settings.excludeCompleted && state.completed[exercise.id]) return false;
    if (exercise.id === state.lastDrawnId) {
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

function getExerciseStats() {
  return exercises.map((exercise) => {
    const entries = state.history.filter((item) => item.id === exercise.id);
    const hits = entries.length || state.hits[exercise.id] || 0;
    const total = entries.reduce((sum, item) => sum + (item.count || exercise.count), 0);

    return {
      ...exercise,
      hits,
      total,
      done: Boolean(state.completed[exercise.id]) || hits > 0,
    };
  });
}

function formatExercise(stat) {
  return `${stat.name}${stat.count}${stat.hits > 1 ? `×${stat.hits}` : ""}`;
}

function render(latest = null) {
  const total = getCompletedTotal();
  const stats = getExerciseStats();
  const remainingStats = stats.filter((stat) => !stat.done);
  const completedStats = stats.filter((stat) => stat.done);
  const remaining = remainingStats.length;

  if (latest) {
    currentExercise.innerHTML = `
      <span class="current-name">${latest.name}</span>
      <span class="current-count">${latest.count}回</span>
    `;
  } else if (state.history.length > 0) {
    const last = state.history[state.history.length - 1];
    const exercise = exercises.find((item) => item.id === last.id);
    if (exercise) {
      currentExercise.innerHTML = `
        <span class="current-name">${exercise.name}</span>
        <span class="current-count">${exercise.count}回</span>
      `;
    }
  }

  menuStatus.innerHTML = `
    <p class="status-heading">${remaining === 0 ? "基本メニュー完了！" : `あと${remaining}種目で完了`}</p>
    <dl class="status-list">
      <div>
        <dt>残り</dt>
        <dd>${remainingStats.length === 0 ? "なし" : remainingStats.map(formatExercise).join("、")}</dd>
      </div>
      <div>
        <dt>実施済み</dt>
        <dd>${completedStats.length === 0 ? "なし" : completedStats.map(formatExercise).join("、")}</dd>
      </div>
      <div>
        <dt>総回数</dt>
        <dd>${total}回</dd>
      </div>
    </dl>
  `;
  drawButton.disabled = remaining === 0;
  drawButton.textContent = remaining === 0 ? "完了" : "次を引く";

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
