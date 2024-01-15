const fs = require('fs'), path = require('path'),
    Tag = require("./modules/Tag"),
    MouseMenu = require('./modules/MouseMenu'),

    OverviewSection = require('./modules/OverviewSection'),
    LearningSection = require('./modules/LearningSection'),
    ExercicesSection = require('./modules/ExercicesSection'),
    NotesSection = require('./modules/NotesSection'),
    PostitSection = require('./modules/PostitSection'),
    VideoPlayer = require('./modules/VideoPlayer'),
    Parameters = require('./modules/Parameters');

// Provide global objects and variable
var ROOT_FOLDER = Parameters.init();

var CURRENT_CONTEXT = null,
    CURRENT_CONTEXT_IS_FILE,
    MOUSE_MENU = new MouseMenu(),
    VIDEO_PLAYER = new VideoPlayer();

// Provide global functions
var generateID = function () {
    let firstPart = (Math.random() * 46656) | 0,
        secondPart = (Math.random() * 46656) | 0;

    firstPart = ("000" + firstPart.toString(36)).slice(-3);
    secondPart = ("000" + secondPart.toString(36)).slice(-3);

    return firstPart + secondPart;
}

var getUniqueFolderName = function (parentPath) {
    let isUnique = false,
        uid;

    while (isUnique === false) {
        uid = generateID();

        isUnique = !fs.existsSync(path.join(parentPath, uid));
    }

    return uid;
}

let contextChangeCallbacks = [];
var onContextChange = function (callback) {
    contextChangeCallbacks.push(callback);
}

var contextHasChanged = function (newContext, context_is_file) {
    CURRENT_CONTEXT = newContext;
    CURRENT_CONTEXT_IS_FILE = context_is_file ? true : false;

    contextChangeCallbacks.forEach(callback => { callback(); });
}

var ESCAPE_HTML = function (html) {
    let escape = document.createElement('div');
    escape.innerHTML = html;
    return escape.innerText;
}

var RENAME = function (target, selectBeforeLastDot, onRenamed) {
    let oldName = target.innerHTML;

    target.setAttribute("contenteditable", true);
    target.innerText = oldName;
    target.focus();

    let selection = window.getSelection(),
        range = document.createRange(),
        randeEndIdx = target.firstChild.length;

    if (selectBeforeLastDot) randeEndIdx -= path.extname(oldName).length

    selection.removeAllRanges();
    range.setStart(target.firstChild, 0);
    range.setEnd(target.firstChild, randeEndIdx);
    selection.addRange(range);

    let exec_callback = async () => {

        if (onRenamed && target.innerHTML !== oldName) {

            onRenamed(oldName, target.innerHTML)

                .then(() => {
                    target.innerHTML = target.innerText;

                    end_rename_mod();
                })

                .catch(error => {
                    alert(error);
                    console.error(error);

                    target.innerHTML = oldName;

                    target.focus();

                    selection.removeAllRanges();
                    range.setStart(target.firstChild, 0);
                    range.setEnd(target.firstChild, randeEndIdx);
                    selection.addRange(range);
                });
        }
        else end_rename_mod();
    }

    let end_rename_mod = () => {
        document.body.removeEventListener("click", on_stoping_event, true);
        document.body.removeEventListener("contextmenu", on_stoping_event, true);
        document.body.removeEventListener("keydown", on_stoping_event, true);

        target.removeAttribute("contenteditable");

        range.collapse();
    }

    let on_stoping_event = function (event) {

        if (event.type === 'keydown') {
            event.stopImmediatePropagation();

            if (event.key === 'Enter') {
                event.preventDefault();
                exec_callback();
            }
            else if (event.key === 'Escape') { target.innerHTML = oldName; end_rename_mod(); }
        }
        else if (event.type !== 'keydown') {
            event.stopImmediatePropagation();

            if (event.target != target) {
                event.preventDefault();
                exec_callback();
            }
        }
    }

    document.body.addEventListener("click", on_stoping_event, true);
    document.body.addEventListener("contextmenu", on_stoping_event, true);
    document.body.addEventListener("keydown", on_stoping_event, true);
}

// Show dev tools window
if (process.versions["nw-flavor"] === "sdk") nw.Window.get().showDevTools();

var parseCmdLine = function (cmdLine) { return cmdLine.match(/"[^"]+\.lvn"|[^ ]+\.lvn/g); };

// Handle file opening ----
var openLvnFile = function (filePath) {

    // Remove trailling "
    filePath = filePath.replace(/^"|"$/g, "");

    // Detect file type
    var extention = path.extname(filePath);

    try {
        if (extention === ".lvn") {
            var tmpData = fs.readFileSync(filePath, 'utf8');
            fileData = JSON.parse(tmpData);
            console.log("File opened", fileData);
        }
        else {
            alert("Impossible d'ouvrir le fichier\r" + filePath + "\rType de fichier inconnue.")
        }

    } catch (err) {
        console.error(err);
        alert("Erreur lors de la lecture du fichier\r" + filePath);
    }
};

// Intercept external link opening (click on exercices, notes links in description (url, local files))
nw.Window.get().on('new-win-policy', function (frame, url, policy) {
    // do not open the window
    policy.ignore();

    if (url.startsWith("chrome-extension://")) {
        var filePath,
            argsArray = [];

        url = decodeURI(url.replace(/^chrome-extension:\/\/[^\/]+\//, ''));

        var matched;
        if (matched = url.match(/("?.+?"?)\s?(\d{0,2}:?\d{0,2}:?\d{1,2})$/i)) {
            console.log(matched);
            filePath = matched[1].replace(/"/g, '');

            var time = matched[2];

            var p = time.split(':'),
                sec = 0, m = 1;

            while (p.length > 0) {
                sec += m * parseInt(p.pop(), 10);
                m *= 60;
            }

            argsArray.push("--start-time=" + sec);
        }
        else {
            filePath = url.replace(/"/g, '');
        }

        argsArray.push(path.normalize(filePath));

        require('child_process').execFile(path.normalize("C:/Program Files/VideoLAN/VLC/vlc.exe"), argsArray, (error, stdout, stderr) => {
            if (error) {
                throw error;
            }
            console.log(stdout);
        });
    }
    else nw.Shell.openExternal(url);
});

// Listen to `open` event
nw.App.on('open', cmdLine => {
    var pathes = parseCmdLine(cmdLine[0]);

    pathes.forEach(openLvnFile);
});

// Handle args passed on 1st opening
nw.App.argv.forEach(arg => {
    if (!arg.match(/^--/)) openLvnFile(arg);
});

// HTML Elements
var SectionSelector = document.getElementById("sectionSelector"),
    TagEditor = document.getElementById("tagEditor");

// Sections instanciation
var overviewSection = new OverviewSection("datas/overview.json");
document.body.appendChild(overviewSection.toElement());

var learningSection = new LearningSection("Artists", "datas/tags.learning.json");
document.body.appendChild(learningSection.toElement());

var postitSection = new PostitSection("Artists", "datas/tags.postits.json");
document.body.appendChild(postitSection.toElement());

var exercicesSection = new ExercicesSection("Exercices", "datas/tags.exos.json");
document.body.appendChild(exercicesSection.toElement());

var notesSection = new NotesSection("Notes", "datas/tags.notes.json");
document.body.appendChild(notesSection.toElement());

// Default section
// overviewSection.display();
learningSection.display();
// notesSection.display();

postitSection.display(); // TMP

// #### User interactions #######################
// Section selector
var targetElem;
SectionSelector.addEventListener("click", event => {
    if (targetElem = event.target.closest(".tab")) {
        if (targetElem.classList.contains("overview")) overviewSection.display();
        else if (targetElem.classList.contains("learning")) learningSection.display();
        else if (targetElem.classList.contains("exercices")) exercicesSection.display();
        else if (targetElem.classList.contains("notes")) notesSection.display();
    }
});

// Tag editor
TagEditor.addEventListener("click", event => {

    // Save button
    if (targetElem = event.target.closest("input[value='Save']")) {
        var newBgColor = TagEditor.querySelector(".bgColor input:checked+span+input") && TagEditor.querySelector(".bgColor input+span+input").value,
            newTxtColor = TagEditor.querySelector(".txtColor input:checked+span+input") && TagEditor.querySelector(".txtColor input+span+input").value;

        TagEditor.currentTagsContainer.querySelectorAll(".tag[data-id='" + TagEditor.targetTag.datas.id + "']").forEach(tagElem => {
            tagElem.style.backgroundColor = newBgColor || TagEditor.targetTag.datas.inheritedBgColor || null;
            tagElem.style.color = newTxtColor || TagEditor.targetTag.datas.inheritedTxtColor || null;
        });

        if (newBgColor === null) delete TagEditor.targetTag.datas.bgColor;
        else TagEditor.targetTag.datas.bgColor = newBgColor;

        if (newTxtColor === null) delete TagEditor.targetTag.datas.txtColor;
        else TagEditor.targetTag.datas.txtColor = newTxtColor;

        TagEditor.classList.remove("displayed");

        Tag.saveTagsDatas(TagEditor.currentTagsFilePath, TagEditor.currentTagsContainer.querySelectorAll('.tagGroupContainer'));
    }
    // Cancel button
    else if (targetElem = event.target.closest("input[value='Cancel']")) {
        TagEditor.classList.remove("displayed");
    }
});