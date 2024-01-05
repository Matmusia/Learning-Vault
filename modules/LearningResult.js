const fs = require('fs'), path = require('path'),
    Result = require('./Result'),
    Tag = require('./Tag');
const Notification = require('./Notification');
const Historia = require('./Historia');
const Parameters = require('./Parameters');

module.exports = class LearningResult extends Result {

    isDir
    fileType
    label
    path
    description
    files
    postits

    not_indexed_tags

    constructor(label, is_dir, dir_path, section, is_search_result, lv_datas_from_parent) {
        super(section);

        // Create result element
        this._element = document.createElement("div");
        this._element.classList.add("result");
        this._element.classList.add(is_dir ? "dir" : "file");
        this._element.title = path.join(ROOT_FOLDER, dir_path);
        this._element.obj = this;

        this.isDir = is_dir;
        this.fileType = null
        this.label = label;
        this.path = dir_path;
        this.description = "";

        this.not_indexed_tags = [];

        // Icon
        let icon = document.createElement("img");
        icon.classList.add("icon");

        let iconName;
        if (is_dir && label === "..") iconName = "back";
        else if (is_dir) iconName = "folder2";
        else this.fileType = iconName = this._getIconName(path.extname(label));
        icon.setAttribute("src", "assets/images/" + iconName + ".svg");
        this._element.appendChild(icon);

        // Label
        let label_elem = document.createElement("p");
        label_elem.classList.add("label");
        label_elem.innerHTML = label;
        this._element.appendChild(label_elem);

        // Add Artist name to label if result is a search result
        if (is_search_result) {

            let artistName = this.path.split("\\")[1];
            label_elem.innerHTML = "<span class='artist-name'>" + artistName + "</span> <span class='resultName'>" + label + '</span>';
        }

        if (label !== "..") {

            // Directory Tags container & tags
            let tags_container = document.createElement("p");
            tags_container.classList.add("directoryTagsContainer");
            this._element.appendChild(tags_container);

            // Ajout du picto indiquant une description pour ce résulat
            let descriptionPicto = document.createElement("img");
            descriptionPicto.classList.add("descriptionPicto");
            descriptionPicto.setAttribute("src", "assets/images/note.svg");
            this._element.insertBefore(descriptionPicto, tags_container);

            // Ajout du picto indiquant une lecture précédente du fichier vidéo
            if (this.fileType === 'video' || this.fileType === 'youtube') {

                let from_strat_picto = document.createElement("img");
                from_strat_picto.classList.add("from_start_button");
                from_strat_picto.setAttribute("src", "assets/images/restart.svg");

                let stored_start_time = VIDEO_PLAYER.get_stored_playing_time(this.path);

                if (stored_start_time !== undefined) from_strat_picto.classList.add('displayed');

                descriptionPicto.before(from_strat_picto);
            }

            let lv_datas = (is_dir) ? Result.getLvDatas(path.join(ROOT_FOLDER, this.path)) : lv_datas_from_parent;

            if (lv_datas) {

                // Add tags element for all registred tags
                if (lv_datas.tags) lv_datas.tags.forEach(tag_id => {
                    // Get the tag HTMLElement from DB
                    let DB_tag = this._section.get_DB_tag_elem(tag_id);

                    // Tag exists in DB
                    if (DB_tag) {
                        tags_container.appendChild(new Tag(DB_tag.datas).toElement());

                        // Check if this result's path is indexed in Tags DB
                        if (DB_tag.datas.folders === undefined || !DB_tag.datas.folders.includes(this.path)) {
                            this.not_indexed_tags.push([this.path, DB_tag.datas.label]);

                            if (DB_tag.datas.folders === undefined) DB_tag.datas.folders = [];
                            DB_tag.datas.folders.push(this.path);

                            Tag.saveTagsDatas(this._section.tagsFilePath, this._section.getChildrenElem('.DB_tags_container .tagGroupContainer'));
                        }
                    }
                    // Tag doesn't exist in DB
                    else tags_container.appendChild(new Tag(tag_id, "Unknown tag", 'grey').toElement());
                });

                // prise en charge de la description
                if (lv_datas.description) {
                    this.description = lv_datas.description;
                    descriptionPicto.classList.add("displayed");
                }

                // Files and postis
                this.files = lv_datas.files;
                this.postits = lv_datas.postits;

                // On vérifie que tous les tags indexés pour ce result sont présents dans les données .lv chargées
                let indexed_tag_ids = this._section.get_indexed_tags_for_path(this.path);

                if (indexed_tag_ids) for (const tag_id of indexed_tag_ids) {

                    if (lv_datas.tags && lv_datas.tags.includes(tag_id.toString())) continue;

                    // Get the tag HTMLElement from DB
                    let DB_tag = this._section.get_DB_tag_elem(tag_id),
                        DB_tag_label = (DB_tag) ? DB_tag.datas.label : tag_id;

                    // Tag indexed in DB but not sotred in result's .lv file
                    new Notification("Le tag [ <span>" + DB_tag_label + "</span> ] est indéxé dans la DB mais n'est pas présent dans le résultat [ <span>" + path.join(ROOT_FOLDER, this.path) + "</span> ]",
                        {
                            type: 'alert',
                            persistent: true,
                            button1: {
                                label: "Ajouter le tag",
                                action: event => {
                                    // Tag exists in DB
                                    if (DB_tag) {
                                        tags_container.appendChild(new Tag(DB_tag.datas).toElement());

                                        this.storeLvDatas();
                                    }
                                }
                            },
                            button2: {
                                label: "Supprimer l'indexation",
                                action: event => {
                                    // Tag exists in DB
                                    if (DB_tag) {
                                        // Remove indexed path from tags DB
                                        if (DB_tag.datas.folders !== undefined) {
                                            let idx = DB_tag.datas.folders.indexOf(this.path);
                                            if (idx >= 0) {
                                                DB_tag.datas.folders.splice(idx, 1);
                                                if (DB_tag.datas.folders.length === 0) delete DB_tag.datas.folders;

                                                Tag.saveTagsDatas(this._section.tagsFilePath, this._section.getChildrenElem('.DB_tags_container .tagGroupContainer'));
                                            }
                                        }
                                    }
                                }
                            }
                        });
                }
            }
        }
    }

    delete_lv_datas_for_filetype() {
        try {
            let parentPath = path.dirname(this.path),
                parentLvDatas = Result.getLvDatas(path.join(ROOT_FOLDER, parentPath));

            if (parentLvDatas !== null) {
                if (parentLvDatas.files !== undefined && parentLvDatas.files[this.label] !== undefined) {

                    delete parentLvDatas.files[this.label];

                    if (Object.keys(parentLvDatas.files).length === 0) delete parentLvDatas.files;

                    fs.writeFileSync(path.join(ROOT_FOLDER, parentPath, '.lv'), JSON.stringify(parentLvDatas));
                }
            }
        } catch (err) {
            console.error(err);
            alert("Problème lors de la suppression des données LV");
        }
    }

    storeLvDatas() {
        var tagElems = this._element.querySelectorAll(".tag"),
            jsonDatas = { "tags": [] };

        tagElems.forEach(tagElem => { if (tagElem.dataset.id !== "") jsonDatas.tags.push(tagElem.dataset.id); });

        if (this.description !== "") {
            jsonDatas.description = this.description;
            this._element.querySelector(".descriptionPicto").classList.add("displayed");
        }
        else {
            this._element.querySelector(".descriptionPicto").classList.remove("displayed");
        }

        if (this.files) jsonDatas.files = this.files;
        if (this.postits) jsonDatas.postits = this.postits;

        // Write datas file
        try {
            // Write datas in folder's .lv file
            if (this.isDir) fs.writeFileSync(path.join(ROOT_FOLDER, this.path, '.lv'), JSON.stringify(jsonDatas));

            // Write file datas in parent folder's .lv file
            else if (jsonDatas.tags.length > 0 || jsonDatas.description || jsonDatas.files || jsonDatas.postits) {

                // let parentPath = path.resolve(this.path, '..'),
                let parentPath = path.dirname(this.path),
                    parentLvDatas = Result.getLvDatas(path.join(ROOT_FOLDER, parentPath));

                // Parent folder .lv file doesn't exist yet
                if (parentLvDatas === null) {

                    parentLvDatas = {
                        "tags": [],
                        "files": {}
                    }

                    parentLvDatas.files[this.label] = jsonDatas;

                    fs.writeFileSync(path.join(ROOT_FOLDER, parentPath, '.lv'), JSON.stringify(parentLvDatas));
                }
                // It already exists, just updating it
                else {
                    if (parentLvDatas.files === undefined) parentLvDatas.files = {};

                    parentLvDatas.files[this.label] = jsonDatas;

                    fs.writeFileSync(path.join(ROOT_FOLDER, parentPath, '.lv'), JSON.stringify(parentLvDatas));
                }
            }

            // Delete datas in parent folder's .lv file if necessary
            else this.delete_lv_datas_for_filetype();

        } catch (err) {
            console.error(err);
            alert("Problème lors de la sauvegarde du fichier " + path.join(ROOT_FOLDER, this.path) + '\\.lv');
        }
    }

    removeTag(tagId) {

        let tags_container = this._element.querySelector(".directoryTagsContainer"),
            tag_to_remove = this._element.querySelector(".tag[data-id='" + tagId + "']"),
            idx = -1;

        idx = Array.prototype.indexOf.call(tags_container.children, tag_to_remove);

        tag_to_remove.remove();

        this.storeLvDatas();

        // Remove indexed path from tags DB
        let DB_tag = this._section.get_DB_tag_elem(tagId);

        if (DB_tag && DB_tag.datas.folders !== undefined) {
            let idx = DB_tag.datas.folders.indexOf(this.path);
            if (idx >= 0) {
                DB_tag.datas.folders.splice(idx, 1);
                if (DB_tag.datas.folders.length === 0) delete DB_tag.datas.folders;

                Tag.saveTagsDatas(this._section.tagsFilePath, this._section.getChildrenElem('.DB_tags_container .tagGroupContainer'));
            }
        }

        Historia.add("Le tag a été supprimé", () => {

            let sibling = tags_container.children[idx];
            if (sibling) sibling.before(tag_to_remove);
            else tags_container.append(tag_to_remove);

            this.storeLvDatas();

            // Re-indexed path from tags DB
            let tagElem = this._section.get_DB_tag_elem(tagId);

            if (tagElem) {
                if (tagElem.datas.folders === undefined) tagElem.datas.folders = [];

                tagElem.datas.folders.push(this.path);

                Tag.saveTagsDatas(this._section.tagsFilePath, this._section.getChildrenElem('.DB_tags_container .tagGroupContainer'));
            }
        });
    }
};