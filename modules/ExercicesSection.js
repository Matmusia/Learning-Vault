const fs = require('fs'), path = require('path'), fsp = require('fs/promises'),
    Tag = require('./Tag'),
    Section = require("./Section"),
    ExercicesResult = require("./ExercicesResult"),
    Timer = require("./Timer");

const Notification = require('./Notification');
const Parameters = require('./Parameters');

module.exports = class ExercicesSection extends Section {

    #pending
    #currentlyDisplayedExercice
    #isSaving = false

    constructor(root_path, tagsFilePath) {
        super(root_path, tagsFilePath);

        this._rootElement.classList.add("exercices");
        this._rootElement.innerHTML = this._loadSectionHtmlContent(__dirname + "/ExercicesSection.html");

        this._populateTags();

        // Init text editor
        let editorChangeHandlerId;

        // Init texteditor
        tinymce.init({
            selector: '#exercice-container .description',
            menubar: false,
            inline: true,
            toolbar_persist: true,
            // skin: "oxide-dark",
            // link_context_toolbar: true,
            fixed_toolbar_container: "#exercice-container .tinymce-toolbar-container",
            plugins: 'image lists link autoresize autolink',
            toolbar: [
                'blocks | bold italic underline | forecolor backcolor | alignleft aligncenter alignright alignfull | numlist bullist outdent indent | link image | removeformat'
            ],
            block_formats: 'Paragraph=p; Header 1=h1; Header 2=h2',
            setup: editor => {
                editor.on('Paste Change input Undo Redo', () => {
                    clearTimeout(editorChangeHandlerId);
                    editorChangeHandlerId = setTimeout(() => {
                        this.#currentlyDisplayedExercice.description = editor.getContent();
                        this.#currentlyDisplayedExercice.obj.storeLvDatas();
                    }, 800);
                });

                // Handling of local file drop on exercice (like video file)
                // -> The handling of opening thoses files is done in main.js
                editor.on('drop', event => {
                    for (var i = 0; i < event.dataTransfer.files.length; i++) {

                        if (event.dataTransfer.files[i].type.match(/^image\//) === null) {
                            event.preventDefault();

                            tinymce.activeEditor.selection.setContent('<a href="&quot;' + event.dataTransfer.files[i].path + '&quot;">' + event.dataTransfer.files[i].name + '</a>');
                        }
                    }
                });
            }
        });

        this._registerEventHandlers();

        Parameters.on_root_folder_change(new_folder => {

            if (this._rootElement.classList.contains('displayed')) this.displayResults(this._current_path);
        });
    }

    _registerEventHandlers() {
        var result,
            self = this;

        // Click on TopBar
        this._rootElement.querySelector(".topbar").addEventListener("click", event => {
            var target;

            if (target = event.target.closest(".button")) {
                switch (target.dataset.action) {
                    // Création d'un nouvel exercice
                    case "newExercice":

                        let folderPath = path.join(this._root_path, getUniqueFolderName(this._root_path))

                        fs.mkdir(path.join(ROOT_FOLDER, folderPath), err => {
                            if (err) console.error(err);

                            // Creation du dossier réussie
                            else {
                                var jsonDatas = { "label": "Nouvel exercice", "description": "", "tags": [] };

                                try {
                                    fs.writeFileSync(path.join(ROOT_FOLDER, folderPath, '.lv'), JSON.stringify(jsonDatas));
                                } catch (err) {
                                    // console.error(err);
                                    alert("Problème lors de la sauvegarde du fichier " + path.join(ROOT_FOLDER, folderPath) + '\\.lv');
                                }

                                // Create a resource folder
                                fs.mkdir(path.join(ROOT_FOLDER, folderPath, "resources"), error => {
                                    if (error) console.error(error);
                                    // Creation du dossier réussie -> Update exercices list
                                    else this.displayResults(this._current_path);
                                });
                            }
                        });

                        break;

                    default:
                        console.log("Unknown button click");
                        break;
                }
            }
            else if (this._current_path) require('child_process').exec('start "" "' + path.join(ROOT_FOLDER, this._current_path) + '"')
        });

        // Click on results
        this._rootElement.querySelector(".resultsContainer").addEventListener("click", event => {
            var tagElem, target;

            if (result = event.target.closest(".result")) {
                // Click on tag
                if (tagElem = event.target.closest(".tag")) {
                    result.obj.removeTag(tagElem.dataset.id);
                }
                // Click on button
                else if (target = event.target.closest(".button")) {
                    switch (target.dataset.action) {

                        case "delete":
                            if (confirm("Supprimer l'exercice ?\r" + result.label)) fs.rmdir(path.join(ROOT_FOLDER, result.path), { recursive: true }, (error) => {
                                if (error) console.log(error);
                                else {
                                    // Update tags database
                                    let saveIsRequired = false;

                                    this._rootElement.querySelectorAll(".DB_tags_container .tag").forEach(tagElem => {
                                        if (tagElem.datas.folders) tagElem.datas.folders.forEach((folderPath, idx) => {

                                            if (folderPath && folderPath.includes(result.path)) {
                                                tagElem.datas.folders.splice(idx, 1);
                                                saveIsRequired = true;
                                            }
                                        })
                                    });

                                    if (saveIsRequired) Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));

                                    this.displayResults(this._root_path);
                                }
                            });

                            break;

                        default:
                            console.log("button unknown");
                            break;
                    }
                }
                // Click sur l'icon/checked
                else if (target = event.target.closest(".icon")) {
                    result.checkedTime = new Date().getTime();
                    result.classList.add("checked");
                    result.obj.storeLvDatas();
                }
                else if (target = event.target.closest(".checkedIcon")) {
                    result.classList.remove("checked");
                    result.obj.storeLvDatas();
                    if (result.checkedTime) delete result.checkedTime;
                }
                // Click on anything else => Open exercice -------------------------------------------
                else this.#openExercice(result);
            }
        });

        // Click on exercice container
        this._rootElement.querySelector("#exercice-container").addEventListener("click", event => {
            var target;

            // Click sur un element avec contenteditable
            if (target = event.target.closest("*[contenteditable='true'")) { }
            // Click qur un bouton (close, etc...)
            else if (target = event.target.closest(".button")) {
                switch (target.dataset.action) {
                    // Close currently displayed exercice
                    case "close":
                        this.#currentlyDisplayedExercice = null;
                        this._rootElement.classList.remove("displayExercice");

                        break;

                    // Add a new timer to currently displayed exercice
                    case "add_new_timer":
                        var timer = new Timer();
                        timer.onUpdate(() => { this.#currentlyDisplayedExercice.obj.storeLvDatas(); });
                        this._rootElement.querySelector(".timersContainer").appendChild(timer.toElement());

                        this.#currentlyDisplayedExercice.obj.storeLvDatas();
                        break;

                    default:
                        console.log("Click on unknown button");
                        break;
                }
            }
            // Click sur un tab
            else if (target = event.target.closest(".tab")) {
                if (this.#isSaving === false) {
                    this._rootElement.querySelector(".tab.selected").classList.remove("selected");
                    this._rootElement.querySelector(".tabContent.displayed").classList.remove("displayed");

                    target.classList.add("selected");
                    this._rootElement.querySelector(".tabContent." + target.dataset.target).classList.add("displayed");
                }
            }
            // Click sur un fichier resource
            else if (target = event.target.closest(".filesContainer .file")) {
                nw.Shell.openItem(path.join(ROOT_FOLDER, target.path));
            }
        });

        // Double click on exercice container
        this._rootElement.querySelector("#exercice-container").addEventListener("dblclick", event => {
            let target;

            // Click sur un tab
            if (target = event.target.closest(".tab")) {
                switch (target.dataset.target) {
                    case "view": nw.Shell.openItem(path.join(ROOT_FOLDER, this.#currentlyDisplayedExercice.path)); break;

                    case "resources": nw.Shell.openItem(path.join(ROOT_FOLDER, this.#currentlyDisplayedExercice.path, 'resources')); break;

                    default:
                        break;
                }
            }
        });

        // Type on exercice contenteditable (except description)
        let delayedTriggerIdx;
        this._rootElement.querySelectorAll("*[contenteditable='true'").forEach(elem => {
            elem.addEventListener("input", event2 => {

                this.#isSaving = true;
                clearTimeout(delayedTriggerIdx);

                delayedTriggerIdx = setTimeout(() => {
                    switch (event2.target.dataset.source) {

                        // Change exercice name
                        case "label":
                            this.#currentlyDisplayedExercice.label = this.#currentlyDisplayedExercice.querySelector(".label").innerHTML = event2.target.innerHTML;
                            this.#currentlyDisplayedExercice.obj.storeLvDatas();
                            break;

                        /* case "description":
                            break; */

                        default:
                            break;
                    }

                    this.#isSaving = false;
                }, 1000, this);
            })
        });

        // Right click on results container
        this._rootElement.querySelector(".resultsContainer").addEventListener("contextmenu", event => {
            event.preventDefault();

            // Base items for folder and file contextmenu
            let items = [];

            // Add file specific items for files
            let target;
            if (target = event.target.closest(".result")) {

                items.push(
                    {
                        label: "Ouvrir dans l'explorateur...",
                        icon: "folder3.svg",
                        sep: true,
                        action: item => {
                            nw.Shell.openItem(path.join(ROOT_FOLDER, target.path));
                        }
                    },
                    {
                        label: "Supprimer",
                        icon: "trashcan.svg",
                        action: item => {
                            if (confirm("Supprimer cet exercice ?\r" + target.label)) {

                                fs.rmdir(path.join(ROOT_FOLDER, target.path), { recursive: true }, error => {
                                    if (error) {
                                        console.error(error);
                                        alert("Erreur lors de la supression du dossier\r" + target.label);
                                    }
                                    else {
                                        // Update tags database
                                        let saveIsRequired = false;

                                        this._rootElement.querySelectorAll(".DB_tags_container .tag").forEach(tagElem => {
                                            if (tagElem.datas.folders) tagElem.datas.folders.forEach((folderPath, idx) => {

                                                if (folderPath && folderPath.includes(target.path)) {
                                                    tagElem.datas.folders.splice(idx, 1);
                                                    saveIsRequired = true;
                                                }
                                            })
                                        });

                                        if (saveIsRequired) Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));

                                        target.remove();
                                    }
                                });
                            }
                        }
                    }
                );
            }

            if (items.length > 0) MOUSE_MENU.display(items, event.clientX, event.clientY);
        });

        // Right click on file in resources
        this._rootElement.querySelector(".tabContent.resources .filesContainer").addEventListener("contextmenu", event => {
            var target;
            if (target = event.target.closest(".file")) {
                event.preventDefault();

                var items = [
                    {
                        label: "Renommer...",
                        icon: "rename.svg",
                        action: item => {
                            RENAME(target.querySelector('p'), true, async (oldName, newName) => {

                                newName = ESCAPE_HTML(newName);

                                if (new RegExp("\\?|<|>|\\*|:|/|\\\\|\"|\\|", "i").test(newName)) throw new Error("Le nom [" + newName + "] contient des caractères non compatibles.");

                                // Check if a file with the same name already exist
                                if (fs.existsSync(path.join(ROOT_FOLDER, path.dirname(target.path), newName))) return "Un ficher [" + newName + "] existe déjà.";

                                // Rename File
                                await fsp.rename(path.join(ROOT_FOLDER, target.path), path.join(ROOT_FOLDER, path.dirname(target.path), newName))

                                    .then(() => { target.path = path.join(path.dirname(target.path), newName); })

                                    .catch(error => { throw new Error(error); });
                            });
                        }
                    },
                    {
                        label: "Supprimer",
                        icon: "trashcan.svg",
                        sep: true,
                        action: item => {
                            if (confirm("Supprimer cette resource ?\r" + target.label)) {
                                fs.unlink(path.join(ROOT_FOLDER, target.path), error => {
                                    if (error) alert("Erreur lors de la supression de la resource\r" + target.label);
                                    else target.remove();
                                });
                            }
                        }
                    },
                    {
                        label: "Photoshop : Ouvrir...",
                        icon: "photoshop.svg",
                        action: item => {
                            require("child_process").execFile("python.exe", ["./external/photoshop_open.pyw", path.join(ROOT_FOLDER, target.path)], (error, stdout, stderr) => {
                                if (error) console.log(error);
                                else console.log(stdout);
                            });
                        }
                    },
                    {
                        label: "Photoshop : Ajouter comme layer",
                        icon: "photoshop.svg",
                        action: item => {
                            require("child_process").execFile("python.exe", ["./external/photoshop_addAsLayer.pyw", path.join(ROOT_FOLDER, target.path)], (error, stdout, stderr) => {
                                if (error) console.log(error);
                                else console.log(stdout);
                            });
                        }
                    }
                ];

                MOUSE_MENU.display(items, event.clientX, event.clientY);
            }
        });

        // Drop on section
        this._rootElement.addEventListener("drop", event => {
            event.preventDefault();

            var dragType = event.dataTransfer.getData("dragType");

            if (dragType === "tag") {
                var targetTag,
                    tagsGroupTarget,
                    resultTarget,
                    droppedTag = Tag.draggedTag.toElement();


                // Drop on tags group
                if (tagsGroupTarget = event.target.closest(".tagGroupContainer")) {

                    // Drop on other tag
                    if (targetTag = event.target.closest(".tag")) tagsGroupTarget.insertBefore(droppedTag, targetTag);
                    // Drop on group
                    else tagsGroupTarget.appendChild(droppedTag);

                    if (droppedTag.datas.bgColor === undefined && tagsGroupTarget.dataset.bgColor) droppedTag.style.backgroundColor = droppedTag.datas.inheritedBgColor = tagsGroupTarget.dataset.bgColor;
                    if (droppedTag.datas.txtColor === undefined && tagsGroupTarget.dataset.txtColor) droppedTag.style.color = droppedTag.datas.inheritedTxtColor = tagsGroupTarget.dataset.txtColor;

                    Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));
                }
                // Drop on Result
                else if (resultTarget = event.target.closest(".result")) {
                    var newTagElem = new Tag(droppedTag.datas).toElement(),
                        tagsContainerTarget = resultTarget.querySelector(".directoryTagsContainer");

                    // Check if tag is already present in result
                    var sameTag = tagsContainerTarget.querySelector(".tag[data-id='" + droppedTag.dataset.id + "']");

                    // Drop on other tag
                    if (targetTag = event.target.closest(".tag")) {
                        if (sameTag) tagsContainerTarget.insertBefore(sameTag, targetTag);
                        else tagsContainerTarget.insertBefore(newTagElem, targetTag);
                    }
                    // Drop on group
                    else {
                        if (sameTag) tagsContainerTarget.appendChild(sameTag);
                        else tagsContainerTarget.appendChild(newTagElem);
                    }

                    resultTarget.obj.storeLvDatas();

                    // A new tag is added
                    if (sameTag === null) {
                        // Add result path to tag's folders list
                        var ogTAg = this.getChildElem(".DB_tags_container .tag[data-id='" + droppedTag.dataset.id + "']");
                        if (ogTAg.datas.folders === undefined) ogTAg.datas.folders = [];
                        ogTAg.datas.folders.push(resultTarget.path);

                        Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));
                    }
                }
            }
            else if (this.#currentlyDisplayedExercice && this._rootElement.querySelector(".tabContent.resources.displayed") && event.dataTransfer.files.length > 0) {

                // Prevent saving if drop on content editalbe element
                if (event.target.closest("*[contenteditable='true'")) return;

                for (var i = 0; i < event.dataTransfer.files.length; i++) {
                    this.#writeFile(event.dataTransfer.files[i], event.dataTransfer.files[i].name, true);
                }
            }
        });

        // Handle image pasting
        document.addEventListener("paste", event => {
            // Prevent saving if drop on content editalbe element
            if (document.activeElement && document.activeElement.closest("*[contenteditable='true'")) return;

            // Prevent pasting when not in resources tab
            if (this._rootElement.querySelector(".tab.selected[data-target='resources']") === null) return;

            if (this.#currentlyDisplayedExercice) {

                var items = (event.clipboardData || event.originalEvent.clipboardData).items;

                for (var index in items) {

                    var item = items[index];

                    // Un fichier est collé
                    if (item.kind === 'file') {
                        var ext = item.type.replace(/^[^\/]+\//i, '');
                        var filename = "NouveauFichier." + ext;

                        if (item.type.startsWith("image/")) {
                            this.#writeFile(item.getAsFile(), filename, true);
                        }
                        else alert("Le fichier collé n'est pas une image")
                    }
                    // Un URL est collée
                    else if (item.kind === 'string') {
                        item.getAsString(string => {
                            if (string.match(/^https?:/i)) {
                                fs.writeFile(path.join(ROOT_FOLDER, this.#currentlyDisplayedExercice.path, "resources", "Nouveau Site.url"), "[{000214A0-0000-0000-C000-000000000046}]\nProp3=19,11\n[InternetShortcut]\nIDList=\nURL=" + string + "\n", (err) => {
                                    if (err) console.log(err);
                                    else this.#updateExerciceResourceFiles();
                                });
                            }
                        });
                    }
                }
            }
        });

        super._registerEventHandlers();
    }

    #updateExerciceResourceFiles() {
        document.body.classList.add("loading");

        var filesContainer = this._rootElement.querySelector(".tabContent .filesContainer");
        filesContainer.innerHTML = "";

        fs.readdir(path.join(ROOT_FOLDER, this.#currentlyDisplayedExercice.path, "resources"), { withFileTypes: true }, (error, files) => {
            if (error) {
                console.log(error);
                document.body.classList.remove("loading");
            }
            else {
                files.forEach(dirent => {
                    if (dirent.isFile()) {
                        var fileElem = document.createElement('div');
                        fileElem.classList.add("file");
                        fileElem.title = dirent.name;
                        fileElem.innerHTML = "<p>" + dirent.name + "</p>";
                        fileElem.label = dirent.name;
                        fileElem.path = path.join(this.#currentlyDisplayedExercice.path, "resources", dirent.name);

                        var iconPath;

                        switch (path.extname(dirent.name).toLowerCase()) {
                            case ".jpg":
                            case ".jpeg":
                            case ".png":
                            case ".svg":
                            case ".gif":
                            case ".bmp":
                                iconPath = path.join(ROOT_FOLDER, fileElem.path) + '?' + (new Date()).getTime();
                                break;

                            case ".psd":
                                iconPath = "./assets/images/psd.svg";
                                break;

                            case ".pdf":
                                iconPath = "./assets/images/pdf.svg";
                                break;

                            case ".txt":
                            case ".doc":
                            case ".docx":
                                iconPath = "./assets/images/text.svg";
                                break;

                            case ".url":
                                iconPath = "./assets/images/url.svg";
                                break;

                            default:
                                iconPath = "assets/images/unknown.svg";
                                break;
                        }

                        var icon = document.createElement("img");
                        icon.setAttribute("src", iconPath);

                        fileElem.prepend(icon);

                        filesContainer.appendChild(fileElem);
                    }
                });

                document.body.classList.remove("loading");
            }
        });
    }

    #openExercice(result) {
        this.#currentlyDisplayedExercice = result;

        this._rootElement.querySelector(".exerciceTopbar .left").innerHTML = result.label;
        this._rootElement.querySelector(".description").innerHTML = result.description;

        this.#updateExerciceResourceFiles();

        // Display timers
        this._rootElement.querySelector(".timersContainer").innerHTML = "";

        var timer;
        result.timers.forEach(timerDatas => {
            timer = new Timer(timerDatas.label, timerDatas.duration, timerDatas.repetitions);
            timer.onUpdate(() => { result.obj.storeLvDatas(); });
            this._rootElement.querySelector(".timersContainer").appendChild(timer.toElement());
        });

        this._rootElement.classList.add("displayExercice");

        this._rootElement.querySelector(".tabsSelector .tab").click();
    }

    #writeFile(fileBlob, fileName, alterNameToSave) {
        var reader = new FileReader();
        reader.addEventListener("load", event => {
            var filePath = path.join(this.#currentlyDisplayedExercice.path, "resources", fileName);

            var data = event.target.result.replace(/^data:[^\/]+\/[^\/]+;base64,/, "");
            var buf = Buffer.from(data, 'base64');

            try {
                if (fs.existsSync(path.join(ROOT_FOLDER, filePath))) {
                    if (alterNameToSave) {
                        var ext = path.extname(fileName);
                        fileName = fileName.replace(/\..{2,4}$/i, '');

                        for (var i = 2; i < 1000; i++) {
                            filePath = path.join(this.#currentlyDisplayedExercice.path, "resources", fileName + i + ext);

                            if (!fs.existsSync(path.join(ROOT_FOLDER, filePath))) {
                                i = 10000;

                                fs.writeFile(path.join(ROOT_FOLDER, filePath), buf, (err) => {
                                    if (err) console.log(err);
                                    else this.#updateExerciceResourceFiles();
                                });
                            }
                        }
                    }
                    else alert("Un fichier du même nom existe déjà dans les resources");
                }
                else {
                    fs.writeFile(path.join(ROOT_FOLDER, filePath), buf, (err) => {
                        if (err) console.log(err);
                        else this.#updateExerciceResourceFiles();
                    });
                }
            } catch (err) {
                console.error(err)
            }
        });
        reader.readAsDataURL(fileBlob);
    }

    #indexDirectory(pathToExplore, newIndexedDatas, onComplete) {
        var dirPath, lvDatas;

        this.#pending++;

        fs.readdir(pathToExplore, { withFileTypes: true }, (err, filesList) => {
            this.#pending--;
            if (err) return alert("Une erreur est survenue lors de l'indexation.\r" + err);

            filesList.forEach(file => {
                // Stop if the filename start with a dot
                if (file.name[0] === ".") return;
                //If not, start analizing if it's a directory
                else if (file.isDirectory()) {
                    dirPath = pathToExplore + "\\" + file.name;
                    lvDatas = ExercicesResult.getLvDatas(dirPath);

                    // Presence de données .lv dans le dossier
                    if (lvDatas) lvDatas.tags.forEach(tagId => {
                        if (newIndexedDatas[tagId] === undefined) newIndexedDatas[tagId] = [];

                        newIndexedDatas[tagId].push(path.relative(ROOT_FOLDER, dirPath));
                    });

                    this.#indexDirectory(dirPath, newIndexedDatas, onComplete);
                }
            });

            if (this.#pending === 0 && onComplete) onComplete();
        });
    }

    _update_folder_indexation() {
        var self = this;
        var newIndexedDatas = [],
            onComplete = function () {
                // Clear actual tag / path association & store new assosiations if necesary
                self.getChildrenElem(".DB_tags_container .tag").forEach(tagElem => {
                    delete tagElem.datas.folders;
                    if (newIndexedDatas[tagElem.datas.id] !== undefined) tagElem.datas.folders = newIndexedDatas[tagElem.datas.id];
                });

                Tag.saveTagsDatas(self.tagsFilePath, self._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));

                document.body.classList.remove("loading");
            };

        document.body.classList.add("loading");

        this.#pending = 0;
        this.#indexDirectory(path.join(ROOT_FOLDER, this._root_path), newIndexedDatas, onComplete);
    }

    displayResults(pathToExplore, goingBack, stopTagSearch) {

        var resultsContainer = this._rootElement.querySelector(".resultsContainer");

        if (!goingBack) this._scrollPos.push(resultsContainer.scrollTop);

        this._current_path = path.normalize(pathToExplore);

        this._rootElement.querySelector(".topbar .path").innerHTML = "Exercices<span class='separateur'>></span>" + path.relative(this._root_path, pathToExplore).split("\\").join("<span class='separateur'>></span>");
        resultsContainer.innerHTML = "<p class='loading_indicator'>Chargement ...</p>";

        if (stopTagSearch) this._rootElement.classList.remove("tagSearchInProgress");
        this._rootElement.classList.remove("searchResultsAreDisplayed");

        fsp.readdir(path.join(ROOT_FOLDER, pathToExplore), { withFileTypes: true })
            .then(files => {

                resultsContainer.innerHTML = "";

                // Sort folder's content to put directories first
                files.sort((a, b) => {
                    if (a.isDirectory() && !b.isDirectory()) return -1;
                    else if (!a.isDirectory() && b.isDirectory()) return 1;
                    else return a.name.localeCompare(b.name);
                });

                var resultElem;

                // Add parent directory button
                if (pathToExplore !== this._root_path) {
                    // resultElem = this._getNewResultElem("..", true, path.dirname(pathToExplore));
                    resultElem = new ExercicesResult("..", true, path.dirname(pathToExplore), this).toElement();
                    resultsContainer.appendChild(resultElem);
                }

                // Process path content and create result elements
                files.forEach(file => {
                    // Stop if the filename start with a dot
                    if (file.name[0] === ".") return

                    // Create a new result element
                    resultElem = new ExercicesResult(file.name, file.isDirectory(), pathToExplore + "\\" + file.name, this).toElement();

                    resultsContainer.appendChild(resultElem);
                });

                if (goingBack) resultsContainer.scrollTo({ top: this._scrollPos.pop(), behavior: "instant" });
            })
            .catch(error => { resultsContainer.innerHTML = "<p class='loading_indicator'>Impossible de lire le dossier [ " + path.join(ROOT_FOLDER, pathToExplore) + " ]<br/><span class='error'>" + error + "</span></p>" });
    }

    _displayTagSearchResults() {
        this._rootElement.classList.add("tagSearchInProgress");
        this._rootElement.classList.add("searchResultsAreDisplayed");

        // this._current_folder = null;
        this._rootElement.querySelector(".resultsContainer").innerHTML = "";

        var filteredDirPathList = null,
            continueForEach = true;

        // On parcourt d'abord les .tag normaux (ceux sans .notIn)
        this._rootElement.querySelectorAll(".tagsSearchContainer .tag:not(.notIn)").forEach(tagElem => {
            if (continueForEach) {
                // Si 1 des tags n'a aucun dossier associé, la recherche est vide, on peut arreter là
                if (tagElem.datas.folders === undefined) {
                    filteredDirPathList = [];
                    continueForEach = false;
                }
                else if (filteredDirPathList === null) filteredDirPathList = tagElem.datas.folders;
                else {
                    // Passe en revue tous les chemins recueillis jusque là, et garde seulement les chemins présents dans la liste de tous les tags
                    filteredDirPathList = filteredDirPathList.filter(dirPathA => {
                        if (tagElem.datas.folders.indexOf(dirPathA) !== -1) return true;
                        else return false;
                    });
                }
            }
        });

        // On parcourt ensuite ceux .notIn si necessaire
        if (filteredDirPathList !== null && filteredDirPathList !== undefined) this._rootElement.querySelectorAll(".tagsSearchContainer .tag.notIn").forEach(tagElem => {
            filteredDirPathList = filteredDirPathList.filter(dirPathA => {
                if (tagElem.datas.folders === undefined) return true;
                else if (tagElem.datas.folders.indexOf(dirPathA) !== -1) return false;
                else return true;
            });
        });

        if (filteredDirPathList !== null) filteredDirPathList.forEach(dirPath => this._rootElement.querySelector(".resultsContainer").appendChild(new ExercicesResult(path.basename(dirPath), true, dirPath, this).toElement()));
    }


    display() {
        var displayed = document.body.querySelector(".sectionContainer.displayed");
        if (displayed) displayed.classList.remove("displayed");
        this._rootElement.classList.add("displayed");

        var SectionSelector = document.getElementById("sectionSelector");
        SectionSelector.querySelector(".tab.selected").classList.remove("selected");
        SectionSelector.querySelector(".tab.exercices").classList.add("selected");

        if (this._current_path === undefined) this.displayResults(this._root_path);
        else this.displayResults(this._current_path);
    }
};