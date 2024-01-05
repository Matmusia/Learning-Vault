const fs = require('fs'), path = require('path'),
    Result = require('./Result'),
    Tag = require('./Tag');

const Notification = require('./Notification');
const Historia = require('./Historia');

module.exports = class ExercicesResult extends Result {

    #label

    constructor(label, is_dir, dir_path, section) {
        super(section);

        // Create result element
        this._element = document.createElement("div");
        this._element.classList.add("result");
        this._element.title = path.join(ROOT_FOLDER, dir_path);
        this._element.obj = this;

        this._element.label = label;
        this._element.path = dir_path;
        this._element.description = "";

        // Icon
        var icon = document.createElement("img");
        icon.classList.add("icon");
        icon.setAttribute("src", "assets/images/exos.svg");
        this._element.appendChild(icon);

        // Checked
        var checked = document.createElement("img");
        checked.classList.add("checkedIcon");
        checked.setAttribute("src", "assets/images/checked.svg");
        this._element.appendChild(checked);

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

                let isDaly, isWeekly, isMonthly;

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
                            new Notification("Le chemin [ <span>" + dir_path + "</span> ] n'est pas indéxé dans le tag [ <span>" + DB_tag.datas.label + "</span> ]\rC'est chose faite !", "alert");
                            DB_tag.datas.folders.push(dir_path);

                            Tag.saveTagsDatas(this._section.tagsFilePath, this._section.getChildrenElem('.DB_tags_container .tagGroupContainer'));
                        }

                        switch (DB_tag.datas.label) {
                            case "Daily": isDaly = true; break;
                            case "Weekly": isWeekly = true; break;
                            case "Monthly": isMonthly = true; break;
                        }
                    }
                    else tags_container.appendChild(new Tag(tag_id, "Unknown tag", 'grey').toElement());
                });

                // Traitement du check
                if (lv_datas.checked) {
                    if (isDaly) {

                        var endOfPreviousDay = new Date();
                        endOfPreviousDay.setHours(3, 0, 0, 0); // La fin de la journée d'hier s'est terminé ce matin, à 3H

                        // Si le check est survenue après la fin de la journée d'hier, on garde le check
                        if (lv_datas.checkedTime > endOfPreviousDay.getTime()) {
                            this._element.classList.add("checked");
                            this._element.checkedTime = lv_datas.checkedTime;
                        }
                    }
                    else if (isWeekly) {
                        var endOfPreviousWeek = new Date();
                        endOfPreviousWeek.setDate(endOfPreviousWeek.getDate() - endOfPreviousWeek.getDay() + 1); // On règle sur lundi dernier
                        endOfPreviousWeek.setHours(3, 0, 0, 0); // à 3h du matin

                        // Si le check est survenue après la fin de la semaine dernière, on garde le check
                        if (lv_datas.checkedTime > endOfPreviousWeek.getTime()) {
                            this._element.classList.add("checked");
                            this._element.checkedTime = lv_datas.checkedTime;
                        }
                    }
                    else if (isMonthly) {
                        var endOfPreviousMonth = new Date();
                        endOfPreviousMonth.setDate(1); // On rèlge sur le premier jour du mois
                        endOfPreviousMonth.setHours(3, 0, 0, 0); // à 3h du matin

                        // Si le check est survenue après la fin de la dernière journée du mois précédent, on garde le check
                        if (lv_datas.checkedTime > endOfPreviousMonth.getTime()) {
                            this._element.classList.add("checked");
                            this._element.checkedTime = lv_datas.checkedTime;
                        }
                    }
                }

                // Traitement des timers
                this._element.timers = lv_datas.timers || [];

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
            jsonDatas = { "label": this._element.label, "tags": [], "timers": [] };

        // Checked
        if (this._element.classList.contains("checked")) {
            jsonDatas.checked = true;
            jsonDatas.checkedTime = this._element.checkedTime;
        }

        // Tags
        tagsElems.forEach(tagElem => { if (tagElem.dataset.id !== "") jsonDatas.tags.push(tagElem.dataset.id); });

        // Description
        jsonDatas.description = this._element.description;

        // update current timers data
        this._element.timers = [];
        var tmpTimerData;

        this._section.getChildrenElem(".timersContainer .timer").forEach(timerElem => {
            tmpTimerData = { 'label': timerElem.obj.getLabel(), 'duration': timerElem.obj.getDuration(), 'repetitions': timerElem.obj.getRepetitions() };
            jsonDatas.timers.push(tmpTimerData);
            this._element.timers.push(tmpTimerData);
        });

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