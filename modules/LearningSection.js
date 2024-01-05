const fs = require('fs'), path = require('path'), fsp = require('fs/promises'),
    Tag = require('./Tag'),
    Section = require("./Section"),
    LearningResult = require("./LearningResult");
const PostitSection = require('./PostitSection');
const Notification = require('./Notification');
const Parameters = require('./Parameters');

module.exports = class LearningSection extends Section {

    /**@type {LearningSection} */
    static section

    #pending
    #currentlyEditedResult

    constructor(root_path, tagsFilePath) {
        super(root_path, tagsFilePath);

        LearningSection.section = this;

        this._rootElement.classList.add("learning");
        this._rootElement.innerHTML = this._loadSectionHtmlContent(__dirname + "/LearningSection.html");

        this._populateTags();

        // Init text editor
        let editorChangeHandlerId;

        tinymce.init({
            selector: '.descriptionEditor .textarea',
            menubar: false,
            inline: true,
            toolbar_persist: true,
            // skin: "oxide-dark",
            // link_context_toolbar: true,
            fixed_toolbar_container: ".descriptionEditor .tinymce-toolbar-container",
            plugins: 'image lists link autoresize autolink',
            toolbar: [
                'blocks | bold italic underline | forecolor backcolor | alignleft aligncenter alignright alignfull | numlist bullist outdent indent | link image | removeformat'
            ],
            block_formats: 'Paragraph=p; Header 1=h1; Header 2=h2',
            setup: editor => {
                editor.on('Paste Change input Undo Redo', () => {
                    clearTimeout(editorChangeHandlerId);
                    editorChangeHandlerId = setTimeout(() => {
                        this.#currentlyEditedResult.obj.description = editor.getContent();
                        this.#currentlyEditedResult.obj.storeLvDatas();
                    }, 800);
                });

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
        let result,
            tagElem;

        // Click on TopBar
        this._rootElement.querySelector(".topbar").addEventListener("click", event => {
            if (tagElem = event.target.closest(".icon")) nw.Shell.openItem(path.join(ROOT_FOLDER, this._current_path));
            else if (result = event.target.closest(".folder")) this.displayResults(result.dataset.path);
        });

        // Click on results container
        this._rootElement.querySelector(".resultsContainer").addEventListener("click", event => {

            if (result = event.target.closest(".result")) {
                // Click on tag
                if (tagElem = event.target.closest(".tag")) {
                    result.obj.removeTag(tagElem.dataset.id);
                }
                // Click on from_start button
                else if (event.target.closest(".from_start_button")) {
                    VIDEO_PLAYER.open(result.obj.path, 0, result);
                }
                // Click on description picto
                else if (event.target.closest(".descriptionPicto")) {
                    this.#currentlyEditedResult = result;
                    this._rootElement.querySelector(".descriptionEditor .label").innerHTML = result.obj.label + " <span>[ " + path.dirname(result.obj.path).split('\\').slice(1).join('\\').replace(/\\/g, ' > ') + " ]</span>";
                    this._rootElement.querySelector(".descriptionEditor .textarea").innerHTML = result.obj.description;
                    this._rootElement.querySelector(".descriptionEditor").classList.add("displayed")
                    this._rootElement.querySelector(".descriptionEditor .textarea").focus();
                }
                // Click on dir type result
                else if (result.classList.contains("dir")) {
                    // Click on parent folder shortcut
                    if (result.obj.label === "..") this.displayResults(result.obj.path, true);
                    // else click on a sub-folder
                    else {
                        // Click on icon
                        if (tagElem = event.target.closest(".icon")) nw.Shell.openItem(path.join(ROOT_FOLDER, result.obj.path));
                        else this.displayResults(result.obj.path);
                    }
                }
                // Click on file type result
                else {
                    if (result.obj.fileType === "video" || result.obj.fileType === "youtube") VIDEO_PLAYER.open(result.obj.path, false, result);
                    else nw.Shell.openItem(path.join(ROOT_FOLDER, result.obj.path));
                }
            }
        });

        // Right click on results container
        this._rootElement.querySelector(".resultsContainer").addEventListener("contextmenu", event => {
            event.preventDefault();

            // Base items for folder and file contextmenu
            let items = [];

            if (!this._rootElement.classList.contains("searchResultsAreDisplayed")) {
                items.push({
                    label: "Nouveau dossier",
                    icon: "folder3.svg",
                    sep: true,
                    action: item => {

                        // Check if a file folder exists
                        let baseName = "Nouveau dossier",
                            folderName = baseName,
                            round = 0;

                        while (fs.existsSync(path.join(ROOT_FOLDER, this._current_path, folderName))) {
                            round++;
                            folderName = baseName + " " + round;
                        }

                        fs.mkdir(path.join(ROOT_FOLDER, this._current_path, folderName), async err => {
                            if (err) console.error(err);

                            // Creation du dossier réussie
                            else {
                                await this.displayResults(this._current_path);

                                // Enter Rename mode
                                for (const resultElem of this._rootElement.querySelectorAll(".result.dir")) {

                                    if (resultElem.querySelector(".label").innerHTML === folderName) {

                                        resultElem.scrollIntoView();

                                        RENAME(resultElem.querySelector(".label"), true, (oldName, newName) => {

                                            // Check if a file with the same name already exist
                                            if (fs.existsSync(path.join(ROOT_FOLDER, path.dirname(resultElem.obj.path), newName))) return "Un ficher [" + newName + "] existe déjà.";

                                            // Rename file
                                            fs.rename(path.join(ROOT_FOLDER, resultElem.obj.path), path.join(ROOT_FOLDER, path.dirname(resultElem.obj.path), newName), error => {
                                                if (error) {
                                                    console.log(error);
                                                    return "Erreur lors du changement de nom du fichier :\r" + path.join(ROOT_FOLDER, resultElem.obj.path);
                                                }
                                                else {
                                                    resultElem.obj.label = newName;
                                                    resultElem.title = path.join(ROOT_FOLDER, path.dirname(resultElem.obj.path), newName);
                                                    resultElem.obj.path = path.join(path.dirname(resultElem.obj.path), newName);
                                                }
                                            });

                                            // Position the new renamed folder in the correct alphabetic order
                                            let isTheLast = true;
                                            for (const comparedElem of this._rootElement.querySelectorAll(".result.dir")) {
                                                if (comparedElem.querySelector(".label").innerText.localeCompare(newName) > 0) {
                                                    this.getChildElem(".resultsContainer").insertBefore(resultElem, comparedElem);
                                                    isTheLast = false;
                                                    break;
                                                }
                                            }

                                            if (isTheLast) {
                                                let firstFile = this.getChildElem(".result.file");
                                                if (firstFile) this.getChildElem(".resultsContainer").insertBefore(resultElem, firstFile);
                                                else this.getChildElem(".resultsContainer").appendChild(resultElem);
                                            }

                                            resultElem.scrollIntoView();

                                            return true;
                                        });
                                    }
                                }
                            }
                        });
                    }
                });
            }

            // Add file specific items for files
            let target;
            if (target = event.target.closest(".result")) {

                items.unshift({
                    label: "Ajouter un Post-it",
                    icon: "postit_plus.svg",
                    sep: true,
                    action: item => { PostitSection.display_new_post_floating_form(target.obj.path, !target.obj.isDir); }
                });

                items.push(
                    {
                        label: "Renommer...",
                        icon: "rename.svg",
                        action: item => {
                            let selector = '.label';

                            if (this._rootElement.classList.contains("searchResultsAreDisplayed")) selector = ".label .resultName";

                            RENAME(target.querySelector(selector), true, (oldName, newName) => {

                                // Check if a file with the same name already exist
                                if (fs.existsSync(path.join(ROOT_FOLDER, path.dirname(target.obj.path), newName))) return "Un ficher [" + newName + "] existe déjà.";

                                // Change name
                                fs.rename(path.join(ROOT_FOLDER, target.obj.path), path.join(ROOT_FOLDER, path.dirname(target.obj.path), newName), error => {
                                    if (error) {
                                        console.log(error);
                                        return "Erreur lors du changement de nom du fichier :\r" + path.join(ROOT_FOLDER, target.obj.path);
                                    }
                                    else {
                                        target.obj.label = newName;
                                        target.obj.path = path.join(ROOT_FOLDER, path.dirname(target.obj.path), newName);
                                        target.title = path.join(path.dirname(target.obj.path), newName);

                                        // Position the new renamed folder in the correct alphabetic order (if not search result display mode)
                                        if (!this._rootElement.classList.contains("searchResultsAreDisplayed")) {
                                            let type = (target.classList.contains("dir")) ? "dir" : "file",
                                                isTheLast = true;

                                            for (const comparedElem of this._rootElement.querySelectorAll(".result." + type)) {
                                                if (comparedElem.querySelector(".label").innerText.localeCompare(newName) > 0) {
                                                    this.getChildElem(".resultsContainer").insertBefore(target, comparedElem);
                                                    isTheLast = false;
                                                    break;
                                                }
                                            }

                                            if (isTheLast) {
                                                if (type === "dir") {
                                                    let firstFile = this.getChildElem(".result.file");
                                                    if (firstFile) this.getChildElem(".resultsContainer").insertBefore(target, firstFile);
                                                    else this.getChildElem(".resultsContainer").appendChild(target);
                                                }
                                                else this.getChildElem(".resultsContainer").appendChild(target);
                                            }

                                            target.scrollIntoView();
                                        }

                                        // Update tags database
                                        let oldPath = path.join(path.dirname(target.obj.path), oldName),
                                            saveIsRequired = false;

                                        this._rootElement.querySelectorAll(".DB_tags_container .tag").forEach(tagElem => {
                                            if (tagElem.datas.folders) tagElem.datas.folders.forEach((folderPath, idx) => {

                                                if (folderPath && folderPath.includes(oldPath)) {
                                                    tagElem.datas.folders[idx] = folderPath.replace(oldPath, path.join(path.dirname(target.obj.path), newName));
                                                    saveIsRequired = true;
                                                }
                                            })
                                        });

                                        if (saveIsRequired) Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));
                                    }
                                });

                                return true;
                            });
                        }
                    },
                    {
                        label: "Supprimer",
                        icon: "trashcan.svg",
                        sep: true,
                        action: item => {
                            if (confirm("Supprimer cette resource ?\r" + target.obj.label)) {

                                // Get target stats
                                fs.lstat(path.join(ROOT_FOLDER, target.obj.path), (error, stats) => {
                                    if (error) {
                                        console.error(error);
                                        alert("Erreur lors de la supression du fichier\r" + target.obj.label);
                                    }

                                    // If target is a directory...
                                    else if (stats.isDirectory()) fs.rmdir(path.join(ROOT_FOLDER, target.obj.path), { recursive: true }, error => {
                                        if (error) {
                                            console.error(error);
                                            alert("Erreur lors de la supression du dossier\r" + target.obj.label);
                                        }
                                        else {

                                            // Update tags database
                                            let saveIsRequired = false;

                                            this._rootElement.querySelectorAll(".DB_tags_container .tag").forEach(tagElem => {
                                                if (tagElem.datas.folders) tagElem.datas.folders.forEach((folderPath, idx) => {

                                                    if (folderPath && folderPath.includes(target.obj.path)) {
                                                        tagElem.datas.folders.splice(idx, 1);
                                                        saveIsRequired = true;
                                                    }
                                                })
                                            });

                                            if (saveIsRequired) Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));

                                            target.remove();
                                        }
                                    });

                                    // If not, probably a file
                                    else fs.unlink(path.join(ROOT_FOLDER, target.obj.path), error => {
                                        if (error) {
                                            console.error(error);
                                            alert("Erreur lors de la supression du fichier\r" + target.obj.label);
                                        }
                                        else {
                                            // Update tags database
                                            let saveIsRequired = false;

                                            this._rootElement.querySelectorAll(".DB_tags_container .tag").forEach(tagElem => {
                                                if (tagElem.datas.folders) tagElem.datas.folders.forEach((folderPath, idx) => {

                                                    if (folderPath && folderPath.includes(target.obj.path)) {
                                                        tagElem.datas.folders.splice(idx, 1);
                                                        saveIsRequired = true;
                                                    }
                                                })
                                            });

                                            if (saveIsRequired) Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));

                                            // Update parent's .lv file datas
                                            target.obj.delete_lv_datas_for_filetype();

                                            target.remove();
                                        }
                                    });
                                });
                            }
                        }
                    },
                    {
                        label: "Photoshop : Ouvrir...",
                        icon: "photoshop.svg",
                        action: item => {
                            require("child_process").execFile("python.exe", ["./external/photoshop_open.pyw", path.join(ROOT_FOLDER, target.obj.path)], (error, stdout, stderr) => {
                                if (error) console.log(error);
                                else console.log(stdout);
                            });
                        }
                    },
                    {
                        label: "Photoshop : Ajouter comme layer",
                        icon: "photoshop.svg",
                        action: item => {
                            require("child_process").execFile("python.exe", ["./external/photoshop_addAsLayer.pyw", path.join(ROOT_FOLDER, target.obj.path)], (error, stdout, stderr) => {
                                if (error) console.log(error);
                                else console.log(stdout);
                            });
                        }
                    }
                );
            }

            if (items.length > 0) MOUSE_MENU.display(items, event.clientX, event.clientY);
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
                        if (sameTag) {
                            tagsContainerTarget.insertBefore(sameTag, targetTag);
                        }
                        else {
                            tagsContainerTarget.insertBefore(newTagElem, targetTag);
                        }
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
                        var ogTag = this.getChildElem(".DB_tags_container .tag[data-id='" + droppedTag.dataset.id + "']");
                        if (ogTag.datas.folders === undefined) ogTag.datas.folders = [];
                        ogTag.datas.folders.push(resultTarget.obj.path);

                        Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));
                    }
                }
            }
        });

        // Handle creating file when pasting URL (.youtube, .url type files)
        document.addEventListener("paste", event => {
            if (this._rootElement.classList.contains("displayed")
                && !this._rootElement.classList.contains("searchResultsAreDisplayed")
                && this._current_path !== this._root_path
                && !document.activeElement.getAttribute("contenteditable") // Prevent paste handling when editing contenteditable elements (like renaming a result)
            ) {

                var items = (event.clipboardData || event.originalEvent.clipboardData).items;

                for (var index in items) {

                    var item = items[index];

                    // Un URL est collée
                    if (item.kind === 'string') {
                        item.getAsString(string => {
                            if (string.match(/^https?:/i)) {

                                // Youtube video
                                if (string.match(/^(https?:\/\/)?(www\.)?(youtube.com|youtu.be)/i)) {
                                    let matchVideoId = string.match(/(?:youtu.be\/([^?]+)|v=([^&]+))/i);

                                    if (matchVideoId !== null && (matchVideoId[1] !== undefined || matchVideoId[2] !== undefined)) {

                                        let jsonData = { videoId: matchVideoId[1] || matchVideoId[2] };

                                        let matchTime = string.match(/t=([0-9]+)/i);

                                        if (matchTime !== null && matchTime[1] !== undefined) jsonData.startTime = matchTime[1];

                                        // Check if a file already exists
                                        let baseName = "Nouvelle video", ext = ".youtube",
                                            fileName = baseName,
                                            round = 0;

                                        while (fs.existsSync(path.join(ROOT_FOLDER, this._current_path, fileName + ext))) {
                                            round++;
                                            fileName = baseName + " " + round;
                                        }

                                        // Create file
                                        fs.writeFile(path.join(ROOT_FOLDER, this._current_path, fileName + ext), JSON.stringify(jsonData), async error => {
                                            if (error) console.log(error);
                                            else {
                                                await this.displayResults(this._current_path);

                                                // Enter Rename mode
                                                for (const resultElem of this._rootElement.querySelectorAll(".result.file")) {

                                                    if (resultElem.querySelector(".label").innerHTML === fileName + ext) {

                                                        resultElem.scrollIntoView();

                                                        RENAME(resultElem.querySelector(".label"), true, (oldName, newName) => {

                                                            // Check if a file with the same name already exist
                                                            if (fs.existsSync(path.join(ROOT_FOLDER, path.dirname(resultElem.obj.path), newName))) return "Un ficher [" + newName + "] existe déjà.";

                                                            // Rename file
                                                            fs.rename(path.join(ROOT_FOLDER, resultElem.obj.path), path.join(ROOT_FOLDER, path.dirname(resultElem.obj.path), newName), error => {
                                                                if (error) {
                                                                    console.log(error);
                                                                    return "Erreur lors du changement de nom du fichier :\r" + path.join(ROOT_FOLDER, resultElem.obj.path);
                                                                }
                                                                else {
                                                                    resultElem.obj.label = newName;
                                                                    resultElem.title = path.join(ROOT_FOLDER, path.dirname(resultElem.obj.path), newName);
                                                                    resultElem.obj.path = path.join(path.dirname(resultElem.obj.path), newName);

                                                                    // Position the new renamed folder in the correct alphabetic order
                                                                    let isTheLast = true;
                                                                    for (const comparedElem of this._rootElement.querySelectorAll(".result.file")) {
                                                                        if (comparedElem.querySelector(".label").innerText.localeCompare(newName) > 0) {
                                                                            this.getChildElem(".resultsContainer").insertBefore(resultElem, comparedElem);
                                                                            isTheLast = false;
                                                                            break;
                                                                        }
                                                                    }

                                                                    if (isTheLast) this.getChildElem(".resultsContainer").appendChild(resultElem);

                                                                    resultElem.scrollIntoView();
                                                                }
                                                            });

                                                            return true;
                                                        });
                                                    }

                                                }
                                            }
                                        });
                                    }
                                }
                                // Other type of link
                                else {
                                    let baseName = "Nouveau Site", ext = ".url",
                                        fileName = baseName,
                                        round = 0;

                                    while (fs.existsSync(path.join(ROOT_FOLDER, this._current_path, fileName + ext))) {
                                        round++;
                                        fileName = baseName + " " + round;
                                    }

                                    fs.writeFile(path.join(ROOT_FOLDER, this._current_path, fileName + ext), "[{000214A0-0000-0000-C000-000000000046}]\nProp3=19,11\n[InternetShortcut]\nIDList=\nURL=" + string + "\n", async error => {
                                        if (error) console.log(error);
                                        else {
                                            await this.displayResults(this._current_path);

                                            // Enter Rename mode
                                            for (const resultElem of this._rootElement.querySelectorAll(".result.file")) {

                                                if (resultElem.querySelector(".label").innerHTML === fileName + ext) {

                                                    resultElem.scrollIntoView();

                                                    RENAME(resultElem.querySelector(".label"), true, (oldName, newName) => {

                                                        // Check if a file with the same name already exist
                                                        if (fs.existsSync(path.join(ROOT_FOLDER, path.dirname(resultElem.obj.path), newName))) return "Un ficher [" + newName + "] existe déjà.";

                                                        // Rename file
                                                        fs.rename(path.join(ROOT_FOLDER, resultElem.obj.path), path.join(ROOT_FOLDER, path.dirname(resultElem.obj.path), newName), error => {
                                                            if (error) {
                                                                console.log(error);
                                                                return "Erreur lors du changement de nom du fichier :\r" + path.join(ROOT_FOLDER, resultElem.obj.path);
                                                            }
                                                            else {
                                                                resultElem.obj.label = newName;
                                                                resultElem.title = path.join(ROOT_FOLDER, path.dirname(resultElem.obj.path), newName);
                                                                resultElem.obj.path = path.join(path.dirname(resultElem.obj.path), newName);

                                                                // Position the new renamed folder in the correct alphabetic order
                                                                let isTheLast = true;
                                                                for (const comparedElem of this._rootElement.querySelectorAll(".result.file")) {
                                                                    if (comparedElem.querySelector(".label").innerText.localeCompare(newName) > 0) {
                                                                        this.getChildElem(".resultsContainer").insertBefore(resultElem, comparedElem);
                                                                        isTheLast = false;
                                                                        break;
                                                                    }
                                                                }

                                                                if (isTheLast) this.getChildElem(".resultsContainer").appendChild(resultElem);

                                                                resultElem.scrollIntoView();
                                                            }
                                                        });

                                                        return true;
                                                    });
                                                }

                                            }
                                        }
                                    });
                                }
                            }
                        });
                    }
                }
            }
        });

        // Click on close description editor
        this._rootElement.querySelector(".descriptionEditor .button[data-action='closeLearningDescription']").addEventListener("click", event => {
            this._rootElement.querySelector(".descriptionEditor").classList.remove("displayed");
        });

        // Keyboard press
        let timeout_id,
            keys_to_look_for = '';

        document.addEventListener("keydown", event => {

            if (document.activeElement && (document.activeElement.closest(".preventKeypressEvent") || document.activeElement.getAttribute('contenteditable') === 'true')) { }
            else {
                clearTimeout(timeout_id);

                let already_selected = this.getChildElem(".resultsContainer .result.highlithed");
                if (already_selected) already_selected.classList.remove("highlithed");

                if (event.key === 'Escape') keys_to_look_for = '';
                else if (event.key === 'Backspace') keys_to_look_for = keys_to_look_for.slice(0, -1);
                else if (event.key.length === 1) keys_to_look_for += event.key;

                if (keys_to_look_for.length > 0) {
                    timeout_id = setTimeout(() => keys_to_look_for = '', 1500);

                    for (const result of this.getChildrenElem(".resultsContainer .result .label")) {
                        if (result.innerText.slice(0, keys_to_look_for.length).toLowerCase() === keys_to_look_for) {

                            result.closest(".result").classList.add("highlithed");
                            result.closest(".result").scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
                            break;
                        }
                    }
                }
            }
        });

        super._registerEventHandlers();
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
                    lvDatas = LearningResult.getLvDatas(dirPath);

                    // Presence de données .lv dans le dossier
                    if (lvDatas) {

                        if (lvDatas.tags) for (const tagId of lvDatas.tags) {
                            if (newIndexedDatas[tagId] === undefined) newIndexedDatas[tagId] = [];

                            newIndexedDatas[tagId].push(path.relative(ROOT_FOLDER, dirPath));
                        }

                        if (lvDatas.files) for (const filename in lvDatas.files) {

                            let fileDatas = lvDatas.files[filename];

                            if (fileDatas.tags) for (const tagId of fileDatas.tags) {
                                if (newIndexedDatas[tagId] === undefined) newIndexedDatas[tagId] = [];

                                newIndexedDatas[tagId].push(path.relative(ROOT_FOLDER, path.join(dirPath, filename)));
                            }
                        }
                    }

                    this.#indexDirectory(dirPath, newIndexedDatas, onComplete);
                }
            });

            if (this.#pending === 0 && onComplete) onComplete();
        });
    }

    _update_folder_indexation() {
        let newIndexedDatas = [];

        document.body.classList.add("loading");

        this.#pending = 0;

        this.#indexDirectory(
            path.join(ROOT_FOLDER, this._root_path),
            newIndexedDatas,
            () => {
                // Clear actual tag / path association & store new assosiations if necesary
                this.getChildrenElem(".DB_tags_container .tag").forEach(tagElem => {
                    delete tagElem.datas.folders;
                    if (newIndexedDatas[tagElem.datas.id] !== undefined) tagElem.datas.folders = newIndexedDatas[tagElem.datas.id];
                });

                Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));

                document.body.classList.remove("loading");
            });
    }

    async displayResults(pathToExplore, goingBack, stopTagSearch) {
        let resultsContainer = this._rootElement.querySelector(".resultsContainer");

        if (!goingBack) this._scrollPos.push(resultsContainer.scrollTop);

        this._current_path = path.normalize(pathToExplore);

        contextHasChanged(this._current_path);

        // Clear top bar & results
        this._rootElement.querySelector(".topbar .path").innerHTML = "";
        resultsContainer.innerHTML = "<p class='loading_indicator'>Chargement ...</p>";

        if (stopTagSearch) this._rootElement.classList.remove("tagSearchInProgress");
        this._rootElement.classList.remove("searchResultsAreDisplayed");

        // Fill top bar with current path
        let topBarHtml = "<span class='icon'><img src='assets/images/folder3.svg' alt='' /></span><span class='folder' data-path=\"" + this._root_path + "\">Artists</span>",
            currentPath = this._root_path;

        path.relative(this._root_path, pathToExplore).split("\\").forEach(folder => {
            if (folder !== "") {
                currentPath += "\\" + folder;
                topBarHtml += "<span class='separateur'>></span><span class='folder' data-path=\"" + currentPath + "\">" + folder + "</span>";
            }
        })

        this._rootElement.querySelector(".topbar .path").innerHTML = topBarHtml;

        await fsp.readdir(path.join(ROOT_FOLDER, pathToExplore), { withFileTypes: true })
            .then(files => {

                resultsContainer.innerHTML = "";

                // Sort folder's content to put directories first
                files.sort((a, b) => {
                    if (a.isDirectory() && !b.isDirectory()) return -1;
                    else if (!a.isDirectory() && b.isDirectory()) return 1;
                    else return a.name.localeCompare(b.name);
                });

                // Get lv datas of current path
                let lvDatas = LearningResult.getLvDatas(path.join(ROOT_FOLDER, this._current_path));

                let result,
                    not_indexed_tags = [];

                // Add parent directory button
                if (pathToExplore !== this._root_path) {
                    result = new LearningResult("..", true, path.dirname(pathToExplore), this);
                    resultsContainer.appendChild(result.toElement());
                }

                // Process path content and create result elements
                files.forEach(file => {

                    if (file.name === ".lv") return

                    // Get the datas stored in parent directory (the one being explored) for the current file
                    let lvDatasFromParent = (lvDatas && lvDatas.files && lvDatas.files[file.name]) ? lvDatas.files[file.name] : null;

                    // Create a new result element
                    result = new LearningResult(file.name, file.isDirectory(), pathToExplore + "\\" + file.name, this, false, lvDatasFromParent);

                    if (result.not_indexed_tags.length > 0) not_indexed_tags = not_indexed_tags.concat(result.not_indexed_tags);

                    resultsContainer.appendChild(result.toElement());
                });

                // Des tags non indéxés ont été rapportés
                if (not_indexed_tags.length > 0) {
                    let msg = "Des tags non-indexés ont été détecté et indexés.</br>";

                    for (const item of not_indexed_tags) msg += "<br /><br />    - " + item[1] + " => " + item[0];

                    new Notification(msg, { immediate_display: false, type: "alert", persistent: true });
                }

                // Si on revient en arrière, scroll à l'endroit enregistré
                if (goingBack) resultsContainer.scrollTo({ top: this._scrollPos.pop(), behavior: "instant" });
            })
            .catch(error => { resultsContainer.innerHTML = "<p class='loading_indicator'>Impossible de lire le dossier [ " + path.join(ROOT_FOLDER, pathToExplore) + " ]<br/><span class='error'>" + error + "</span></p>" });
    }

    _displayTagSearchResults() {
        contextHasChanged(null);

        this._rootElement.classList.add("tagSearchInProgress");
        this._rootElement.classList.add("searchResultsAreDisplayed");

        // this._current_folder = null;
        this._rootElement.querySelector(".resultsContainer").innerHTML = "";

        var filteredResultsPathList = null,
            continueForEach = true;

        // On parcourt d'abord les .tag normaux (ceux sans .notIn)
        this._rootElement.querySelectorAll(".tagsSearchContainer .tag:not(.notIn)").forEach(tagElem => {
            if (continueForEach) {
                // Si 1 des tags n'a aucun dossier associé, la recherche est vide, on peut arreter là
                if (tagElem.datas.folders === undefined) {
                    filteredResultsPathList = [];
                    continueForEach = false;
                }
                else if (filteredResultsPathList === null) filteredResultsPathList = tagElem.datas.folders;
                else {
                    // Passe en revue tous les chemins recueillis jusque là, et garde seulement les chemins présents dans la liste de tous les tags
                    filteredResultsPathList = filteredResultsPathList.filter(dirPathA => {
                        if (tagElem.datas.folders.indexOf(dirPathA) !== -1) return true;
                        else return false;
                    });
                }
            }
        });

        // On parcourt ensuite ceux .notIn si necessaire
        if (filteredResultsPathList !== null && filteredResultsPathList !== undefined) this._rootElement.querySelectorAll(".tagsSearchContainer .tag.notIn").forEach(tagElem => {
            filteredResultsPathList = filteredResultsPathList.filter(dirPathA => {
                if (tagElem.datas.folders === undefined) return true;
                else if (tagElem.datas.folders.indexOf(dirPathA) !== -1) return false;
                else return true;
            });
        });

        let isDir, baseName, parentLvDatas, lvDatasFromParent;

        if (filteredResultsPathList !== null) filteredResultsPathList.forEach(resultPath => {
            isDir = fs.existsSync(path.join(ROOT_FOLDER, resultPath)) && fs.lstatSync(path.join(ROOT_FOLDER, resultPath)).isDirectory();

            if (!isDir) {
                baseName = path.basename(resultPath);

                parentLvDatas = LearningResult.getLvDatas(path.dirname(resultPath));

                lvDatasFromParent = (parentLvDatas && parentLvDatas.files && parentLvDatas.files[baseName]) ? parentLvDatas.files[baseName] : null;
            }
            else lvDatasFromParent = undefined;

            this._rootElement.querySelector(".resultsContainer").appendChild(new LearningResult(path.basename(resultPath), isDir, resultPath, this, true, lvDatasFromParent).toElement());
        });
    }

    display() {
        var displayed = document.body.querySelector(".sectionContainer.displayed");
        if (displayed) displayed.classList.remove("displayed");
        this._rootElement.classList.add("displayed");

        var SectionSelector = document.getElementById("sectionSelector");
        SectionSelector.querySelector(".tab.selected").classList.remove("selected");
        SectionSelector.querySelector(".tab.learning").classList.add("selected");

        if (this._current_path === undefined) this.displayResults(this._root_path);
        else this.displayResults(this._current_path);
    }
};