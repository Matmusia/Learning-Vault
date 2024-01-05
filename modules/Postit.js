const Historia = require('./Historia');
const PostitSection = require('./PostitSection');

const fs = require('fs'), fsp = fs.promises, path = require('path'),
    Tag = require('./Tag'), Notification = require('./Notification');

module.exports = class Postit {

    static draggedPostit = null

    static async get_full_lv_datas(lv_file_path) {
        let file_datas = await fsp.readFile(path.join(ROOT_FOLDER, lv_file_path), 'utf8')
            .catch(error => {
                if (error.code === 'ENOENT') return "{}";
                else throw new Error(error);
            });

        try { return JSON.parse(file_datas); }
        catch (error) { throw new Error(error); }
    }

    #section

    uid
    parent_path
    parent_is_file
    time_stamp
    bgcolor

    #is_saving = false
    #save_asked_during_save = false
    #deletion_asked = false

    #element

    constructor(datas, section) {
        this.#section = section;

        this.#element = document.createElement("div");
        this.#element.classList.add("grid_item");
        this.#element.classList.add("postit");
        this.#element.setAttribute("draggable", true);

        this.#element.obj = this;

        this.uid = datas.uid;
        this.parent_path = datas.parent_path;
        this.parent_is_file = datas.parent_is_file;
        this.time_stamp = datas.time_stamp;

        if (datas.time_stamp) this.#element.classList.add("linked");
        if (datas.bgcolor) {
            this.#element.classList.add(datas.bgcolor);
            this.bgcolor = datas.bgcolor;
        }

        this.#element.innerHTML = "<div class='content' contenteditable='true' draggable='true'>" + datas.content + "</div>"
            + "<div class='overflowed_indicator'>...</div>"
            + "<div class='bottom_bar'>"
            + "<div class='tags_container'></div>"
            + "<div class='buttons'><img class='button_bgcolor' src='assets/images/colors.svg' /><img class='button_delete' src='assets/images/trashcan.svg' /><div class='color_picker'></div></div>"
            + "</div>"
            + "<img class='button_linked' src='assets/images/linked_file.svg' />";

        // Color picker
        let colorPicker = this.#element.querySelector(".color_picker");

        colorPicker.innerHTML += "<div class='color none'><img src='assets/images/no-color.svg' /></div>"
            + "<div class='color coral'></div>"
            + "<div class='color peach'></div>"
            + "<div class='color sand'></div>"
            + "<div class='color mint'></div>"
            + "<div class='color sage'></div>"
            + "<div class='color mist'></div>"
            + "<div class='color storm'></div>"
            + "<div class='color dusk'></div>"
            + "<div class='color pinkcoral'></div>"
            + "<div class='color clay'></div>"
            + "<div class='color pebble'></div>";

        // Add tags
        let DB_tag_elem,
            tags_container = this.#element.querySelector(".tags_container");

        if (datas.tags) for (const tag_id of datas.tags) {
            DB_tag_elem = section.getChildElem('.DB_tags_container .tag[data-id="' + tag_id + '"]');

            if (DB_tag_elem) {
                tags_container.appendChild(new Tag(DB_tag_elem.datas).toElement());

                // Check if tag is indexed in database
                // - Look for this post-it record in tags DB
                let idx = (DB_tag_elem.datas.postits === undefined) ? -1 : DB_tag_elem.datas.postits.findIndex(item => { if (item.uid === this.uid) return true; else return false; });

                if (idx === -1) {
                    new Notification("Le Post-it [ " + this.uid + " ] n'est pas indéxé dans le tag [ " + DB_tag_elem.datas.label + " ]\rC'est chose faite !", { type: 'alert' });

                    if (DB_tag_elem.datas.postits === undefined) DB_tag_elem.datas.postits = [];
                    DB_tag_elem.datas.postits.push({
                        uid: this.uid,
                        "parent_path": this.parent_path,
                        "parent_is_file": this.parent_is_file
                    });

                    Tag.saveTagsDatas(this.#section.tagsFilePath, this.#section.getChildrenElem('.DB_tags_container .tagGroupContainer'));
                }
            }
            else tags_container.appendChild(new Tag(tag_id, "Unknown tag", 'grey').toElement());
        }

        // Saving indicator
        this._saving_indicator = document.createElement("div");
        this._saving_indicator.classList.add("saving_indicator");
        this._saving_indicator.innerHTML = "<img src='assets/images/loading.svg' />";

        this.#element.appendChild(this._saving_indicator);

        // Drag and drop events handler
        // Prevent dragging when you just want to select .content text
        this.#element.querySelector('.content').addEventListener('dragstart', event => { event.preventDefault(); event.stopImmediatePropagation(); });

        this.#element.addEventListener("dragstart", event => {

            if (typeof event.target.closest !== 'function') return;

            if (event.target.closest(".tag")) {
                event.stopPropagation();
            }
            else if (event.target.classList.contains("postit") && !this.#section.tag_search_in_progress) {
                event.dataTransfer.effectAllowed = "move";
                // event.dataTransfer.dropEffect = "none";
                event.dataTransfer.setData("dragType", "postit");
                Postit.draggedPostit = this;
                // document.body.classList.add("draggingPostit");
            }
            else {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        });

        this.#element.addEventListener("dragenter", event => {
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);

        this.#element.addEventListener("dragover", event => {
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);

        this.#element.addEventListener("dragleave", event => {
            event.stopImmediatePropagation();
        }, true);

        this.#element.addEventListener("drop", event => {
            if (event.dataTransfer.getData("dragType") === 'postit') {
                event.preventDefault();
                event.stopImmediatePropagation();

                let target = event.target.closest(".postit");

                if (target) target.obj.addPostitBefore(Postit.draggedPostit);
            }
            else if (event.dataTransfer.getData("dragType") === 'tag') {

                // filter tag source (accept only from postits section)
                if (!event.dataTransfer.getData("source").includes("postits")) return;

                console.log("drop tag on post-it");

                let droppedTag = Tag.draggedTag.toElement(),
                    postit = event.target.closest(".postit"),
                    targetTag;

                if (postit) {
                    let newTagElem = new Tag(droppedTag.datas).toElement(),
                        tagsContainerTarget = postit.querySelector(".tags_container");

                    // Check if tag is already present in result
                    var sameTag = tagsContainerTarget.querySelector(".tag[data-id='" + droppedTag.dataset.id + "']");

                    // Drop on other tag
                    if (targetTag = event.target.closest(".tag")) {
                        if (sameTag) targetTag.before(sameTag);
                        else targetTag.before(newTagElem);
                    }
                    // Drop elsewhere
                    else {
                        if (sameTag) tagsContainerTarget.append(sameTag);
                        else tagsContainerTarget.append(newTagElem);
                    }

                    this.saveDatas();

                    // A new tag has been added
                    if (sameTag === null) {

                        let DB_tag_elem = this.#section.getChildElem(".DB_tags_container .tag[data-id='" + droppedTag.dataset.id + "']");
                        if (DB_tag_elem.datas.postits === undefined) DB_tag_elem.datas.postits = [];
                        DB_tag_elem.datas.postits.push({
                            uid: this.uid,
                            parent_path: this.parent_path,
                            parent_is_file: this.parent_is_file
                        });

                        Tag.saveTagsDatas(this.#section.tagsFilePath, this.#section.getChildrenElem('.DB_tags_container .tagGroupContainer'));
                    }
                }
            }
        }, true);

        this.#element.addEventListener("dragend", event => {
            // console.log("end");
            Postit.draggedPostit = null
            document.body.classList.remove("draggingPostit");
        });
    }

    get_datas() {
        const datas = { uid: this.uid, content: this.#element.querySelector(".content").innerHTML };

        datas.tags = [];
        if (this.bgcolor) datas.bgcolor = this.bgcolor;
        if (this.time_stamp) datas.time_stamp = this.time_stamp;

        this.#element.querySelectorAll(".tags_container .tag").forEach(tagElem => { datas.tags.push(tagElem.dataset.id); });

        return datas;
    }

    get_lv_file_path() {
        let lv_file_path = (this.parent_is_file) ? path.dirname(this.parent_path) : this.parent_path;
        return path.join(lv_file_path, '.lv');
    }

    removeTag(tagId) {
        let tagToRemove = this.#element.querySelector(".tag[data-id='" + tagId + "']");

        if (confirm("Le tag [ " + tagToRemove.datas.label + " ] sera supprimé du post-it. Continuer ?")) {
            tagToRemove.remove();

            this.saveDatas();

            // Remove path from tag datas base
            let DB_tag_elem = this.#section.get_DB_tag_elem(tagId);

            if (DB_tag_elem && DB_tag_elem.datas.postits !== undefined) {
                let idx = DB_tag_elem.datas.postits.findIndex(item => { if (item.parent_path === this.parent_path) return true; else return false; });
                if (idx >= 0) {
                    DB_tag_elem.datas.postits.splice(idx, 1);
                    if (DB_tag_elem.datas.postits.length === 0) delete DB_tag_elem.datas.postits;

                    Tag.saveTagsDatas(this.#section.tagsFilePath, this.#section.getChildrenElem('.DB_tags_container .tagGroupContainer'));
                }
            }
        }
    }

    async saveDatas(save_after_uid) {
        if (this.#is_saving) this.#save_asked_during_save = true;
        else {
            this.#is_saving = true;
            this.#element.classList.add("saving");

            const datas_to_save = this.get_datas();

            // Get storing .lv datas
            await Postit.get_full_lv_datas(this.get_lv_file_path())

                // Update .lv datas with this post-it datas
                .then((lv_datas) => {

                    if (lv_datas.postits === undefined) lv_datas.postits = [];

                    let targted_postit_datas = lv_datas.postits;

                    if (this.parent_is_file) {
                        let filename = path.basename(this.parent_path);

                        if (lv_datas.files === undefined) lv_datas.files = {};

                        if (lv_datas.files[filename] === undefined) lv_datas.files[filename] = { postits: [] };
                        else if (lv_datas.files[filename].postits === undefined) lv_datas.files[filename].postits = [];

                        targted_postit_datas = lv_datas.files[filename].postits;
                    }

                    // Le post-it doit être placé après un autre Post-it
                    if (save_after_uid) {
                        if (save_after_uid === -1) {
                            targted_postit_datas.unshift(datas_to_save);
                        }
                        else {
                            let found = false;
                            for (const idx in targted_postit_datas) {
                                if (targted_postit_datas[idx].uid === save_after_uid) {
                                    targted_postit_datas.splice(parseInt(idx) + 1, 0, datas_to_save);
                                    found = true;
                                    break;
                                }
                            }

                            if (found === false) alert("Problème lors de la mise à jour du post-it.\nL'UID du Post-it précédent fourni (" + this.uid + ") n'existe pas.");
                        }
                    }
                    // Le Post-it doit être enregistré à sa place
                    else if (this.uid) {
                        let found = false;
                        for (const idx in targted_postit_datas) {
                            if (targted_postit_datas[idx].uid === this.uid) {
                                targted_postit_datas[idx] = datas_to_save;
                                found = true;
                                break;
                            }
                        }

                        if (found === false) alert("Problème lors de la mise à jour du post-it.\nL'UID fourni (" + this.uid + ") n'existe pas.");
                    }
                    // Le Post-it n'existe pas encore
                    else {
                        this.uid = datas_to_save.uid = generateID();
                        targted_postit_datas.unshift(datas_to_save);
                    }

                    return lv_datas;
                })

                // Write back the storing .lv file
                .then(async (lv_datas) => {

                    let lv_file_path = this.get_lv_file_path();

                    await fsp.writeFile(path.join(ROOT_FOLDER, lv_file_path), JSON.stringify(lv_datas)).catch(error => { throw new Error(error); });
                })

                // Save is completed !
                .then(async () => {

                    this.#is_saving = false;

                    if (this.#deletion_asked) {
                        this.#deletion_asked = false;
                        this.delete();
                    }
                    else if (this.#save_asked_during_save) {
                        this.#save_asked_during_save = false;
                        await this.saveDatas();
                    }
                    else {
                        this.#element.classList.remove("saving");
                    }
                })
                .catch(error => { alert(error); console.error(error); });
        }
    }

    addPostitBefore(postit_to_add) {

        if (postit_to_add === this) return;

        let source_lv_file_path = postit_to_add.get_lv_file_path(),
            target_lv_file_path = this.get_lv_file_path(),

            source_lv_datas, target_lv_datas;

        // On récupère les données .lv du target
        Postit.get_full_lv_datas(target_lv_file_path).then((lv_datas) => { target_lv_datas = lv_datas; })

            // On récupère les données .lv de la source
            .then(async () => {

                // Si la destination du postit et son origine sont stockées dans des fichiers .lv différents
                if (source_lv_file_path !== target_lv_file_path) {

                    source_lv_datas = await Postit.get_full_lv_datas(source_lv_file_path)
                        .catch(error => { throw new Error(error) });
                }

                // Sinon, s'il s'agit du même fichiers
                else {
                    source_lv_datas = target_lv_datas;
                }
            })

            // On modifie les données des .lv
            .then(() => {

                // Modification des données de la sources
                // -> On supprime le post-it de son point de départ
                if (postit_to_add.parent_is_file) {
                    let parent_file_name = path.basename(postit_to_add.parent_path);

                    if (source_lv_datas.files[parent_file_name] === undefined) throw new Error("L'entrée [" + parent_file_name + "] n'a pas été trouvée dans la liste des fichiers");

                    for (const idx in source_lv_datas.files[parent_file_name].postits) {
                        if (postit_to_add.uid === source_lv_datas.files[parent_file_name].postits[idx].uid) {
                            source_lv_datas.files[parent_file_name].postits.splice(parseInt(idx), 1);
                            break;
                        }
                    }
                }
                else {
                    for (const idx in source_lv_datas.postits) {
                        if (source_lv_datas.postits[idx].uid === postit_to_add.uid) {
                            source_lv_datas.postits.splice(parseInt(idx), 1);
                            break;
                        }
                    }
                }

                // Modifications des données de la destination
                // -> On l'ajoute à son point d'arrivée
                if (this.parent_is_file) {
                    let parent_file_name = path.basename(this.parent_path);

                    if (target_lv_datas.files[parent_file_name] === undefined) throw new Error("L'entrée [" + parent_file_name + "] n'a pas été trouvée dans la liste des fichiers");

                    for (const idx in target_lv_datas.files[parent_file_name].postits) {
                        if (this.uid === target_lv_datas.files[parent_file_name].postits[idx].uid) {
                            target_lv_datas.files[parent_file_name].postits.splice(parseInt(idx), 0, postit_to_add.get_datas());
                            break;
                        }
                    }
                }
                else {
                    for (const idx in target_lv_datas.postits) {
                        if (this.uid === target_lv_datas.postits[idx].uid) {
                            target_lv_datas.postits.splice(parseInt(idx), 0, postit_to_add.get_datas());
                            break;
                        }
                    }
                }
            })

            // On sauvegarde les modifications du fichier .lv de destination
            .then(async () => {

                await fsp.writeFile(path.join(ROOT_FOLDER, target_lv_file_path), JSON.stringify(target_lv_datas))
                    .catch(error => { throw new Error(error); });
            })

            // On sauvegarde les modifications du fichier .lv source si necessaire
            .then(async () => {
                if (source_lv_file_path !== target_lv_file_path) await fsp.writeFile(path.join(ROOT_FOLDER, source_lv_file_path), JSON.stringify(source_lv_datas))
                    .catch(error => { throw new Error(error); });
            })

            // On modifie le DOM & les attributs du post-it déplacé (on adopte ceux du post-it target)
            .then(() => {
                this.#element.before(postit_to_add.toElement());

                postit_to_add.parent_path = this.parent_path;
                postit_to_add.parent_is_file = this.parent_is_file;
            })
            .catch(error => { alert(error); console.error(error); });
    }

    delete() {

        if (this.#is_saving) {
            this.#deletion_asked = true;
            return;
        }

        let previous_sibling = this.#element.previousElementSibling,
            previous_postit_uid = -1;

        if (previous_sibling && previous_sibling.classList && previous_sibling.classList.contains('postit'))
            previous_postit_uid = previous_sibling.obj.uid;

        Historia.add("Le post-it a été supprimé", () => {

            this.saveDatas(previous_postit_uid).catch(error => { alert("Une erreur est survenue lors de l'annulation.\nLe post-it à été affiché à nouveau, mais pas enregistré."); });

            for (const tag_element of this.#element.querySelectorAll('.tags_container .tag')) {

                let DB_tag_elem = this.#section.getChildElem('.DB_tags_container .tag[data-id="' + tag_element.datas.id + '"]');

                if (DB_tag_elem.datas.postits === undefined) DB_tag_elem.datas.postits = [];

                DB_tag_elem.datas.postits.push({
                    uid: this.uid,
                    "parent_path": this.parent_path,
                    "parent_is_file": this.parent_is_file
                });
            }

            Tag.saveTagsDatas(this.#section.tagsFilePath, this.#section.getChildrenElem('.DB_tags_container .tagGroupContainer'));

            let is_in_context = false,
                context_to_compare_with = (this.parent_is_file) ? path.dirname(this.parent_path) : this.parent_path;

            if (this.#section.explore_sub_folders === true && context_to_compare_with.includes(CURRENT_CONTEXT)) is_in_context = true;
            else if (CURRENT_CONTEXT === context_to_compare_with) is_in_context = true;

            if (this.#section.datas_loading_in_progress === false && is_in_context) {
                this.toElement().removeAttribute("style");

                let container = this.#section.fill_container_up_to_path(this.#section.display_container, path.relative(this.#section._root_path, this.parent_path).split('\\'), this.parent_is_file);

                let found = false;

                if (previous_postit_uid) {

                    for (const postit of container.children) {

                        if (postit.classList.contains('postit') && postit.obj.uid === previous_postit_uid) {
                            postit.after(this.toElement());
                            found = true;
                            break;
                        }
                    }
                }

                if (found === false) {
                    if (container.firstChild.classList.contains('level_container')) container.firstChild.before(this.toElement());
                    else container.firstChild.after(this.toElement());
                }
            }
        });

        this.#element.remove();

        // Get storing .lv datas
        Postit.get_full_lv_datas(this.get_lv_file_path())

            // Update .lv datas to remove post-it
            .then((lv_datas) => {
                if (this.parent_is_file) {
                    let filename = path.basename(this.parent_path);

                    if (lv_datas.files === undefined || lv_datas.files[filename] === undefined) return // Nothing more to do

                    if (this.uid) {
                        let done = false;
                        for (const idx in lv_datas.files[filename].postits) {
                            if (lv_datas.files[filename].postits[idx].uid === this.uid) {
                                lv_datas.files[filename].postits.splice(parseInt(idx), 1);
                                done = true;
                            }
                        }

                        if (done === false) alert("Problème lors de la mise à jour du post-it.\nL'UID fourni (" + this.uid + ") n'existe pas.");
                    }
                    else { } // This shouldn't happen, if you can delete it, it has a UID
                }
                else {
                    if (lv_datas.postits === undefined) return // Nothing more to do

                    if (this.uid) {
                        let done = false;
                        for (const idx in lv_datas.postits) {
                            if (lv_datas.postits[idx].uid === this.uid) {
                                lv_datas.postits.splice(parseInt(idx), 1);
                                done = true;
                            }
                        }

                        if (done === false) alert("Problème lors de la suppression du post-it.\nL'UID fourni (" + this.uid + ") n'existe pas.");
                    }
                    else { } // This shouldn't happen, if you can delete it, it has a UID
                }

                return lv_datas;
            })

            // Write back the datas into the .lv file
            .then(async lv_datas => {
                let lv_file_path = this.get_lv_file_path();

                await fsp.writeFile(path.join(ROOT_FOLDER, lv_file_path), JSON.stringify(lv_datas))
                    .catch(error => { console.error(error); alert("Problème lors de la sauvegarde du fichier " + path.join(ROOT_FOLDER, lv_file_path)); });
            })

            // Remove post-it path from tags DB
            .then(() => {
                for (const tag_element of this.#element.querySelectorAll('.tags_container .tag')) {

                    let DB_tag_elem = this.#section.get_DB_tag_elem(tag_element.datas.id);

                    if (DB_tag_elem && DB_tag_elem.datas.postits !== undefined) {
                        let idx = DB_tag_elem.datas.postits.findIndex(item => { if (item.parent_path === this.parent_path) return true; else return false; });
                        if (idx >= 0) {
                            DB_tag_elem.datas.postits.splice(idx, 1);
                            if (DB_tag_elem.datas.postits.length === 0) delete DB_tag_elem.datas.postits;
                        }
                    }
                }

                Tag.saveTagsDatas(this.#section.tagsFilePath, this.#section.getChildrenElem('.DB_tags_container .tagGroupContainer'));
            })

            .catch(error => { alert(error); console.error(error); });
    }

    toElement() { return this.#element; }
}