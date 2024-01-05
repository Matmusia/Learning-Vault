const fs = require('fs'), path = require('path'),
    Result = require('./Result'),
    Tag = require('./Tag');

const Notification = require('./Notification');
const Historia = require('./Historia');

module.exports = class NotesResult extends Result {

    constructor(label, is_dir, dir_path, section) {
        super(section);

        // Create result element
        this._element = document.createElement("div");
        this._element.classList.add("result");
        this._element.title = path.join(ROOT_FOLDER, dir_path);
        this._element.label = label;
        this._element.path = dir_path;
        this._element.obj = this;

        // Icon
        var icon = document.createElement("img");
        icon.classList.add("icon");
        icon.setAttribute("src", "assets/images/note.svg");
        this._element.appendChild(icon);

        // Label
        var label_elem = document.createElement("p");
        label_elem.classList.add("label");
        label_elem.innerHTML = label;
        this._element.appendChild(label_elem);


        // Directory Tags container & tags
        let tags_container = document.createElement("p");
        tags_container.classList.add("directoryTagsContainer");
        this._element.appendChild(tags_container);

        if (is_dir && label !== "..") {
            // Ajout des bouttons
            let bt = document.createElement("img");
            bt.classList.add("button");
            bt.setAttribute("src", "assets/images/trashcan.svg");
            bt.dataset.action = "delete";
            this._element.insertBefore(bt, tags_container);

            // Process LV datas
            let lv_datas = Result.getLvDatas(path.join(ROOT_FOLDER, dir_path));
            if (lv_datas) {

                // Traitement du titre de la note
                label_elem.innerHTML = this._element.label = lv_datas.label;

                // Traitement de la description
                this._element.description = lv_datas.description || "";

                // Ajout des tags
                lv_datas.tags.forEach(tag_id => {
                    let DB_tag = this._section.get_DB_tag_elem(tag_id);

                    if (DB_tag) {
                        tags_container.appendChild(new Tag(DB_tag.datas).toElement());

                        if (!DB_tag.datas.folders.includes(dir_path)) {
                            new Notification("Le chemin [ " + dir_path + " ] n'est pas indéxé dans le tag [ " + DB_tag.datas.label + " ]\rC'est chose faite !", 'alert');
                            DB_tag.datas.folders.push(dir_path);
                            Tag.saveTagsDatas(this._section.tagsFilePath, this._section.getChildrenElem('.DB_tags_container .tagGroupContainer'));
                        }
                    }
                    else tags_container.appendChild(new Tag(tag_id, "Unknown tag", 'grey').toElement());
                });

                // On vérifie que tous les tags indexés pour ce result sont présents dans les données .lv chargées
                let indexed_tag_ids = this._section.get_indexed_tags_for_path(dir_path);

                if (indexed_tag_ids) for (const tag_id of indexed_tag_ids) {

                    if (lv_datas.tags && lv_datas.tags.includes(tag_id.toString())) continue;

                    // Get the tag HTMLElement from DB
                    let DB_tag = this._section.get_DB_tag_elem(tag_id),
                        DB_tag_label = (DB_tag) ? DB_tag.datas.label : tag_id;

                    // Tag indexed in DB but not sotred in result's .lv file
                    new Notification("Le tag [ <span>" + DB_tag_label + "</span> ] est indéxé dans la DB mais n'est pas présent dans le résultat [ <span>" + dir_path + "</span> ]",
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
                                            let idx = DB_tag.datas.folders.indexOf(dir_path);
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

    storeLvDatas() {
        var tagsElems = this._element.querySelectorAll(".tag"),
            jsonDatas = { "label": this._element.label, "tags": [] };

        // Tags
        tagsElems.forEach(tagElem => { if (tagElem.dataset.id !== "") jsonDatas.tags.push(tagElem.dataset.id); });

        // Description
        jsonDatas.description = this._element.description;

        // Write file
        try {
            fs.writeFileSync(path.join(ROOT_FOLDER, this._element.path, ".lv"), JSON.stringify(jsonDatas));
        } catch (err) {
            console.error(err);
            alert("Problème lors de la sauvegarde du fichier " + path.join(ROOT_FOLDER, this._element.path, ".lv"));
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
            let idx = DB_tag.datas.folders.indexOf(this._element.path);
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

                tagElem.datas.folders.push(this._element.path);

                Tag.saveTagsDatas(this._section.tagsFilePath, this._section.getChildrenElem('.DB_tags_container .tagGroupContainer'));
            }
        });
    }
};