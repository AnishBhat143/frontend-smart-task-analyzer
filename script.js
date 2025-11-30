// Base URL of your Django API
const API_BASE = "http://127.0.0.1:8000/api/tasks";

let builtTasks = [];
let nextLocalId = 1;


function setStatus(message) {
    const el = document.getElementById("statusMessage");
    el.textContent = message || "";
}

function updateBuiltTasksInfo() {
    const info = document.getElementById("builtTasksInfo");
    if (!info) return;

    if (builtTasks.length === 0) {
        info.textContent = "No tasks added from form yet.";
    } else {
        info.textContent = `Form tasks in memory: ${builtTasks.length} (they will be analyzed if JSON area is empty).`;
    }
}

function addTaskFromForm() {
    const titleEl = document.getElementById("formTitle");
    const dueEl = document.getElementById("formDueDate");
    const importanceEl = document.getElementById("formImportance");
    const hoursEl = document.getElementById("formHours");
    const depsEl = document.getElementById("formDependencies");

    const title = (titleEl.value || "").trim();
    if (!title) {
        alert("Title is required.");
        return;
    }

    const due_date = dueEl.value ? dueEl.value : null;

    let importance = importanceEl.value ? parseInt(importanceEl.value, 10) : 5;
    if (isNaN(importance) || importance < 1 || importance > 10) {
        importance = 5;
    }

    let estimated_hours = hoursEl.value ? parseInt(hoursEl.value, 10) : 1;
    if (isNaN(estimated_hours) || estimated_hours < 1) {
        estimated_hours = 1;
    }

    let dependencies = [];
    const rawDeps = (depsEl.value || "").trim();
    if (rawDeps.length > 0) {
        dependencies = rawDeps
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .map((s) => parseInt(s, 10))
            .filter((n) => !isNaN(n));
    }

    const newTask = {
        id: nextLocalId++,
        title,
        due_date,
        importance,
        estimated_hours,
        dependencies,
    };

    builtTasks.push(newTask);

    // Clear form fields (keep dependencies optional)
    titleEl.value = "";
    // keep due date as is or clear as you like
    // dueEl.value = "";
    importanceEl.value = "";
    hoursEl.value = "";
    depsEl.value = "";

    updateBuiltTasksInfo();
}


function getPriorityBadgeClass(score) {
    if (score >= 120) return "badge-high";
    if (score >= 80) return "badge-medium";
    return "badge-low";
}

function renderResults(tasks) {
    const container = document.getElementById("resultsContainer");
    container.innerHTML = "";

    if (!tasks || tasks.length === 0) {
        const p = document.createElement("p");
        p.className = "placeholder";
        p.textContent = "No tasks to display.";
        container.appendChild(p);
        return;
    }

    tasks.forEach((task, index) => {
        const card = document.createElement("div");
        card.className = "task-card";

        const header = document.createElement("div");
        header.className = "task-header";

        const title = document.createElement("div");
        title.className = "task-title";
        title.textContent = `${index + 1}. ${task.title || "Untitled Task"}`;

        const badge = document.createElement("div");
        badge.className = `badge ${getPriorityBadgeClass(task.score || 0)}`;
        badge.textContent = `Score: ${task.score ?? "?"}`;

        header.appendChild(title);
        header.appendChild(badge);

        const meta = document.createElement("div");
        meta.className = "task-meta";

        const due = document.createElement("div");
        due.className = "meta-item";
        due.textContent = `Due: ${task.due_date || "N/A"}`;

        const importance = document.createElement("div");
        importance.className = "meta-item";
        importance.textContent = `Importance: ${task.importance ?? "?"}`;

        const hours = document.createElement("div");
        hours.className = "meta-item";
        hours.textContent = `Est. Hours: ${task.estimated_hours ?? "?"}`;

        const deps = document.createElement("div");
        deps.className = "meta-item";
        const depCount = (task.dependencies && task.dependencies.length) || 0;
        deps.textContent = `Dependencies: ${depCount}`;

        meta.appendChild(due);
        meta.appendChild(importance);
        meta.appendChild(hours);
        meta.appendChild(deps);

        const explanation = document.createElement("div");
        explanation.className = "task-explanation";
        explanation.textContent = task.explanation || "No explanation provided.";

        card.appendChild(header);
        card.appendChild(meta);
        card.appendChild(explanation);

        container.appendChild(card);
    });
}

async function handleAnalyzeClick() {
    const rawInput = document.getElementById("taskInput").value.trim();
    const strategyValue = document.getElementById("strategySelect").value;

    let tasks = null;

    if (rawInput) {
        // Use JSON textarea input
        try {
            tasks = JSON.parse(rawInput);
        } catch (err) {
            console.error(err);
            alert("Invalid JSON. Please check your format.");
            return;
        }
    } else if (builtTasks.length > 0) {
        // No JSON, but we have form-built tasks
        tasks = builtTasks.slice(); // shallow copy
    } else {
        alert("Please either paste JSON tasks or add at least one task using the form.");
        return;
    }

    // Map UI values to backend strategy keys
    let strategy = "smart_balance";
    if (strategyValue === "quick") strategy = "fastest";
    else if (strategyValue === "impact") strategy = "high_impact";
    else if (strategyValue === "deadline") strategy = "deadline";
    else strategy = "smart_balance";

    setStatus("Analyzing tasks...");

    try {
        const response = await fetch(`${API_BASE}/analyze/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                strategy,
                tasks,
            }),
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        renderResults(data);
        setStatus(`Analyzed ${data.length} task(s) using strategy: ${strategyValue}.`);
    } catch (error) {
        console.error(error);
        alert("Failed to analyze tasks. Check if the Django server is running.");
        setStatus("Error while analyzing tasks.");
    }
}



async function handleSuggestClick() {
    setStatus("Fetching top 3 tasks from DB...");

    try {
        const response = await fetch(`${API_BASE}/suggest/`, {
            method: "GET",
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        renderResults(data.suggestions || []);
        setStatus(data.summary || "Got suggestions from DB.");
    } catch (error) {
        console.error(error);
        alert("Failed to fetch suggestions. Make sure Django server is running and DB has tasks.");
        setStatus("Error while fetching suggestions.");
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("analyzeBtn").addEventListener("click", handleAnalyzeClick);
    document.getElementById("suggestBtn").addEventListener("click", handleSuggestClick);

    const addTaskBtn = document.getElementById("addTaskBtn");
    if (addTaskBtn) {
        addTaskBtn.addEventListener("click", addTaskFromForm);
    }

    updateBuiltTasksInfo();
});

