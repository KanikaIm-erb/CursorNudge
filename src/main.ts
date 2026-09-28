import { invoke } from "@tauri-apps/api/core";
import "./styles.css";

/* =========================================================
   TYPES
========================================================= */

type MovementMode = "subtle" | "horizontal" | "vertical" | "corners";

type RunMode = "duration" | "schedule";

/* =========================================================
   STATE
========================================================= */

let intervalSeconds = 30;

let durationSeconds = 30 * 60;

let movementMode: MovementMode = "subtle";

let runMode: RunMode = "duration";

let remainingSeconds = durationSeconds;

let countdownTimer: number | undefined;

let movementCountdownTimer: number | undefined;

let nextMovementSeconds = 30;

let isRunning = false;

/* =========================================================
   APP HTML
========================================================= */

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `

  <div class="app">

    <!-- ================= HEADER ================= -->

    <header class="header">

      <div class="brand">

        <div class="brand-icon">
          ↖
        </div>

        <span>
          CursorNudge
        </span>

      </div>


      <div class="status">

        <span
          id="status-dot"
          class="status-dot"
        ></span>

        <span id="status-text">
          Ready
        </span>

      </div>

    </header>


    <!-- ================= MAIN ================= -->

    <main class="main-content">


      <!-- ================= TIMER ================= -->

      <section class="timer-section">

        <div
          id="timer-ring"
          class="timer-ring"
          style="--progress: 0deg;"
        >

          <div class="timer-inner">

            <div
              id="mouse-icon"
              class="mouse-icon"
            >
              ↖
            </div>

            <div
              id="countdown"
              class="countdown"
            >
              30:00
            </div>

            <div class="seconds-label">
              remaining
            </div>

          </div>

        </div>


        <div
          id="next-movement"
          class="next-movement"
        >
          Next movement in 30s
        </div>

      </section>


      <!-- ================= SETTINGS ================= -->

      <section class="settings">


        <!-- ================= INTERVAL ================= -->

        <div class="setting">

          <div class="setting-text">

            <div class="setting-title">
              Move cursor every
            </div>

            <div class="setting-description">
              How often the cursor should move
            </div>

          </div>


          <div class="setting-control">

            <div class="input-group">

              <input
                id="interval-value"
                class="number-input"
                type="number"
                min="5"
                value="30"
              />

              <select
                id="interval-unit"
              >

                <option value="seconds" selected>
                  seconds
                </option>

                <option value="minutes">
                  minutes
                </option>

              </select>

            </div>

          </div>

        </div>


        <!-- ================= DURATION ================= -->

        <div class="setting setting-column-mobile">

          <div class="setting-text">

            <div class="setting-title">
              Run for
            </div>

            <div class="setting-description">
              How long CursorNudge should run
            </div>

          </div>


          <div class="setting-control">

            <select
              id="duration-mode"
              class="wide-select"
            >

              <option value="duration" selected>
                Duration
              </option>

              <option value="schedule">
                Custom...
              </option>

            </select>


            <!-- NORMAL DURATION -->

            <div
              id="duration-controls"
              class="input-group"
            >

              <input
                id="duration-value"
                class="number-input"
                type="number"
                min="1"
                value="30"
              />

              <select
                id="duration-unit"
              >

                <option value="seconds">
                  seconds
                </option>

                <option value="minutes" selected>
                  minutes
                </option>

                <option value="hours">
                  hours
                </option>

              </select>

            </div>


            <!-- CUSTOM / CALENDAR -->

            <div
              id="schedule-controls"
              class="schedule-controls hidden"
            >

              <div class="schedule-row">

                <label>
                  Starts
                </label>

                <div class="date-time-group">

                  <input
                    id="start-date"
                    type="date"
                  />

                  <input
                    id="start-time"
                    type="time"
                  />

                </div>

              </div>


              <div class="schedule-row">

                <label>
                  Ends
                </label>

                <div class="date-time-group">

                  <input
                    id="end-date"
                    type="date"
                  />

                  <input
                    id="end-time"
                    type="time"
                  />

                </div>

              </div>

            </div>

          </div>

        </div>


        <!-- ================= MOVEMENT ================= -->

        <div class="setting">

          <div class="setting-text">

            <div class="setting-title">
              Movement style
            </div>

            <div class="setting-description">
              How the cursor moves around the screen
            </div>

          </div>


          <div class="setting-control">

            <select
              id="movement-mode"
              class="wide-select"
            >

              <option value="subtle" selected>
                Subtle
              </option>

              <option value="horizontal">
                Horizontal sweep
              </option>

              <option value="vertical">
                Vertical sweep
              </option>

              <option value="corners">
                Around corners
              </option>

            </select>

          </div>

        </div>


      </section>


      <!-- ================= BUTTON ================= -->

      <button
        id="start-stop"
        class="main-button"
      >
        Start
      </button>


      <div
        id="info"
        class="info"
      >
       
      </div>


    </main>


    <!-- ================= FOOTER ================= -->

    <footer>
      CursorNudge
    </footer>

  </div>

`;

/* =========================================================
   ELEMENTS
========================================================= */

const intervalValue =
  document.querySelector<HTMLInputElement>("#interval-value")!;

const intervalUnit =
  document.querySelector<HTMLSelectElement>("#interval-unit")!;

const durationMode =
  document.querySelector<HTMLSelectElement>("#duration-mode")!;

const durationControls =
  document.querySelector<HTMLDivElement>("#duration-controls")!;

const durationValue =
  document.querySelector<HTMLInputElement>("#duration-value")!;

const durationUnit =
  document.querySelector<HTMLSelectElement>("#duration-unit")!;

const scheduleControls =
  document.querySelector<HTMLDivElement>("#schedule-controls")!;

const startDate = document.querySelector<HTMLInputElement>("#start-date")!;

const startTime = document.querySelector<HTMLInputElement>("#start-time")!;

const endDate = document.querySelector<HTMLInputElement>("#end-date")!;

const endTime = document.querySelector<HTMLInputElement>("#end-time")!;

const movementModeSelect =
  document.querySelector<HTMLSelectElement>("#movement-mode")!;

const button = document.querySelector<HTMLButtonElement>("#start-stop")!;

const countdown = document.querySelector<HTMLDivElement>("#countdown")!;

const statusText = document.querySelector<HTMLSpanElement>("#status-text")!;

const statusDot = document.querySelector<HTMLSpanElement>("#status-dot")!;

const nextMovement = document.querySelector<HTMLDivElement>("#next-movement")!;

const timerRing = document.querySelector<HTMLDivElement>("#timer-ring")!;

const mouseIcon = document.querySelector<HTMLDivElement>("#mouse-icon")!;

const info = document.querySelector<HTMLDivElement>("#info")!;

/* =========================================================
   DATE HELPERS
========================================================= */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateInput(date: Date): string {
  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}`
  );
}

function formatTimeInput(date: Date): string {
  return `${pad(date.getHours())}:` + `${pad(date.getMinutes())}`;
}

/* =========================================================
   DEFAULT SCHEDULE
========================================================= */

function setDefaultSchedule() {
  const now = new Date();

  const start = new Date(now.getTime() + 60 * 1000);

  const end = new Date(start.getTime() + 60 * 60 * 1000);

  startDate.value = formatDateInput(start);

  startTime.value = formatTimeInput(start);

  endDate.value = formatDateInput(end);

  endTime.value = formatTimeInput(end);
}

setDefaultSchedule();

/* =========================================================
   DURATION MODE
========================================================= */

durationMode.addEventListener("change", () => {
  runMode = durationMode.value as RunMode;

  if (runMode === "schedule") {
    durationControls.classList.add("hidden");

    scheduleControls.classList.remove("hidden");
  } else {
    durationControls.classList.remove("hidden");

    scheduleControls.classList.add("hidden");
  }
});

/* =========================================================
   INTERVAL
========================================================= */

function getIntervalSeconds(): number {
  const value = Number(intervalValue.value);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Please enter a valid cursor interval.");
  }

  let seconds: number;

  if (intervalUnit.value === "minutes") {
    seconds = Math.round(value * 60);
  } else {
    seconds = Math.round(value);
  }

  if (seconds < 5) {
    throw new Error("Cursor movement interval cannot be less than 5 seconds.");
  }

  return seconds;
}

/* =========================================================
   DURATION
========================================================= */

function getDurationSeconds(): number {
  const value = Number(durationValue.value);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Please enter a valid duration.");
  }

  switch (durationUnit.value) {
    case "hours":
      return Math.round(value * 3600);

    case "minutes":
      return Math.round(value * 60);

    default:
      return Math.round(value);
  }
}

/* =========================================================
   SCHEDULE
========================================================= */

function getScheduleTimestamps(): {
  startAtMs: number;
  endAtMs: number;
} {
  if (
    !startDate.value ||
    !startTime.value ||
    !endDate.value ||
    !endTime.value
  ) {
    throw new Error("Please choose both a start and end time.");
  }

  const start = new Date(`${startDate.value}T${startTime.value}`);

  const end = new Date(`${endDate.value}T${endTime.value}`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Please choose valid dates and times.");
  }

  if (end.getTime() <= start.getTime()) {
    throw new Error("The end time must be after the start time.");
  }

  if (end.getTime() <= Date.now()) {
    throw new Error("The selected end time has already passed.");
  }

  return {
    startAtMs: start.getTime(),
    endAtMs: end.getTime(),
  };
}

/* =========================================================
   FORMAT TIME
========================================================= */

function formatTime(seconds: number): string {
  if (seconds <= 0) {
    return "00:00";
  }

  const hours = Math.floor(seconds / 3600);

  const minutes = Math.floor((seconds % 3600) / 60);

  const secs = seconds % 60;

  if (hours > 0) {
    return (
      `${String(hours).padStart(2, "0")}:` +
      `${String(minutes).padStart(2, "0")}:` +
      `${String(secs).padStart(2, "0")}`
    );
  }

  return (
    `${String(minutes).padStart(2, "0")}:` + `${String(secs).padStart(2, "0")}`
  );
}

/* =========================================================
   UPDATE TIMER
========================================================= */

function updateTimer() {
  countdown.textContent = formatTime(remainingSeconds);

  if (durationSeconds > 0) {
    const percentage = Math.max(
      0,
      Math.min(1, remainingSeconds / durationSeconds),
    );

    const degrees = percentage * 360;

    timerRing.style.setProperty("--progress", `${degrees}deg`);
  }

  updateNextMovement();
}

/* =========================================================
   NEXT MOVEMENT
========================================================= */

function updateNextMovement() {
  if (!isRunning) {
    nextMovement.textContent = "Ready to start";

    return;
  }

  if (nextMovementSeconds <= 0) {
    nextMovement.textContent = "Moving cursor...";

    return;
  }

  if (nextMovementSeconds < 60) {
    nextMovement.textContent = `Next movement in ${nextMovementSeconds}s`;

    return;
  }

  const minutes = Math.floor(nextMovementSeconds / 60);

  const seconds = nextMovementSeconds % 60;

  if (seconds === 0) {
    nextMovement.textContent = `Next movement in ${minutes}m`;
  } else {
    nextMovement.textContent = `Next movement in ${minutes}m ${seconds}s`;
  }
}

/* =========================================================
   COUNTDOWN
========================================================= */

function startCountdown() {
  clearInterval(countdownTimer);

  clearInterval(movementCountdownTimer);

  countdownTimer = window.setInterval(() => {
    if (durationSeconds > 0 && remainingSeconds > 0) {
      remainingSeconds--;

      updateTimer();
    }
  }, 1000);

  movementCountdownTimer = window.setInterval(() => {
    if (nextMovementSeconds > 0) {
      nextMovementSeconds--;
    }

    updateNextMovement();
  }, 1000);
}

/* =========================================================
   STOP COUNTDOWN
========================================================= */

function stopCountdown() {
  clearInterval(countdownTimer);

  clearInterval(movementCountdownTimer);
}

/* =========================================================
   DISABLE SETTINGS
========================================================= */

function disableSettings(disabled: boolean) {
  intervalValue.disabled = disabled;

  intervalUnit.disabled = disabled;

  durationMode.disabled = disabled;

  durationValue.disabled = disabled;

  durationUnit.disabled = disabled;

  startDate.disabled = disabled;

  startTime.disabled = disabled;

  endDate.disabled = disabled;

  endTime.disabled = disabled;

  movementModeSelect.disabled = disabled;
}

/* =========================================================
   RUNNING UI
========================================================= */

function setRunningUI(running: boolean) {
  isRunning = running;

  if (running) {
    statusText.textContent = "Running";

    statusDot.classList.add("running");

    button.textContent = "Stop";

    button.classList.add("stop");

    info.textContent = "CursorNudge is keeping your Mac awake.";

    mouseIcon.style.transform = "translateY(-2px)";
  } else {
    statusText.textContent = "Ready";

    statusDot.classList.remove("running");

    button.textContent = "Start";

    button.classList.remove("stop");

    info.textContent =
      "Your laptop will stay awake while CursorNudge is running.";

    mouseIcon.style.transform = "translateY(0)";
  }
}

/* =========================================================
   START ACTIVITY
========================================================= */

async function startActivity() {
  try {
    intervalSeconds = getIntervalSeconds();

    movementMode = movementModeSelect.value as MovementMode;

    let startAtMs: number | null = null;

    let endAtMs: number | null = null;

    if (runMode === "duration") {
      durationSeconds = getDurationSeconds();

      remainingSeconds = durationSeconds;
    } else {
      const schedule = getScheduleTimestamps();

      startAtMs = schedule.startAtMs;

      endAtMs = schedule.endAtMs;

      const now = Date.now();

      remainingSeconds = Math.ceil((endAtMs - Math.max(now, startAtMs)) / 1000);

      durationSeconds = Math.max(1, Math.ceil((endAtMs - startAtMs) / 1000));
    }

    await invoke("start_activity", {
      intervalSeconds,
      durationSeconds,
      movementMode,
      startAtMs,
      endAtMs,
    });

    setRunningUI(true);

    disableSettings(true);

    nextMovementSeconds = intervalSeconds;

    updateTimer();

    startCountdown();

    if (startAtMs !== null && startAtMs > Date.now()) {
      statusText.textContent = "Scheduled";

      statusDot.classList.remove("running");

      info.textContent = "CursorNudge is waiting for the scheduled start time.";

      nextMovement.textContent = `Starts at ${new Date(
        startAtMs,
      ).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      })}`;
    }
  } catch (error) {
    console.error(error);

    statusText.textContent = "Error";

    statusDot.classList.remove("running");

    nextMovement.textContent = String(error);
  }
}

/* =========================================================
   STOP ACTIVITY
========================================================= */

async function stopActivity() {
  try {
    await invoke("stop_activity");

    stopCountdown();

    setRunningUI(false);

    disableSettings(false);

    if (runMode === "duration") {
      durationSeconds = getDurationSeconds();

      remainingSeconds = durationSeconds;
    }

    nextMovementSeconds = intervalSeconds;

    updateTimer();

    nextMovement.textContent = "Ready to start";
  } catch (error) {
    console.error(error);

    statusText.textContent = "Error";

    nextMovement.textContent = String(error);
  }
}

/* =========================================================
   BUTTON
========================================================= */

button.addEventListener("click", async () => {
  if (isRunning) {
    await stopActivity();
  } else {
    await startActivity();
  }
});

/* =========================================================
   MOVEMENT MODE
========================================================= */

movementModeSelect.addEventListener("change", () => {
  movementMode = movementModeSelect.value as MovementMode;
});

/* =========================================================
   INITIAL STATE
========================================================= */

updateTimer();

setRunningUI(false);
