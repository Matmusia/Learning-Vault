module.exports = class Timer {

    #root_element
    #isStarted = false
    #isRunning = false

    #label
    #duration
    #repetitions

    #currentTime = 0
    #currentRepetitions = 0

    #onUpdateFunc = null

    #intervalId

    #repetitionsDisplayElem
    #timeDisplayElem

    #isMiniature = false
    #parent_window = null
    #miniWindow = null
    #splashWindow = null
    #parentTimer = null

    constructor(label, duration, repetitions, parent_window) {

        // console.log(document);
        this.#label = label || "Nouveau timer";
        this.#duration = duration || 30;
        this.#repetitions = repetitions || 1;

        if (parent_window) {
            this.#parent_window = parent_window;
            this.#isMiniature = true;
        }

        var rootElem = this.#root_element = document.createElement("div");
        this.#root_element.obj = this;

        rootElem.classList.add("timer");

        // Bt delete
        rootElem.innerHTML += "<img class='button' data-action='delete' src='assets/images/trashcan.svg' />";

        // Label
        if (this.#isMiniature) rootElem.innerHTML += "<h1 class='label' style='-webkit-app-region: drag'>" + this.#label + "<img style='-webkit-app-region: no-drag' class='button' data-action='close_window' src='assets/images/cross.svg'/></h1>";
        else rootElem.innerHTML += "<h1 class='label' contentEditable=true>" + this.#label + "</h1>";

        // Sub container
        var settingsContainer = document.createElement("div");
        settingsContainer.classList.add("settingsContainer");
        settingsContainer.innerHTML = "<p></p>";
        rootElem.appendChild(settingsContainer);

        // Duration
        settingsContainer.innerHTML += "<p>Durée <span class='duration' contentEditable=true>" + this.#duration + "</span></p>";

        // Repetitions
        settingsContainer.innerHTML += "<p>Répétitions <span class='repetitions' contentEditable=true>" + this.#repetitions + "</span></p>";

        // Controls when not started
        var controls = document.createElement("div");
        controls.classList.add("controlsNotStarted");
        rootElem.appendChild(controls);

        if (this.#isMiniature) controls.innerHTML += "<img class='button' data-action='start' src='assets/images/play.svg' />";
        else controls.innerHTML += "<img class='button' data-action='miniature' src='assets/images/pip.svg' /><img class='button' data-action='start' src='assets/images/play.svg' />";

        // Controls when started
        controls = document.createElement("div");
        controls.classList.add("controlsStarted");
        rootElem.appendChild(controls);

        controls.innerHTML += "<div class='currentRepetitions'></div>"
            + "<div class='currentTime'></div>"
            + "<div class='timerControls'>"
            + "<img class='button' data-action='stop' src='assets/images/stop.svg' title='Arreter ce timer' />"
            + "<img class='button' data-action='reset' src='assets/images/undo.svg' title='Recommencer cette rép à zéro' />"
            + "<img class='button' data-action='togglePlay' src='assets/images/pause.svg' title='Play / Pause' />"
            + "<img class='button' data-action='nextRep' src='assets/images/next.svg' title='Lancer la prochaine rép' />"
            + "</div";

        this.#repetitionsDisplayElem = rootElem.querySelector(".controlsStarted .currentRepetitions");
        this.#timeDisplayElem = rootElem.querySelector(".controlsStarted .currentTime");

        rootElem.addEventListener("click", event => {
            var target;

            if (target = event.target.closest(".button")) {
                event.preventDefault();
                event.stopPropagation();

                switch (target.dataset.action) {
                    case "delete":
                        rootElem.remove();
                        if (this.#onUpdateFunc !== null) this.#onUpdateFunc();
                        break;

                    case "miniature": this.openTimerInWindow(); break;

                    case "start":
                        this.#duration = this.#stringToSec(rootElem.querySelector(".settingsContainer .duration").innerText);
                        this.#repetitions = parseInt(rootElem.querySelector(".settingsContainer .repetitions").innerText);

                        this.#currentTime = this.#duration;
                        this.#currentRepetitions = this.#repetitions;

                        this.#isStarted = true;

                        this.play();
                        break;

                    case "togglePlay":
                        if (this.#isRunning) this.pause();
                        else {
                            if (this.#parentTimer === null) this.play();
                            else this.#parentTimer.play();
                        }
                        break;

                    case "nextRep":
                        if (this.#parentTimer === null) this.nextRepetition();
                        else this.#parentTimer.nextRepetition();
                        break;

                    case "reset":
                        if (this.#parentTimer === null) this.resetCurrentRep();
                        else this.#parentTimer.resetCurrentRep();
                        break;

                    case "stop":
                        if (this.#parentTimer === null) this.stop();
                        else this.#parentTimer.stop();
                        break;

                    case 'close_window':
                        if (this.#parent_window) this.#parent_window.close();
                        break;

                    default:
                        break;
                }
            }
        });

        var idTimeout;

        rootElem.querySelectorAll("*[contenteditable='true'").forEach(elem => {
            elem.addEventListener("input", event => {
                clearInterval(idTimeout);

                idTimeout = setTimeout(() => {
                    this.#label = this.#root_element.querySelector(".label").innerHTML;
                    this.#duration = this.#root_element.querySelector(".duration").innerHTML;
                    this.#repetitions = this.#root_element.querySelector(".repetitions").innerHTML;
                    if (this.#onUpdateFunc !== null) this.#onUpdateFunc();
                }, 1000);
            });
        });
    }

    #stringToSec(timeString) {
        var p = timeString.split(':'),
            sec = 0, m = 1;

        while (p.length > 0) {
            sec += m * parseInt(p.pop(), 10);
            m *= 60;
        }

        return parseInt(sec);
    }

    #updateTimeText() {
        var timeLeft = new Date(this.#currentTime * 1000).toISOString().slice(11, 19).split(":");

        if (timeLeft[0] != "00")
            this.#timeDisplayElem.innerHTML = timeLeft[0].replace(/^0([0-9])/, '$1') + " Heure et " + timeLeft[1] + " min.";
        else if (timeLeft[1] != "00")
            this.#timeDisplayElem.innerHTML = timeLeft[1].replace(/^0([0-9])/, '$1') + " min. et " + timeLeft[2] + " sec.";
        else if (timeLeft[2] != "00")
            this.#timeDisplayElem.innerHTML = timeLeft[2].replace(/^0([0-9])/, '$1') + " sec.";
        else
            this.#timeDisplayElem.innerHTML = "Fini !";
    }

    #updateRepetitionsText() {
        this.#repetitionsDisplayElem.innerHTML = '<div class="block"><span class="left">' + (this.#repetitions - this.#currentRepetitions + 1) + '</span><span class="middle"><img src="assets/images/slash.svg" /></span><span class="right">' + this.#repetitions + '</span></div>';
    }

    #finDuTimer() {
        clearInterval(this.#intervalId);

        this.#isRunning = false;

        this.#root_element.querySelector(".button[data-action='togglePlay']").classList.add("hide");

        if (this.#currentRepetitions === 1) {
            this.#root_element.querySelector(".button[data-action='nextRep']").classList.add("hide");
        }

        this.#root_element.classList.add("repDone");

        if (this.#isMiniature == false) this.openSplashWindow();
        else {
            this.#parent_window.restore();
            this.#parent_window.focus();
        }
    }

    #onTick() {
        this.#currentTime--;

        this.#updateTimeText();

        if (this.#currentTime === 0) this.#finDuTimer();
    }

    initSplash(currentRepetitions, parentTimer) {
        this.#parentTimer = parentTimer;
        this.#currentRepetitions = currentRepetitions;

        this.#root_element.querySelector(".button[data-action='togglePlay']").classList.add("hide");

        if (this.#currentRepetitions === 1) {
            this.#root_element.querySelector(".button[data-action='nextRep']").classList.add("hide");
        }

        this.#root_element.classList.add("started");
        this.#root_element.classList.add("repDone");

        this.#updateTimeText();
        this.#updateRepetitionsText();
    }

    openSplashWindow() {
        if (this.#splashWindow === null) nw.Window.open("timer.html",
            {
                id: "LV_timer_ring_splash",
                always_on_top: true,
                focus: true,
                frame: false,
                position: "center",
                title: "Learning Vault Timer",
                icon: "assets/icon.png", transparent: true
            },
            newWin => {
                this.#splashWindow = newWin;

                newWin.on('loaded', event => {
                    if (process.versions["nw-flavor"] === "sdk") newWin.showDevTools();

                    let mainContainer = document.createElement("div");
                    mainContainer.classList.add("mainContainer");
                    newWin.window.document.body.appendChild(mainContainer);

                    let timer = new Timer(this.#label, this.#duration, this.#repetitions, newWin);

                    timer.initSplash(this.#currentRepetitions, this);

                    mainContainer.appendChild(timer.toElement());
                });

                newWin.on('close', event => {
                    newWin.close(true);
                    this.#splashWindow = null;
                });
            });

        else (this.#splashWindow.restore());
    }

    openTimerInWindow() {
        if (this.#miniWindow === null) nw.Window.open("timer.html",
            {
                id: "LV_timer_ring",
                always_on_top: true,
                focus: true,
                frame: false,
                title: "Learning Vault Timer",
                icon: "assets/icon.png",
                transparent: true
            },
            newWin => {
                this.#miniWindow = newWin;

                newWin.on('loaded', event => {

                    // if (process.versions["nw-flavor"] === "sdk") newWin.showDevTools();

                    let mainContainer = document.createElement("div");
                    mainContainer.classList.add("mainContainer");
                    newWin.window.document.body.appendChild(mainContainer);
                    mainContainer.appendChild(new Timer(this.#label, this.#duration, this.#repetitions, newWin).toElement());
                });

                newWin.on('close', event => {
                    newWin.close(true);
                    this.#miniWindow = null;
                });
            });

        else (this.#miniWindow.restore());
    }

    play() {
        if (this.#splashWindow) this.#splashWindow.close();

        this.#root_element.classList.add("started");
        this.#root_element.classList.remove("repDone");
        this.#isRunning = true;

        if (this.#currentRepetitions <= 1)
            this.#root_element.querySelector(".button[data-action='nextRep']").classList.add("hide");
        else
            this.#root_element.querySelector(".button[data-action='nextRep']").classList.remove("hide");

        this.#root_element.querySelector(".button[data-action='togglePlay']").classList.remove("hide");
        this.#root_element.querySelector(".button[data-action='togglePlay']").setAttribute("src", "assets/images/pause.svg");

        this.#updateRepetitionsText();
        this.#updateTimeText();

        this.#intervalId = setInterval(this.#onTick.bind(this), 1000);
    }

    pause() {
        this.#isRunning = false;
        clearInterval(this.#intervalId);
        this.#root_element.querySelector(".button[data-action='togglePlay']").setAttribute("src", "assets/images/play.svg");
    }

    resetCurrentRep() {
        if (this.#splashWindow) this.#splashWindow.close();

        this.#root_element.classList.remove("repDone");
        clearInterval(this.#intervalId);

        this.#isRunning = this.#isStarted = false;
        this.#currentTime = this.#duration;

        this.play();
    }

    nextRepetition() {
        if (this.#splashWindow) this.#splashWindow.close();

        clearInterval(this.#intervalId);
        this.#currentRepetitions--;
        this.#currentTime = this.#duration;
        this.play();
    }

    stop() {
        if (this.#splashWindow) this.#splashWindow.close();

        clearInterval(this.#intervalId);

        this.#isRunning = this.#isStarted = false;

        this.#root_element.classList.remove("started");
        this.#root_element.classList.remove("repDone");
    }

    onUpdate(onUpdateFunc) {
        if (typeof (onUpdateFunc) !== 'function') throw new Error("Timer:onUpdate - la variable onUpdate n'est pas une fonction.");
        this.#onUpdateFunc = onUpdateFunc;
    }

    getLabel() { return this.#label; }

    getDuration() { return this.#duration; }

    getRepetitions() { return this.#repetitions; }

    toElement() { return this.#root_element; }
}