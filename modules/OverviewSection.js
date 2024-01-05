const { log } = require('console');
const fs = require('fs'), path = require('path');
const https = require('node:https');
const Notification = require('./Notification');
const Timer = require('./Timer');

module.exports = class OverviewSection {
    _rootElement

    #authorization_key

    datasFilePath

    pinsList
    board_sections
    selected_sections

    constructor(datasFilePath) {

        this.datasFilePath = datasFilePath;

        this._rootElement = document.createElement("div");
        this._rootElement.classList.add("sectionContainer");
        this._rootElement.classList.add("overview");
        this._rootElement.innerHTML = this._loadSectionHtmlContent(__dirname + "/OverviewSection.html");
        this._rootElement.addEventListener("dragover", event => event.preventDefault());

        this._registerEventHandlers();
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

    _registerEventHandlers() {
        // Click sur un boutton de la page
        this._rootElement.querySelectorAll(".button").forEach(bt => bt.addEventListener("click", (event) => {
            event.stopImmediatePropagation();

            if (this._rootElement.querySelector(".pinterest").classList.contains("loading")) {
                console.log("nope");
                return;
            }

            let target = event.target.closest(".button");

            switch (target.dataset.action) {
                case 'updatePinsList':
                    this.update_pins_list();
                    break;

                case 'getRandomImage':
                    if (this._rootElement.querySelector(".pinterest").classList.contains("unloaded")) this.update_pins_list();
                    else if (event.target.closest('.sections_selector') === null) this.getRandomImage();
                    break;

                case 'select_all':
                    for (const elem of this._rootElement.querySelectorAll(".pinterest .sections_selector .section")) elem.classList.add('selected');

                    this.selected_sections = [];
                    for (const elem of this._rootElement.querySelectorAll(".pinterest .sections_selector .section.selected")) this.selected_sections.push(elem.dataset.id);

                    localStorage.setItem("selected_sections", JSON.stringify(this.selected_sections));
                    break;

                case 'select_none':
                    for (const elem of this._rootElement.querySelectorAll(".pinterest .sections_selector .section")) elem.classList.remove('selected');

                    this.selected_sections = [];
                    for (const elem of this._rootElement.querySelectorAll(".pinterest .sections_selector .section.selected")) this.selected_sections.push(elem.dataset.id);

                    localStorage.setItem("selected_sections", JSON.stringify(this.selected_sections));
                    break;

                case 'select_section':
                    target.classList.toggle('selected');

                    this.selected_sections = [];
                    for (const elem of this._rootElement.querySelectorAll(".pinterest .sections_selector .section.selected")) this.selected_sections.push(elem.dataset.id);

                    localStorage.setItem("selected_sections", JSON.stringify(this.selected_sections));
                    break;

                case 'open_timer':
                    var timer = new Timer('Pinterest session');
                    timer.openTimerInWindow();
                    break;

                default:
                    console.log("Button action unknown", target.dataset.action);
                    break;
            }
        }));
    }

    async #pinterest_api_call(url) {

        const response = await fetch(url,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + this.#authorization_key
                }
            });

        const datas = await response.json();

        if (!response.ok) throw new Error(datas.message);

        return datas;
    }

    update_pins_list() {
        this._rootElement.querySelector(".pinterest").classList.add("unloaded");
        this._rootElement.querySelector(".pinterest").classList.add("loading");
        this._rootElement.querySelector(".pinterest img").setAttribute("src", "assets/images/pinterest_grey.svg");
        this._rootElement.querySelector(".pinterest .pinsNumber").innerHTML = "";

        this.#authorization_key = this._rootElement.querySelector(".pinterest .authorization_key").innerText;
        localStorage.setItem("authorization_key", this.#authorization_key);

        // Get board sections
        this.board_sections = {};

        this.#pinterest_api_call("https://api.pinterest.com/v5/boards/798474277624357946/sections?page_size=250")

            .then(datas => {

                this.selected_sections = [];

                for (const section_datas of datas.items) {
                    this.board_sections[section_datas.id] = section_datas.name;
                    this.selected_sections.push(section_datas.id);
                }

                let sections_selector = this._rootElement.querySelector(".pinterest .sections_selector");

                sections_selector.innerHTML = '<div class="buttons"><p class="button" data-action="select_all">Tous</p><p class="button" data-action="select_none">Aucun</p></div>';

                for (const section_id in this.board_sections) {
                    sections_selector.innerHTML += '<p class="button section selected" data-action="select_section" data-id="' + section_id + '">' + this.board_sections[section_id] + '</p>';
                }

                sections_selector.innerHTML += '<div class="authorization_key" contenteditable>' + this.#authorization_key + '</div>';

                this.pinsList = [];

                let base_url = "https://api.pinterest.com/v5/boards/798474277624357946/pins?page_size=250";

                // Get pins
                this.#pinterest_api_call(base_url)

                    .then(async datas => {

                        for (const item of datas.items) if (item.media.media_type === "image") this.pinsList.push({ section_id: item.board_section_id, url: item.media.images['1200x'].url });

                        // Keep loading pins if necessary
                        while (datas.bookmark !== null) {
                            datas = await this.#pinterest_api_call(base_url + "&bookmark=" + datas.bookmark);

                            for (const item of datas.items) if (item.media.media_type === "image") this.pinsList.push({ section_id: item.board_section_id, url: item.media.images['1200x'].url });
                        }

                        localStorage.setItem("pinsListLastUpdate", Date.now());
                        localStorage.setItem("board_sections", JSON.stringify(this.board_sections));
                        localStorage.setItem("selected_sections", JSON.stringify(this.selected_sections));
                        localStorage.setItem("pinsList", JSON.stringify(this.pinsList));

                        this._rootElement.querySelector(".pinterest").classList.remove("unloaded");
                        this._rootElement.querySelector(".pinterest").classList.remove("loading");
                        this._rootElement.querySelector(".pinterest img").setAttribute("src", "assets/images/pinterest.svg");
                        this._rootElement.querySelector(".pinterest .pinsNumber").innerHTML = this.pinsList.length;
                    })

                    .catch(error => {
                        console.error(error);
                        new Notification("Pinterest API call error : " + error.message, { type: 'warning' });

                        this._rootElement.querySelector(".pinterest").classList.remove("loading");
                    });
            })

            .catch(error => {
                console.error(error);
                new Notification("Pinterest API call error : " + error.message, { type: 'warning' });

                this._rootElement.querySelector(".pinterest").classList.remove("loading");
            });
    }

    getRandomImage() {

        if (this.selected_sections.length === 0) return;

        let filtred_pins_list = this.pinsList.filter(item => { return this.selected_sections.includes(item.section_id); });

        let randomItemURL = filtred_pins_list[Math.floor(Math.random() * filtred_pins_list.length)].url,
            tempFilePath = "C:/Users/Matmusia/AppData/Local/Temp/LV_temp_img.jpg"

        const file = fs.createWriteStream(tempFilePath);
        const request = https.get(randomItemURL, function (response) {
            response.pipe(file);

            // after download completed close filestream
            file.on("finish", () => {
                file.close();

                require("child_process").execFile("python.exe", ["./external/photoshop_addAsLayer.pyw", tempFilePath], (error, stdout, stderr) => {
                    if (error) console.log(error);
                    // else console.log(stdout);
                });
            });
        });
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

    setupPinterestButton() {

        if (localStorage.getItem("board_sections") !== null) {
            try {
                this.board_sections = JSON.parse(localStorage.getItem("board_sections"));
                this.pinsList = JSON.parse(localStorage.getItem("pinsList"));
                this.selected_sections = JSON.parse(localStorage.getItem("selected_sections"));
                this.#authorization_key = localStorage.getItem("authorization_key");

                let sections_selector = this._rootElement.querySelector(".pinterest .sections_selector");

                sections_selector.innerHTML = '<div class="buttons"><p class="button" data-action="select_all">Tous</p><p class="button" data-action="select_none">Aucun</p></div>';

                for (const section_id in this.board_sections) {
                    let selected_class = this.selected_sections.includes(section_id) ? ' selected' : '';
                    sections_selector.innerHTML += '<p class="button section' + selected_class + '" data-action="select_section" data-id="' + section_id + '">' + this.board_sections[section_id] + '</p>';
                }

                sections_selector.innerHTML += '<div class="authorization_key" contenteditable>' + this.#authorization_key + '</div>';

                this._rootElement.querySelector(".pinterest").classList.remove("unloaded");
                this._rootElement.querySelector(".pinterest img").setAttribute("src", "assets/images/pinterest.svg");
                this._rootElement.querySelector(".pinterest .pinsNumber").innerHTML = this.pinsList.length;
            }
            catch (error) {
                console.error(error);
                localStorage.removeItem("pinsListLastUpdate");
                localStorage.removeItem("board_sections");
                localStorage.removeItem("selected_sections");
                localStorage.removeItem("pinsList");
                this.pinsList = null;
            }
        }
    }

    updateDatas() {
        try {
            // TODO is this usefull ?
            let datas = fs.readFileSync(this.datasFilePath, 'utf8');
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la lecture du fichier '" + this.datasFilePath + "'");
            return "";
        }
    }

    display() {
        // localStorage.removeItem("pinsList");
        // localStorage.removeItem("boardSections");
        // localStorage.removeItem("pinsListLastUpdate");

        var displayed = document.body.querySelector(".sectionContainer.displayed");
        if (displayed) displayed.classList.remove("displayed");
        this._rootElement.classList.add("displayed");

        var SectionSelector = document.getElementById("sectionSelector");
        SectionSelector.querySelector(".tab.selected").classList.remove("selected");
        SectionSelector.querySelector(".tab.overview").classList.add("selected");

        // Check pinterest pins list
        this.setupPinterestButton();

        // Overview data file
        this.updateDatas();

        contextHasChanged(null);
    }
}