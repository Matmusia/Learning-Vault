const fs = require('fs'), path = require('path'),
    Tag = require('./Tag');
const Parameters = require('./Parameters');

module.exports = class Section {
    _scrollPos = []

    _root_path
    _current_path
    _rootElement

    #folders_path_associated_tags

    tagsFilePath

    constructor(root_path, tagsFilePath) {
        this._root_path = path.normalize(root_path);
        this.tagsFilePath = tagsFilePath;

        this._rootElement = document.createElement("div");
        this._rootElement.classList.add("sectionContainer");

        this._rootElement.addEventListener("dragover", event => event.preventDefault());
    }

    _loadSectionHtmlContent(path) {
        try {
            return fs.readFileSync(path, 'utf8');
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la lecture du fichier '" + path + "'");
            return "";
        }
    }

    #newTagGroupTitle(groupName) {

        let tagsGroupTitleElem = document.createElement("div");
        tagsGroupTitleElem.classList.add("tagGroupTitle");
        tagsGroupTitleElem.innerHTML = "<img src='assets/images/chevron-down.svg' /><span class='label'>" + groupName + "</span>";

        return tagsGroupTitleElem;
    }

    #newTagGroupContainer(groupName, groupBgColor, groupTextColor) {

        let tagsGroupContainer = document.createElement("div");
        tagsGroupContainer.classList.add("tagGroupContainer");
        tagsGroupContainer.dataset.label = groupName;
        if (groupBgColor) tagsGroupContainer.dataset.bgColor = groupBgColor;
        if (groupTextColor) tagsGroupContainer.dataset.txtColor = groupTextColor;

        return tagsGroupContainer;
    }

    _populateTags(targetedTagsContainer, do_checks) {

        if (do_checks === undefined) do_checks = true;

        let idVerificationArray = [];
        if (targetedTagsContainer === undefined) targetedTagsContainer = this._rootElement.querySelector(".DB_tags_container");

        if (do_checks) this.#folders_path_associated_tags = {};

        for (const tag_group_datas of Tag.load_tags_DB(this.tagsFilePath)['groups']) {

            // Store in an array all indexed folder pathes associated with their stored tags
            if (do_checks) for (const tag_datas of tag_group_datas.tags) {
                if (tag_datas.folders) for (const folder_path of tag_datas.folders) {
                    if (this.#folders_path_associated_tags[folder_path] === undefined) this.#folders_path_associated_tags[folder_path] = [];
                    this.#folders_path_associated_tags[folder_path].push(tag_datas.id);
                }
            }

            // Add new Tags' group HTMLElement
            targetedTagsContainer.appendChild(this.#newTagGroupTitle(tag_group_datas.label));

            let tagsGroupContainer = this.#newTagGroupContainer(tag_group_datas.label, tag_group_datas.bgColor, tag_group_datas.txtColor);
            targetedTagsContainer.appendChild(tagsGroupContainer);

            // Create Tags
            tag_group_datas.tags.forEach(tagDatas => {

                if (do_checks) {
                    if (idVerificationArray[tagDatas.id]) alert("Attention !\rL'ID de tag " + tagDatas.id + " est utilisé plusieur fois.\rNotament pour le tag [ " + tagDatas.label + " ]");
                    idVerificationArray[tagDatas.id] = true;
                }

                if (tag_group_datas.bgColor) tagDatas.inheritedBgColor = tag_group_datas.bgColor;
                if (tag_group_datas.txtColor) tagDatas.inheritedTxtColor = tag_group_datas.txtColor;

                tagsGroupContainer.appendChild(new Tag(tagDatas).toElement());
            });
        }
    }

    _registerEventHandlers() {
        let TagsSearchContainer = this._rootElement.querySelector(".tagsSearchContainer"),
            tagElem,
            tagTitle;

        // Click sur un tag dans un tag group
        this._rootElement.querySelector(".DB_tags_container").addEventListener("click", (event) => {

            // Si on click sur un tag
            let sameTag;

            if (tagElem = event.target.closest(".tag")) {
                // Si le tag est déjà présent, on l'enlève
                if (sameTag = TagsSearchContainer.querySelector(".tag[data-id='" + tagElem.datas.id + "'")) {
                    sameTag.remove();

                    tagElem.classList.remove("activated");

                    if (TagsSearchContainer.querySelector(".tag") === null) {

                        this.displayResults(this._root_path, false, true);

                        return;
                    }
                }
                else {
                    TagsSearchContainer.appendChild(new Tag(tagElem.datas, true).toElement());
                    tagElem.classList.add("activated");
                }

                this._displayTagSearchResults();
            }
            else if (tagTitle = event.target.closest(".tagGroupTitle")) {
                tagTitle.classList.toggle("closed");
                tagTitle.nextElementSibling.classList.toggle("hidden");
            }
        });

        // Click droit sur un tag dans un group
        this._rootElement.querySelector(".DB_tags_container").addEventListener("contextmenu", event => {

            let new_tag_item = {
                label: "Nouveau Tag",
                icon: "tag_plus.svg",
                sep: true,
                action: item => {

                    // Find a unique tag ID
                    for (var i = 0; i < 10000; i++) if (this.getChildElem(".tag[data-id='" + i + "']") === null) break;

                    let newTag = new Tag({ 'id': i, 'label': "New tag" }).toElement();
                    this.getChildElem(".tagGroupContainer").appendChild(newTag);

                    RENAME(newTag, false, async () => { Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer')); });
                }
            };

            let newGroupItem = {
                label: "Nouveau groupe",
                icon: "plus.svg",
                action: item => {

                    let label = "Nouveau groupe",
                        groupTitleElem = this.#newTagGroupTitle(label);

                    this._rootElement.querySelector(".DB_tags_container").appendChild(groupTitleElem);
                    this._rootElement.querySelector(".DB_tags_container").appendChild(this.#newTagGroupContainer(label));

                    Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));

                    RENAME(groupTitleElem.querySelector(".label"), false, async (oldName, newName) => {
                        groupTitleElem.nextElementSibling.dataset.label = newName;

                        Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));
                    });
                }
            };

            // Si on right-click sur un tag
            if (tagElem = event.target.closest(".tag")) {
                event.preventDefault();

                let items = [];

                items.push(
                    {
                        label: "Renommer le tag",
                        icon: "rename.svg",
                        action: item => {
                            RENAME(tagElem, false, async (oldName, newName) => {
                                tagElem.datas.label = newName;

                                Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));

                                // Change the name of all the currently displayed instancies of this tag
                                this._rootElement.querySelectorAll('.tag').forEach(displayedTagElem => {
                                    if (displayedTagElem.obj instanceof Tag) {
                                        if (tagElem.datas.id === displayedTagElem.datas.id) {
                                            displayedTagElem.datas.label = displayedTagElem.innerHTML = newName;
                                        }
                                    }
                                });
                            });
                        }
                    },
                    {
                        label: "Edit colors...",
                        icon: "colors.svg",
                        sep: true,
                        action: item => {
                            TagEditor.currentTagsFilePath = this.tagsFilePath;
                            TagEditor.currentTagsContainer = this._rootElement.querySelector(".DB_tags_container")
                            TagEditor.targetTag = tagElem;

                            if (tagElem.datas.bgColor) {
                                TagEditor.querySelector(".bgColor input[type='checkbox']").checked = true;
                                TagEditor.querySelector(".bgColor input[type='color']").value = tagElem.datas.bgColor;
                            }
                            else {
                                TagEditor.querySelector(".bgColor input[type='checkbox']").checked = false;
                                TagEditor.querySelector(".bgColor input[type='color']").value = "#000000";
                            }
                            if (tagElem.datas.txtColor) {
                                TagEditor.querySelector(".txtColor input[type='checkbox']").checked = true;
                                TagEditor.querySelector(".txtColor input[type='color']").value = tagElem.datas.txtColor;
                            }
                            else {
                                TagEditor.querySelector(".txtColor input[type='checkbox']").checked = false;
                                TagEditor.querySelector(".txtColor input[type='color']").value = "#000000";
                            }

                            TagEditor.classList.add("displayed");
                        }
                    },
                    new_tag_item,
                    {
                        label: "Supprimer",
                        icon: "trashcan.svg",
                        action: item => {
                            if (confirm("Supprimer ce tag ?\r" + tagElem.datas.label)) {
                                this._rootElement.querySelector(".DB_tags_container .tag[data-id='" + tagElem.datas.id + "']").remove();
                                Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));
                            }
                        }
                    }
                );

                MOUSE_MENU.display(items, event.clientX, event.clientY);
            }
            else if (tagTitle = event.target.closest(".tagGroupTitle")) {
                event.preventDefault();

                let items = [
                    {
                        label: "Renommer le groupe",
                        icon: "rename.svg",
                        action: item => {
                            RENAME(tagTitle.querySelector(".label"), false, async (oldName, newName) => {
                                tagTitle.nextElementSibling.dataset.label = newName;

                                Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));
                            });
                        }
                    },
                    {
                        label: "Supprimer",
                        icon: "trashcan.svg",
                        sep: true,
                        action: item => {
                            if (confirm("Supprimer ce groupe et les tags qu'il contient ?\r[ " + tagTitle.querySelector(".label").innerHTML + "]")) {
                                tagTitle.nextElementSibling.remove();
                                tagTitle.remove();
                                Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));
                            }
                        }
                    },
                    new_tag_item,
                    newGroupItem
                ];

                MOUSE_MENU.display(items, event.clientX, event.clientY);
            }
            else {
                event.preventDefault();

                let items = [new_tag_item, newGroupItem];

                MOUSE_MENU.display(items, event.clientX, event.clientY);
            }
        });

        // Click on bottom page buttons
        this._rootElement.querySelector(".buttonsContainer").addEventListener("click", event => {
            var buttonElement = event.target.closest(".button");

            if (buttonElement.dataset.action === "updateIndexedFolders") this._update_folder_indexation();
            else if (buttonElement.dataset.action === "addNewTag") {
                // Find a unique tag ID
                for (var i = 0; i < 10000; i++) if (this.getChildElem(".tag[data-id='" + i + "']") === null) break;

                let newTag = new Tag({ 'id': i, 'label': "New tag" }).toElement();
                this.getChildElem(".tagGroupContainer").appendChild(newTag);

                RENAME(newTag, false, async () => { Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer')); });
            }
            else if (buttonElement.dataset.action === "parameters") {
                Parameters.open('learning');
            }
        });

        // Click dans le search container
        this._rootElement.querySelector(".tagsSearchContainer").addEventListener("click", (event) => {
            tagElem = event.target.closest(".tag");

            // Si on click sur le boutton clear
            if (event.target.classList.contains("clearSearch")) {
                TagsSearchContainer.querySelectorAll(".tag").forEach(tagElem => tagElem.remove());
                this._rootElement.querySelectorAll(".DB_tags_container .tag.activated").forEach(tagElement => tagElement.classList.remove("activated"));
                this.displayResults(this._current_path, false, true);
            }
            // Si on click sur le boutton search
            else if (event.target.classList.contains("btSearch")) this._displayTagSearchResults();
            else if (event.target.classList.contains("notInButton")) {
                tagElem.classList.toggle("notIn");
                this._displayTagSearchResults();
            }
            // Si on click sur un tag, on le supprime
            else if (tagElem) {
                tagElem.remove();

                this._rootElement.querySelector(".DB_tags_container .tag[data-id='" + tagElem.datas.id + "']").classList.remove("activated");

                if (TagsSearchContainer.querySelector(".tag") === null) {
                    this.displayResults(this._current_path, false, true);
                }
                else this._displayTagSearchResults();
            }
        });
    }

    _update_folder_indexation() {
        console.log("Section:displayTagSearchResults non implémentée");
    }

    _displayTagSearchResults() {
        console.log("Section:displayTagSearchResults non implémentée");
    }

    get_indexed_tags_for_path(path) {
        return this.#folders_path_associated_tags[path];
    }

    get_DB_tag_elems() {
        return this._rootElement.querySelectorAll(".DB_tags_container .tag");
    }

    get_DB_tag_elem(tagId) {
        return this._rootElement.querySelector(".DB_tags_container .tag[data-id='" + tagId + "']");
    }

    getChildElem(query) {
        return this._rootElement.querySelector(query);
    }

    getChildrenElem(query) {
        return this._rootElement.querySelectorAll(query);
    }

    toElement() {
        return this._rootElement;
    }
};