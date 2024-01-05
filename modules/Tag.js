const fs = require('fs'), path = require('path');

module.exports = class Tag {

    static #tags_DB = {}

    static draggedTag = null

    static load_tags_DB(tags_file_path, force_update) {

        if (this.#tags_DB[tags_file_path] === undefined || force_update === true) {
            try {
                this.#tags_DB[tags_file_path] = JSON.parse(fs.readFileSync(tags_file_path, 'utf8'));
                return this.#tags_DB[tags_file_path];
            } catch (err) {

                console.error(err);
                alert("Erreur lors de la lecture du fichier '" + tags_file_path + "'");
                return [];
            }
        }
        else return this.#tags_DB[tags_file_path];
    }

    static saveTagsDatas(tagsFilePath, tagsGroupContainers) {

        var jsonDatas = { "groups": [] },
            tagsGroupDatas,
            tagDatas;

        tagsGroupContainers.forEach(tagsGroupContainer => {
            tagsGroupDatas = { "label": tagsGroupContainer.dataset.label, "tags": [] };

            if (tagsGroupContainer.dataset.bgColor !== undefined) tagsGroupDatas.bgColor = tagsGroupContainer.dataset.bgColor;
            if (tagsGroupContainer.dataset.txtColor !== undefined) tagsGroupDatas.txtColor = tagsGroupContainer.dataset.txtColor;

            tagsGroupContainer.querySelectorAll('.tag').forEach(tagElem => {
                tagDatas = { 'id': tagElem.datas.id, 'label': tagElem.datas.label };
                if (tagElem.datas.bgColor !== undefined) tagDatas.bgColor = tagElem.datas.bgColor;
                if (tagElem.datas.txtColor !== undefined) tagDatas.txtColor = tagElem.datas.txtColor;
                if (tagElem.datas.folders !== undefined) tagDatas.folders = tagElem.datas.folders;
                if (tagElem.datas.postits !== undefined) tagDatas.postits = tagElem.datas.postits;

                tagsGroupDatas.tags.push(tagDatas);
            });

            jsonDatas.groups.push(tagsGroupDatas);
        });

        try {
            fs.writeFileSync(tagsFilePath, JSON.stringify(jsonDatas));
        } catch (err) {
            // console.error(err);
            alert("Problème lors de la sauvegarde du fichier " + tagsFilePath + "");
        }
    }

    #element

    id

    constructor(tagDatas, isForSearch) {
        this.#element = document.createElement("div");
        this.#element.classList.add("tag");
        this.#element.setAttribute("draggable", true);
        this.#element.innerHTML = tagDatas.label;
        this.#element.dataset.id = this.id = tagDatas.id;
        this.#element.datas = tagDatas;
        this.#element.obj = this;

        // Custom background color
        if (tagDatas.bgColor) this.#element.style.backgroundColor = tagDatas.bgColor;
        else if (tagDatas.inheritedBgColor) this.#element.style.backgroundColor = tagDatas.inheritedBgColor;

        // Custom text color
        if (tagDatas.txtColor) this.#element.style.color = tagDatas.txtColor;
        else if (tagDatas.inheritedTxtColor) this.#element.style.color = tagDatas.inheritedTxtColor;

        // Drag and drop events handler
        this.#element.addEventListener("dragstart", event => {
            event.dataTransfer.dropEffect = "copy";
            event.dataTransfer.setData("dragType", "tag");
            event.dataTransfer.setData("source", this.#element.closest(".sectionContainer").classList);
            Tag.draggedTag = this;
            document.body.classList.add("draggingTag");
        });
        this.#element.addEventListener("dragover", event => event.preventDefault());
        this.#element.addEventListener("dragend", event => {
            Tag.draggedTag = null
            document.body.classList.remove("draggingTag");
        });

        // Tag Element is for the search indicator bottom page
        if (isForSearch) {
            // notInButton
            var notInButton = document.createElement("img");
            notInButton.classList.add("notInButton");
            notInButton.setAttribute("src", "assets/images/minus.svg");

            this.#element.append(notInButton);

            // Stroke
            var stroke = document.createElement("span");
            stroke.classList.add("stroke");

            this.#element.prepend(stroke);
        }
    }

    toElement() { return this.#element; }
};