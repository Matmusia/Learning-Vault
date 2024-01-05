const fs = require('fs'), fsp = require('fs/promises'), path = require('path'),
    Tag = require('./Tag'),
    Section = require("./Section"),
    Result = require("./Result"),
    Postit = require("./Postit"),

    Notification = require("./Notification");

const MediumEditor = require("../external/medium-editor/dist/js/medium-editor");

module.exports = class PostitSection extends Section {

    /**@type {PostitSection} */
    static #section

    static display_new_post_floating_form(context, is_file, time_stamp) {

        // Setup floating form
        let postit_floating_form = document.createElement('div');
        postit_floating_form.classList.add('postit');
        postit_floating_form.classList.add('postit_floating_form');

        postit_floating_form.innerHTML = "<div class='content' contenteditable='true'><p>Nouveau post-it</p></div>"
            + "<div class='bottom_bar'>"
            + "<div class='buttons'><img class='button_bgcolor' src='assets/images/colors.svg' /><img class='button_save' src='assets/images/save.svg' /><img class='button_delete' src='assets/images/trashcan.svg' /><div class='color_picker'></div></div>"
            + "</div>";

        // Color picker
        let colorPicker = postit_floating_form.querySelector(".color_picker");

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

        document.body.append(postit_floating_form);

        let content_elem = postit_floating_form.querySelector(".content");

        this.#section.#add_medium_editor(content_elem, false);

        content_elem.focus();

        let range = document.createRange();
        range.selectNodeContents(content_elem);
        let sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        let remove_folating_editor = () => {
            this.#section.#remove_medium_editor(content_elem);
            postit_floating_form.remove();
            postit_floating_form = null;
        }

        postit_floating_form.addEventListener('click', event => {

            if (event.target.closest('.button_delete')) {
                remove_folating_editor();
            }
            else if (event.target.closest('.button_bgcolor')) {
                postit_floating_form.classList.add("color_picking");

                let on_color_pick = event => {
                    let color;
                    if (color = event.target.closest(".postit .color")) {
                        if (postit_floating_form.dataset.bgcolor) postit_floating_form.classList.remove(postit_floating_form.dataset.bgcolor);
                        if (color.classList[1] !== 'none') {
                            postit_floating_form.dataset.bgcolor = color.classList[1];
                            postit_floating_form.classList.add(color.classList[1]);
                        }
                    }
                    postit_floating_form.classList.remove("color_picking");
                    document.body.removeEventListener("click", on_color_pick, true);
                }

                document.body.addEventListener("click", on_color_pick, true);
            }
            else if (event.target.closest('.button_save')) {

                if (this.#section.datas_loading_in_progress) {
                    new Notification("Impossible d'enregsitrer pour le moment, un chargement est en cours", { immediate_display: true, type: "alert" });

                    return;
                }

                let postitDatas = {
                    parent_path: context,
                    parent_is_file: is_file,
                    bgcolor: postit_floating_form.dataset.bgcolor,
                    content: content_elem.innerHTML
                };

                if (time_stamp) postitDatas.time_stamp = time_stamp;

                let is_in_context = false,
                    context_to_compare_with = (is_file) ? path.dirname(context) : context;

                if (this.#section.explore_sub_folders === true && context_to_compare_with.includes(CURRENT_CONTEXT)) is_in_context = true;
                else if (CURRENT_CONTEXT === context_to_compare_with) is_in_context = true;

                // console.log(context_to_compare_with);

                if (this.#section.tag_search_in_progress) {
                    new Notification("Le Post-it à bien été créé.", { immediate_display: true, type: 'confirmation' });

                    this.#section.#create_new_postit(postitDatas, false, true);
                }
                else if (this.#section.datas_loading_in_progress === false && !is_in_context) {
                    new Notification("Le Post-it à été créé dans un autre context.",
                        {
                            immediate_display: true,
                            button1: {
                                label: "Naviguer jusqu'au Post-it",
                                action: event => {
                                    if (is_file) LearningSection.section.displayResults(path.dirname(context));
                                    else LearningSection.section.displayResults(context);
                                }
                            }
                        });

                    this.#section.#create_new_postit(postitDatas, false, true);
                }
                else this.#section.#create_new_postit(postitDatas);

                remove_folating_editor();
            }
        });
    }

    #miniContainer
    #mediumContainer
    #maxiContainer

    #postitsContainer

    #mediumEditor

    #postits_display_mode = "mosaic"

    #relative_context

    #display_mode = "mini" // mini | medium | maxi
    #lastMode = "medium"

    #display_width

    #pending
    tag_search_in_progress = false

    #context_changed_since_last_update
    #datas_loading_cancel_is_asked = false;
    #save_tempo_id

    display_container
    explore_sub_folders = false
    datas_loading_in_progress

    constructor(root_path, tagsFilePath) {
        super(root_path, tagsFilePath);

        PostitSection.#section = this;

        this._rootElement.classList.add("postits");
        this._rootElement.innerHTML = this._loadSectionHtmlContent(__dirname + "/PostitSection.html");
        this._rootElement.dataset.currentmode = this.#display_mode;

        this.#miniContainer = this.getChildElem(".mini_container");
        this.#mediumContainer = this.getChildElem(".medium_container");
        this.#maxiContainer = this.getChildElem(".maxi_container");

        this.#postitsContainer = this.getChildElem(".postits_container");
        this.#postitsContainer.remove();

        this.display_container = this.#postitsContainer.querySelector(".display_container");

        this._populateTags(this.#maxiContainer.querySelector('.DB_tags_container'));

        // Set Medium container size if stored
        let mediumContainerWidth = localStorage.getItem("postits.medium_container.width"),
            mediumContainerHeight = localStorage.getItem("postits.medium_container.height");
        if (mediumContainerWidth) this.#mediumContainer.style.width = mediumContainerWidth + "px";
        if (mediumContainerHeight) this.#mediumContainer.style.height = mediumContainerHeight + "px";

        this._registerEventHandlers();
    }

    _registerEventHandlers() {

        // Context has changed
        onContextChange(this.onContextChange.bind(this));

        // Resize observer
        let triggerTemporisation, tempo_count = 0;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) this.#display_width = entry.contentRect.width;

            clearTimeout(triggerTemporisation);

            if (tempo_count === 0) {
                tempo_count++;
                this.#update_postit_positioning();
            }
            else if (tempo_count === 10) tempo_count = 0;
            else tempo_count++;

            triggerTemporisation = setTimeout(() => { tempo_count = 0; this.#update_postit_positioning(); }, 300);
        });

        resizeObserver.observe(this.display_container);

        // #region Mutation handling
        // Post-it container mutation event
        const observer = new MutationObserver(mutationList => {
            // Si le context permet d'ajouter des post-its
            if (this.#relative_context !== null) {

                let position_update_needed = false;

                for (const mutation of mutationList) {

                    for (const node of mutation.removedNodes) {
                        if (node.classList && node.classList.contains("postit")) {
                            position_update_needed = true;

                            let parent = mutation.target,
                                has_direct_postits, has_level_container, has_file_level_container;

                            if (parent) {
                                while (parent.classList.contains("level_container")) {
                                    has_direct_postits = has_level_container = has_file_level_container = false;

                                    for (const child of parent.children) {
                                        if (child.classList.contains("postit")) { has_direct_postits = true; break; }
                                        else if (child.classList.contains("level_container")) {
                                            has_level_container = true;

                                            if (child.dataset.type === "file") {
                                                has_file_level_container = true;
                                                break;
                                            }
                                        }
                                    }

                                    // It has no direct post-it but at least a level_container => just remove the title (but not if its artist or lesson)
                                    if (has_level_container && !has_direct_postits) {
                                        if (parent.dataset.type === "dir") {
                                            if (!has_file_level_container) parent.firstChild.remove();
                                        }

                                        break;
                                    }

                                    // If it has direct postits or other level_container
                                    else if (has_direct_postits || has_level_container) break;

                                    // Else, it has no postits and no other level_container => remove everything
                                    let old_parent = parent;
                                    parent = old_parent.parentNode;
                                    old_parent.remove();
                                }
                            }

                            this.#toggle_empty_indicator();
                        }
                    }

                    for (const node of mutation.addedNodes) {
                        if (node.classList && node.classList.contains("postit")) {

                            this.#toggle_empty_indicator();
                            position_update_needed = true;
                        }
                    }
                }

                if (position_update_needed) this.#update_postit_positioning();
            }
        });

        observer.observe(this.display_container, { childList: true, subtree: true }); // { attributes: true, childList: true, subtree: false, attributeFilter: ["style"] };
        // observer.disconnect();
        // #endregion

        // #region Autres event handlers

        // #region MINI CONTAINER ----
        let toggleMode = (mode) => {
            if (this.#display_mode !== mode) {
                this.#lastMode = this.#display_mode;
                this.#display_mode = this._rootElement.dataset.currentmode = mode;
            }
            else {
                this.#display_mode = this._rootElement.dataset.currentmode = this.#lastMode;
                this.#lastMode = mode;
            }

            if (this.#display_mode !== "mini") {

                // Append the post-it container to the right parent
                if (this.#display_mode === "maxi") {
                    let DB_tags_container = this.#mediumContainer.querySelector(".mediumTagsContainer .DB_tags_container");
                    if (DB_tags_container) this.#maxiContainer.querySelector(".tagsContainer").append(DB_tags_container);
                    this.#maxiContainer.querySelector(".resultsContainer").appendChild(this.#postitsContainer);
                    this.#maxiContainer.querySelector(".resultsContainer").scrollTop = 0;
                }
                else {
                    let DB_tags_container = this.#maxiContainer.querySelector(".tagsContainer .DB_tags_container")
                    if (DB_tags_container) this.#mediumContainer.querySelector(".mediumTagsContainer").append(DB_tags_container);
                    this.#mediumContainer.querySelector(".mediumResultsContainer").appendChild(this.#postitsContainer);
                    this.#mediumContainer.querySelector(".mediumResultsContainer").scrollTop = 0;
                }

                this.#postitsContainer.classList.add("no-anim");
                this.#update_postit_list();
                setTimeout(() => { this.#postitsContainer.classList.remove("no-anim"); }, 600);
            }
        }

        // Replace those 4 registers with only one
        this.#miniContainer.querySelector(".main_button").addEventListener("click", event => {

            // if (this.#display_mode === "mini") toggleMode(this.#lastMode);
            // else toggleMode("mini");

            if (this.#relative_context !== null)
                PostitSection.display_new_post_floating_form(CURRENT_CONTEXT, CURRENT_CONTEXT_IS_FILE);
        });

        this.#miniContainer.querySelector(".mini_button").addEventListener("click", event => { toggleMode("mini"); });
        this.#miniContainer.querySelector(".medium_button").addEventListener("click", event => { toggleMode("medium"); });
        this.#miniContainer.querySelector(".maxi_button").addEventListener("click", event => { toggleMode("maxi"); });
        // #endregion

        // #region MEDIUM CONTAINER ----
        // Container resizing
        let cursor_blanket = document.createElement('div');
        cursor_blanket.setAttribute('style', 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 999999999999;');

        let resizeWidth, resizeHeight,
            onMouseMove = event => {

                event.preventDefault();
                event.stopImmediatePropagation();

                let rect = this.#mediumContainer.getBoundingClientRect(),
                    x = event.clientX - rect.left,
                    y = event.clientY - rect.top;

                if (resizeWidth) {
                    let w = rect.width - x + 10;
                    this.#mediumContainer.style.width = w + "px";
                    localStorage.setItem("postits.medium_container.width", w);
                }
                if (resizeHeight) {
                    let h = rect.height - y;
                    this.#mediumContainer.style.height = h + "px";
                    localStorage.setItem("postits.medium_container.height", h);
                }
            },
            onMouseUp = event => {

                event.preventDefault();
                event.stopImmediatePropagation();

                document.body.style.cursor = null;

                this.#mediumContainer.classList.remove("resizing");

                cursor_blanket.remove();

                document.body.removeEventListener("mousemove", onMouseMove, true);
                document.body.removeEventListener("mouseup", onMouseUp, true);
            }

        for (const elem of this.#mediumContainer.querySelectorAll(".resize_helper")) elem.addEventListener("mousedown", event => {

            event.preventDefault();
            event.stopImmediatePropagation();

            this.#mediumContainer.classList.add("resizing");

            document.body.append(cursor_blanket);

            if (event.target.closest(".left")) { resizeWidth = true; resizeHeight = false; cursor_blanket.style.cursor = 'w-resize'; }
            else if (event.target.closest(".top")) { resizeWidth = false; resizeHeight = true; cursor_blanket.style.cursor = 'n-resize'; }
            else { resizeWidth = true; resizeHeight = true; cursor_blanket.style.cursor = 'nw-resize'; }

            document.body.addEventListener("mousemove", onMouseMove, true);
            document.body.addEventListener("mouseup", onMouseUp, true);
        });

        // Tags container toggle
        this.#mediumContainer.addEventListener('click', event => {
            if (event.target.closest('.button_tags_container')) this.#mediumContainer.classList.toggle('tags_container_displayed');
            else if (event.target.closest('.button_stop_tag_search')) {
                this._rootElement.querySelectorAll(".tagsSearchContainer .tag").forEach(tagElem => tagElem.remove());
                this._rootElement.querySelectorAll(".DB_tags_container .tag.activated").forEach(tagElement => tagElement.classList.remove("activated"));
                this.displayResults();
            }
        });
        // #endregion

        // #region MAXI CONTAINER ----

        // Click on top bar
        this.#maxiContainer.querySelector(".topbar").addEventListener("click", event => {
            let button;
        });

        let onClickOutside = event => {

            if (event.target.closest('.postit.focused') || event.target.closest('.medium-editor-toolbar')) return;

            let focused = this.#postitsContainer.querySelector(".focused");

            if (focused) {
                let content = focused.querySelector(".content");

                this.#remove_medium_editor(content);

                focused.classList.remove("focused");

                document.body.removeEventListener("mousedown", onClickOutside, true);
            }
        }

        // Click on post-it container
        this.#postitsContainer.addEventListener("mousedown", event => {
            let target;

            // Click on separator
            if (target = event.target.closest('.sep')) { }

            // Click on tag
            else if (target = event.target.closest(".tag")) { }

            // Delete post-it
            else if (target = event.target.closest(".postit .button_delete")) { }

            // Change BG color
            else if (target = event.target.closest(".postit .button_bgcolor")) { }

            // Open linked file
            else if (target = event.target.closest(".postit .button_linked")) { }

            // Add Medium eidtor to postit and focus it
            else {
                let parent = event.target.closest(".postit");

                if (parent) {

                    let contentElem = parent.querySelector('.content');

                    if (!parent.classList.contains("focused")) {

                        parent.classList.add("focused");

                        document.body.addEventListener("mousedown", onClickOutside, true);

                        this.#add_medium_editor(contentElem);

                        // Update positioning when focus on postit in medium container
                        if (parent.closest('.mediumResultsContainer')) {

                            this.#postitsContainer.classList.add("no-anim");
                            this.#update_postit_positioning();
                            setTimeout(() => { parent.scrollIntoView({ behavior: "smooth" }); }, 200);
                            setTimeout(() => { this.#postitsContainer.classList.remove("no-anim"); }, 300);
                        }
                    }
                }
            }
        });

        this.#postitsContainer.addEventListener("click", event => {

            let target;

            // Click on separator
            if (target = event.target.closest('.sep')) {
                let parent_level_container = target.parentNode;

                if (parent_level_container.dataset.isfile === 'true') this.#open_file(parent_level_container.dataset.path);
                else LearningSection.section.displayResults(parent_level_container.dataset.path);
            }

            // Click on tag
            else if (target = event.target.closest(".tag")) {
                event.target.closest(".postit").obj.removeTag(target.dataset.id);
            }

            // Delete post-it
            else if (target = event.target.closest(".postit .button_delete")) {
                event.target.closest('.postit').obj.delete();
            }

            // Change BG color
            else if (target = event.target.closest(".postit .button_bgcolor")) {
                let postit = event.target.closest('.postit');
                postit.classList.add("color_picking");

                let on_color_pick = event => {
                    let color;
                    if (color = event.target.closest(".postit .color")) {
                        if (postit.obj.bgcolor) postit.classList.remove(postit.obj.bgcolor);
                        if (color.classList[1] !== 'none') {
                            postit.obj.bgcolor = color.classList[1];
                            postit.classList.add(color.classList[1]);
                        }

                        postit.obj.saveDatas();
                    }
                    postit.classList.remove("color_picking");
                    document.body.removeEventListener("click", on_color_pick, true);
                }

                document.body.addEventListener("click", on_color_pick, true);
            }

            // Open linked file
            else if (target = event.target.closest(".postit .button_linked")) {

                let postit = event.target.closest(".postit").obj;

                this.#open_file(postit.parent_path, postit.time_stamp);
            }

            else {

            }
        });

        // Postit add button
        this.#postitsContainer.querySelector(".add_postit_container").addEventListener("click", event => {

            let button;

            if (button = event.target.closest('.button_add')) {
                this.#create_new_postit({
                    parent_path: CURRENT_CONTEXT,
                    parent_is_file: CURRENT_CONTEXT_IS_FILE,
                    content: "<p>Nouveau post-it</p>"
                }, true);
            }

            // Bouton list / mosaic
            else if (button = event.target.closest(".button_mosaic")) {
                if (button.getAttribute('src').includes("layout_mosaic.svg")) {
                    button.setAttribute('src', "assets/images/layout_list.svg");
                    this.#postits_display_mode = "list";
                }
                else {
                    button.setAttribute('src', "assets/images/layout_mosaic.svg");
                    this.#postits_display_mode = "mosaic";
                }

                this.#update_postit_positioning();
                setTimeout(() => { this.#update_postit_positioning(); }, 500); // To prevent correct wrong postit height calculation dure to animation
            }

            // Bouton scope
            else if (button = event.target.closest(".button_scope")) {

                if (this.explore_sub_folders) {
                    button.classList.remove("on");
                    button.querySelector("img:first-of-type").setAttribute("src", "assets/images/toggle_off.svg");
                    this.explore_sub_folders = false;
                }
                else {
                    button.classList.add("on");
                    button.querySelector("img:first-of-type").setAttribute("src", "assets/images/toggle_on.svg");
                    this.explore_sub_folders = true;
                }

                this.#update_postit_list(true);
            }
        });
        // #endregion

        window.onresize = event => {

            // Limit medium container width
            let mediumContainerBox = this.#mediumContainer.getBoundingClientRect();

            let tags_container_width = this.#mediumContainer.querySelector('.mediumTagsContainer').getBoundingClientRect().width;

            if (mediumContainerBox.left - tags_container_width < 45)
                this.#mediumContainer.style.width = (document.body.getBoundingClientRect().width - tags_container_width - 35 - 45) + "px"; // view width - left margin - right margin
        }

        super._registerEventHandlers();
        // #endregion
    }

    #add_medium_editor(target, select_text) {
        if (this.#mediumEditor === undefined) {
            // MEDIUM EDITOR ****
            // TODO Medium Editor : Change the way indent are handled (not with multiple blockquotes)
            // TODO Medium Editor : Filter toolbar's buttons depeding on context

            let AutoList = MediumEditor.Extension.extend({
                name: 'autolist',
                init: function () {
                    this.subscribe('editableInput', this.onInput.bind(this));
                },
                onInput: function (evt) {
                    var list_start = this.base.getSelectedParentElement().textContent;
                    if (/^\s*1\.\s/.test(list_start) && this.base.getExtensionByName('orderedlist')) {
                        this.base.execAction('delete');
                        this.base.execAction('delete');
                        this.base.execAction('delete');
                        this.base.execAction('insertorderedlist');
                    }
                    else if (/^\s*-\s/.test(list_start) && this.base.getExtensionByName('unorderedlist')) {
                        this.base.execAction('delete');
                        this.base.execAction('delete');
                        this.base.execAction('insertunorderedlist');
                    }
                }
            });

            let ToolbarSep1 = MediumEditor.extensions.button.extend({ name: 'separator1', contentDefault: '' }),
                ToolbarSep2 = MediumEditor.extensions.button.extend({ name: 'separator2', contentDefault: '' }),
                ToolbarSep3 = MediumEditor.extensions.button.extend({ name: 'separator3', contentDefault: '' });

            // Change defaults :
            MediumEditor.extensions.button.prototype.defaults['unorderedlist'].contentDefault = "<img src='assets/images/text_editor/unorderedlist.svg' />";
            MediumEditor.extensions.button.prototype.defaults['orderedlist'].contentDefault = "<img src='assets/images/text_editor/orderedlist.svg' />";
            MediumEditor.extensions.button.prototype.defaults['indent'].contentDefault = "<img src='assets/images/text_editor/indent.svg' />";
            MediumEditor.extensions.button.prototype.defaults['outdent'].contentDefault = "<img src='assets/images/text_editor/outdent.svg' />";
            MediumEditor.extensions.button.prototype.defaults['quote'].contentDefault = "<img src='assets/images/text_editor/blockquote.svg' />";
            MediumEditor.extensions.form.prototype.formSaveLabel = "<img src='assets/images/text_editor/check.svg' />";
            MediumEditor.extensions.anchor.prototype.contentDefault = "<img src='assets/images/text_editor/link.svg' />";

            this.#mediumEditor = new MediumEditor(target, {

                placeholder: { text: "Ajouter un Post-it..." },
                autoLink: true,

                extensions: {
                    'autolist': new AutoList(),
                    'separator1': new ToolbarSep1(),
                    'separator2': new ToolbarSep2(),
                    'separator3': new ToolbarSep3()
                },

                toolbar: {
                    buttons: ['h1', 'h2', 'separator1', 'bold', 'italic', 'underline', 'separator2', 'unorderedlist', 'orderedlist', 'indent', 'outdent', 'separator3', 'anchor', 'quote']
                },

                paste: {
                    forcePlainText: false,
                    cleanPastedHTML: true
                }
            });

            // Event handling
            this.#mediumEditor.subscribe('editableInput', (event, editable) => {

                // Update pos if height has changed and its not a floating postits form
                let postit = editable.closest(".postit");

                if (postit.classList.contains('postit_floating_form')) { }
                else {
                    let height = postit.getBoundingClientRect().height;

                    if (height !== postit.height) {
                        postit.height = height;
                        this.#update_postit_positioning();
                    }

                    clearTimeout(this.#save_tempo_id);

                    this.#save_tempo_id = setTimeout(() => { postit.obj.saveDatas(); }, 1000);
                }
            });
        }
        else this.#mediumEditor.addElements(target);

        if (select_text) {
            target.focus();
            this.#mediumEditor.selectAllContents();
        }
    }

    #remove_medium_editor(target) {
        this.#mediumEditor.removeElements(target);
        target.classList.remove("medium-editor-element");
        target.removeAttribute("data-medium-editor-element");
        target.removeAttribute("data-medium-editor-editor-index");
        target.removeAttribute("medium-editor-index");
        target.removeAttribute("data-medium-focused");
    }

    onContextChange() {

        this.#context_changed_since_last_update = false;

        if (CURRENT_CONTEXT !== null) {
            // context relative to root folder
            this.#relative_context = path.relative(this._root_path, CURRENT_CONTEXT);

            if (this.#relative_context === "") this.#relative_context = null;
        }
        else this.#relative_context = null;

        if (this.#relative_context === null) {
            this._rootElement.classList.remove("addIsAllowed");
            this._rootElement.querySelector(".main_button").setAttribute("src", "assets/images/postits.svg");
        }
        else {
            this._rootElement.classList.add("addIsAllowed");
            this._rootElement.querySelector(".main_button").setAttribute("src", "assets/images/postits_add.svg");
        }

        if (this.#display_mode !== "mini") this.#update_postit_list();
    }

    #open_file(file_path, time_stamp) {
        let extention = path.extname(file_path)

        if (extention === ".mp4"
            || extention === ".m4v"
            || extention === ".mkv"
            || extention === ".avi"
            || extention === ".flv"
            || extention === ".wmv"
            || extention === ".mov"
            || extention === ".youtube"
        ) {
            VIDEO_PLAYER.open(file_path, time_stamp);
        }
        else nw.Shell.openExternal(file_path);
    }

    fill_container_up_to_path(root_container, steps, is_file) {

        let current_level = 0;

        let next_step = (current_container, current_path) => {

            current_level++;

            let found = false;

            // Check for perfect match
            for (const child of current_container.children) {
                if (child.classList.contains("level_container") && child.dataset.path === current_path) {

                    found = child;

                    //Check if it has title
                    if (
                        ((current_level === 1 || current_level === 2)
                            || (steps.length === 0 || (is_file && steps.length <= 1)))
                        && (found.children[0] && !found.children[0].classList.contains('sep'))) this.#append_title_to_level(found);
                    break;
                }
            }

            // Still not found, we create it
            if (found === false) {

                found = document.createElement("div");
                found.classList.add('level_container');
                found.dataset.path = current_path;

                found.dataset.isfile = false;

                if (current_level === 1) found.dataset.type = 'artist';
                else if (current_level === 2) found.dataset.type = 'lesson';
                else found.dataset.type = 'dir';

                if (is_file && steps.length === 0) {
                    found.dataset.isfile = true;
                    found.dataset.type = 'file';
                }

                if (
                    ((current_level === 1 || current_level === 2)
                        || (steps.length === 0 || (is_file && steps.length <= 1)))
                ) this.#append_title_to_level(found);

                let next_to;

                // Find sibling to put this new container before or next to
                for (const child of current_container.children) {

                    if (child.classList.contains("level_container")) {

                        // If new level_container is a file, put it before 1st non-file child level_container
                        if (found.dataset.isfile === 'true' && child.dataset.isfile === 'false') {
                            next_to = child;
                            break;
                        }
                        // If new level_container is not a file, it won't be before any file type level_container
                        else if (found.dataset.isfile === 'false' && child.dataset.isfile === 'true') continue;
                        // Comparing file type against file type
                        else if (found.dataset.isfile === 'true' && child.dataset.isfile === 'true') {
                            if (child.dataset.path.localeCompare(current_path) === 1) {
                                next_to = child;
                                break;
                            }
                        }
                        // Comparing non-file type against non-file type
                        else if (found.dataset.isfile === 'false' && child.dataset.isfile === 'false') {
                            if (child.dataset.path.localeCompare(current_path) === 1) {
                                next_to = child;
                                break;
                            }
                        }
                    }
                }

                if (next_to) next_to.before(found);
                else current_container.append(found);
            }

            if (steps.length > 0) return next_step(found, path.join(current_path, steps.shift()));
            else return found;
        }

        return next_step(root_container, path.join(this._root_path, steps.shift()));
    }

    #create_separator(label, type) {

        if (type === 'lesson') { label = "<img src='assets/images/learning.svg' />" + label; }
        else if (type === 'dir') { label = "<img src='assets/images/folder4.svg' />" + label; }
        else if (type === 'file') { label = "<img src='assets/images/file2.svg' />" + label; }

        let sep_element = document.createElement('div');
        sep_element.classList.add("grid_item");
        sep_element.classList.add("sep");
        sep_element.classList.add(type);
        sep_element.innerHTML = label;

        return sep_element;
    }

    #create_new_postit(datas, select_text, dont_display) {

        // Create a postit
        let new_postit = new Postit(datas, this);

        if (!dont_display) {

            let container = this.fill_container_up_to_path(this.display_container, path.relative(this._root_path, datas.parent_path).split('\\'), datas.parent_is_file);

            if (container.firstChild.classList.contains('level_container')) container.firstChild.before(new_postit.toElement());
            else container.firstChild.after(new_postit.toElement());

            this.#add_medium_editor(new_postit.toElement().querySelector(".content"), select_text);
        }

        new_postit.saveDatas();
    }

    #append_title_to_level(level) {

        let splitted_level_path = path.relative(this._root_path, level.dataset.path).split('\\');

        if (level.dataset.isfile === 'true') {
            level.prepend(this.#create_separator(path.basename(level.dataset.path), 'file'));
        }
        else if (splitted_level_path.length === 1) {
            level.prepend(this.#create_separator(splitted_level_path.pop(), 'artist'));
        }
        else if (splitted_level_path.length === 2) {
            level.prepend(this.#create_separator(splitted_level_path.pop(), 'lesson'));
        }
        else {
            level.prepend(this.#create_separator(splitted_level_path.slice(2).join('<span class="path_separator">></span>'), 'dir'));
        }
    }

    async _update_folder_indexation() {

        let cancel_indexation = false,
            lv_datas,
            indexed_postits_count = 0,
            indexed_postits = [];

        // Display notificaiton
        let indexation_notificaiton = new Notification("Indexation des Post-its en cours...<br /><img class='spinning' src='assets/images/loading.svg' /> <span class='count'></span>", {
            persistent: true,
            button1: { label: "Annuler", action: () => { cancel_indexation = true; } }
        });

        let index_postit_datas = (postit_datas, parent_path, parent_is_file) => {

            for (const tag_id of postit_datas.tags) {
                if (indexed_postits[tag_id] === undefined) indexed_postits[tag_id] = [];
                indexed_postits[tag_id].push({ uid: postit_datas.uid, parent_path: path.relative(ROOT_FOLDER, parent_path), parent_is_file: parent_is_file });
            }

            indexed_postits_count++;

            let text = (indexed_postits_count > 1) ? " Post-its indexés" : " Post-it indexé";
            indexation_notificaiton.update_content(indexed_postits_count + text, '.count');
        }

        let index_folder = async (dir_path) => {
            if (cancel_indexation) return;

            // Read & Parse .lv datas
            lv_datas = Result.getLvDatas(dir_path);

            if (lv_datas) {
                if (lv_datas.postits) {
                    for (const postit_datas of lv_datas.postits) {
                        index_postit_datas(postit_datas, dir_path, false);
                    }
                }
                if (lv_datas.files) {
                    for (const filename in lv_datas.files) {

                        if (lv_datas.files[filename].postits) {
                            for (const postit_datas of lv_datas.files[filename].postits) {
                                index_postit_datas(postit_datas, path.join(dir_path, filename), true);
                            }
                        }
                    }
                }
            }

            // Analyze sub folders
            let file_list = await fsp.readdir(dir_path, { withFileTypes: true }).catch(error => { throw new Error(error); });

            for (const item of file_list)
                if (item.isDirectory()) await index_folder(path.join(dir_path, item.name));
        }

        let on_key_down = event => { if (event.key === "Escape") cancel_indexation = true; };

        document.addEventListener("keydown", on_key_down);

        // Start Post-its indexation
        index_folder(path.join(ROOT_FOLDER, this._root_path))
            .then(() => {
                document.removeEventListener("keydown", on_key_down);

                indexation_notificaiton.destroy();

                if (cancel_indexation) {
                    new Notification("L'indexation des Post-its à été annulée.", { type: 'alert' });
                }
                else {
                    // Clear actual tag / path association & store new assosiations if necesary
                    for (const tag_element of this.getChildrenElem(".DB_tags_container .tag")) {
                        delete tag_element.datas.postits;
                        if (indexed_postits[tag_element.datas.id] !== undefined) tag_element.datas.postits = indexed_postits[tag_element.datas.id];
                    }

                    Tag.saveTagsDatas(this.tagsFilePath, this._rootElement.querySelectorAll('.DB_tags_container .tagGroupContainer'));

                    let found_count_text = indexed_postits_count > 1 ? indexed_postits_count + " Post-its indexés" : indexed_postits_count + " Post-it indexé";
                    new Notification("L'indexation des Post-its est terminée.<br /><span>" + found_count_text + "</span>", { type: 'confirmation' });
                }
            })
            .catch(error => { alert(error); console.error(error); });
    }

    #update_postit_positioning() {

        const colunm_gap = 15,
            row_gap = 15,

            top_margin = 50,
            external_margin = 50,

            separator_top_margin = 35,

            artist_bottom_margin = 35,
            lesson_bottom_margin = 30,
            separator_bottom_margin = 10,

            maxi_mode_width = 450,
            medium_mode_width = 800;

        let previous_type,

            column_width = (this.#postits_display_mode === "list" || this.#display_mode === "medium") ? medium_mode_width : maxi_mode_width,

            available_width_for_content = this.#display_width - external_margin * 2,

            num_by_row = (this.#postits_display_mode === 'list') ? 1 : Math.floor((available_width_for_content + colunm_gap) / (column_width + colunm_gap));

        if (num_by_row < 1) num_by_row = 1;

        let content_width = column_width * num_by_row + colunm_gap * (num_by_row - 1),

            left_offset = external_margin;

        if (content_width > available_width_for_content) content_width = available_width_for_content;
        else if (content_width < available_width_for_content) left_offset += (available_width_for_content - content_width) / 2; // Centering content

        // Limit column width if > than content width
        if (column_width > content_width) column_width = content_width;

        let grid_items = this.display_container.querySelectorAll(".grid_item"),

            xPos, yPos,
            column_offsets = [];;

        for (const grid_item of grid_items) {
            let is_postit = grid_item.classList.contains('postit');

            // Get next highest slot
            let offset, min_offset = column_offsets[0] || top_margin, target_column = 0;
            for (let idx = 0; idx < num_by_row; idx++) {

                offset = column_offsets[idx] || top_margin;

                if (is_postit && offset < min_offset) {
                    min_offset = offset;
                    target_column = idx;
                }
                else if (!is_postit && offset > min_offset) min_offset = offset;
            }

            // Determine postit position
            xPos = left_offset + (column_width + colunm_gap) * target_column;
            yPos = min_offset;

            // Add top margin for separators after a post-it
            if (!is_postit && previous_type === 'postit') yPos += separator_top_margin;

            grid_item.setAttribute("style", "transform: translate(" + xPos + "px, " + yPos + "px)");
            if (!is_postit) grid_item.style.width = content_width + 'px';
            else grid_item.style.width = column_width + 'px';

            // check for overflowed .content (250 is it's max-height value)
            if (is_postit) {
                if (!grid_item.classList.contains("focused") && grid_item.querySelector(".content").scrollHeight > 250) grid_item.classList.add("overflowed");
                else grid_item.classList.remove("overflowed");
            }

            // Save offsets for each column
            if (column_offsets[target_column] === undefined) column_offsets[target_column] = 0;

            let new_offset = yPos + grid_item.offsetHeight + row_gap;

            // Apply bottom margin depending on item type
            if (grid_item.classList.contains("artist")) new_offset += artist_bottom_margin;
            else if (grid_item.classList.contains("lesson")) new_offset += lesson_bottom_margin;
            else if (!is_postit) new_offset += separator_bottom_margin;

            // Store new offset for next pass
            if (is_postit) column_offsets[target_column] = new_offset;
            else for (let i = 0; i < num_by_row; i++)  column_offsets[i] = new_offset;

            // Save item type for next loop
            previous_type = (is_postit) ? 'postit' : 'sep';
        }
    }

    async #populate_postits_from_datas(path_to_explore, deep_explore) {
        if (this.#datas_loading_cancel_is_asked) throw new Error("datas loading cancelling");

        let lvDatas;

        let add_postits_from_datas = (level_container, datas, item_path, is_from_file) => {
            if (datas.postits && datas.postits.length > 0) {

                for (const postit_id in datas.postits) {
                    if (datas.postits[postit_id] !== null) {

                        datas.postits[postit_id].parent_path = path.relative(ROOT_FOLDER, item_path);
                        datas.postits[postit_id].parent_is_file = is_from_file;

                        level_container.appendChild(new Postit(datas.postits[postit_id], this).toElement());
                    }
                }
            }
        }

        let analyze_dir = async (dir_path, parent_container, level) => {

            let level_container = document.createElement('div');
            level_container.classList.add('level_container');

            if (level === 0) level_container.dataset.type = 'artist';
            else if (level === 1) level_container.dataset.type = 'lesson';
            else level_container.dataset.type = 'dir';

            level_container.dataset.path = path.relative(ROOT_FOLDER, dir_path);
            level_container.dataset.isfile = false;

            if (this.#datas_loading_cancel_is_asked) throw new Error("datas loading cancelling");

            // Read & Parse .lv datas
            lvDatas = Result.getLvDatas(dir_path);

            if (lvDatas) {
                // Check folder's post-its
                add_postits_from_datas(level_container, lvDatas, dir_path, false);

                // Check files' post-its
                if (lvDatas.files) {

                    for (const filename in lvDatas.files) {
                        let file_level_container = document.createElement('div');
                        file_level_container.classList.add('level_container');
                        file_level_container.dataset.type = 'file';
                        file_level_container.dataset.path = path.relative(ROOT_FOLDER, path.join(dir_path, filename));
                        file_level_container.dataset.isfile = true;

                        add_postits_from_datas(file_level_container, lvDatas.files[filename], path.join(dir_path, filename), true);

                        if (file_level_container.children.length > 0) {
                            this.#append_title_to_level(file_level_container);
                            level_container.append(file_level_container);
                        }
                    }
                }
            }

            // Explore sub folder if deep exploration is on
            if (deep_explore) {
                let file_list = await fsp.readdir(dir_path, { withFileTypes: true }).catch(error => { throw new Error(error); });

                for (const item of file_list)
                    if (item.isDirectory()) await analyze_dir(path.join(dir_path, item.name), level_container, level + 1);
            }

            // This level_container is not empty, so we can add it to its parent
            if (level_container.children.length > 0) {
                if (level === 0 || level === 1 || level_container.children[0].classList.contains("postit") || (level_container.children[0].children[0].classList.contains("file"))) this.#append_title_to_level(level_container);
                parent_container.append(level_container);

                return level_container;
            }
            else return null;
        };

        let splitted_relative_path = path.relative(this._root_path, path_to_explore).split('\\');

        let level_container = await analyze_dir(path.join(ROOT_FOLDER, path_to_explore), this.display_container, splitted_relative_path.length - 1);

        if (level_container !== null) {
            // Add every level_container missing between root_path and explored path
            splitted_relative_path.pop(); // The last part of the relative path is already handled by analyze_dir
            let level = 0,
                current_level_container = this.display_container,
                current_path = this._root_path;

            for (const foldername of splitted_relative_path) {

                current_path = path.join(current_path, splitted_relative_path[level]);

                let tmp_container = document.createElement('div');
                tmp_container.classList.add('level_container');
                tmp_container.dataset.path = current_path;
                tmp_container.dataset.isfile = false;

                if (level === 0) tmp_container.dataset.type = 'artist';
                else if (level === 1) tmp_container.dataset.type = 'lesson';
                else tmp_container.dataset.type = 'dir';

                if (level === 0 || level === 1) this.#append_title_to_level(tmp_container);

                current_level_container.append(tmp_container);
                current_level_container = tmp_container;

                level++;
            }

            current_level_container.append(level_container);
        }
    }

    #toggle_empty_indicator = () => {
        if (this.display_container.children.length === 0 || (this.display_container.children.length === 1 && this.display_container.children[0].classList.contains('end_spacer'))) {

            let empty_image = document.createElement('img');
            empty_image.classList.add('empty_image');
            empty_image.setAttribute("src", "assets/images/postits_add.svg")

            this.display_container.append(empty_image);
        }
        else {
            let empty_image = this.display_container.querySelector(".empty_image");
            if (empty_image) empty_image.remove();
        }
    }

    #update_postit_list(force_update) {

        // Une recherche par tag est en cours
        if (this.tag_search_in_progress) {
            if (this.datas_loading_in_progress) { this.#datas_loading_cancel_is_asked = true; return; }

            this.#postitsContainer.querySelector(".add_postit_container .button_add").classList.add("inactive");

            this.display_container.innerHTML = '';

            this.#postitsContainer.classList.add("no-anim");

            // Populate Post-it from tag search
            let filtered_postits_datas = null;

            // On parcourt d'abord les .tag normaux (ceux sans .notIn)
            for (const DB_tag_elem of this._rootElement.querySelectorAll(".tagsSearchContainer .tag:not(.notIn)")) {

                // Si 1 des tags n'a aucun dossier associé, la recherche est vide, on peut arreter là
                if (DB_tag_elem.datas.postits === undefined) {
                    filtered_postits_datas = [];
                    break;
                }
                // Premier tag filtrant => on prend tous ses Post-its
                else if (filtered_postits_datas === null) filtered_postits_datas = DB_tag_elem.datas.postits;

                // A partir du deuxième tag filtrant, on garde que les post-it aussi présent dans les tags filtrants précédents
                else {
                    // Passe en revue tous les chemins recueillis jusque là, et garde seulement les chemins présents dans la liste de tous les tags
                    filtered_postits_datas = filtered_postits_datas.filter(postit_datas => {
                        if (DB_tag_elem.datas.postits.findIndex(DB_postit_datas => { return postit_datas.parent_path === DB_postit_datas.parent_path; }) !== -1) return true;
                        else return false;
                    });
                }
            }

            // On parcourt ensuite ceux .notIn
            if (filtered_postits_datas) for (const DB_tag_elem of this._rootElement.querySelectorAll(".tagsSearchContainer .tag.notIn")) {
                filtered_postits_datas = filtered_postits_datas.filter(filtered_postit_datas => {
                    if (DB_tag_elem.datas.postits === undefined) return true;
                    else if (DB_tag_elem.datas.postits.findIndex(DB_postit_datas => { return filtered_postit_datas.parent_path === DB_postit_datas.parent_path; }) !== -1) return false;
                    else return true;
                });
            }

            if (filtered_postits_datas) this._rootElement.querySelectorAll(".tagsSearchContainer .tag.notIn").forEach(tagElem => {
                filtered_postits_datas = filtered_postits_datas.filter(filtered_postit_datas => {
                    if (tagElem.datas.postits === undefined) return true;
                    else if (tagElem.datas.postits.indexOf(filtered_postit_datas) !== -1) return false;
                    else return true;
                });
            });

            if (filtered_postits_datas !== null) {

                let lv_datas;

                for (const filtered_datas of filtered_postits_datas) {
                    // Read & Parse .lv datas
                    let lv_file_path = filtered_datas.parent_path;

                    if (filtered_datas.parent_is_file) lv_file_path = path.dirname(lv_file_path);

                    lv_datas = Result.getLvDatas(path.join(ROOT_FOLDER, lv_file_path));

                    if (lv_datas) {
                        let postits_datas = lv_datas.postits;

                        if (filtered_datas.parent_is_file) {
                            let filename = path.basename(filtered_datas.parent_path);

                            postits_datas = lv_datas.files[filename].postits;
                        }

                        let target_postit_datas;

                        for (const postit_datas of postits_datas) {
                            if (postit_datas.uid === filtered_datas.uid) {
                                target_postit_datas = postit_datas;
                                break;
                            }
                        }

                        if (target_postit_datas === undefined) throw new Error("Impossible de trouver les données du Post-it [" + filtered_datas.uid + "] à l'emplacement [" + filtered_datas.parent_path + "]");

                        target_postit_datas.parent_path = filtered_datas.parent_path;
                        target_postit_datas.parent_is_file = filtered_datas.parent_is_file;

                        // Create a postit
                        let new_postit = new Postit(target_postit_datas, this);

                        let container = this.fill_container_up_to_path(this.display_container, path.relative(this._root_path, filtered_datas.parent_path).split('\\'), filtered_datas.parent_is_file);

                        if (container.firstChild.classList.contains('level_container')) container.firstChild.before(new_postit.toElement());
                        else container.firstChild.after(new_postit.toElement());
                    }
                }
            }

            this.display_container.append(this.#create_separator('', 'end_spacer'));

            this.#update_postit_positioning();

            this.#toggle_empty_indicator();

            setTimeout(() => { this.#postitsContainer.classList.remove("no-anim"); }, 600);
        }

        // Le context permet d'ajouter des post-its
        else if (this.#relative_context !== null) {

            this.#postitsContainer.querySelector(".add_postit_container .button_add").classList.remove("inactive");

            if (this.#context_changed_since_last_update === false || force_update) {

                if (this.datas_loading_in_progress) { this.#datas_loading_cancel_is_asked = true; return; }

                this.#context_changed_since_last_update = true;
                this.datas_loading_in_progress = true;

                this.display_container.innerHTML = '';

                // Display loading
                this.#postitsContainer.classList.add("loading");
                this.#postitsContainer.classList.add("no-anim");

                this.#populate_postits_from_datas(CURRENT_CONTEXT, this.explore_sub_folders)
                    .then(() => {

                        this.#postitsContainer.classList.remove("loading");
                        setTimeout(() => { this.#postitsContainer.classList.remove("no-anim"); }, 600);

                        this.display_container.append(this.#create_separator('', 'end_spacer'));

                        this.#update_postit_positioning();

                        this.#toggle_empty_indicator();

                        this.datas_loading_in_progress = false;
                    })
                    .catch(error => {
                        this.datas_loading_in_progress = false;
                        this.#postitsContainer.classList.remove("loading");
                        this.#postitsContainer.classList.remove("no-anim");

                        if (error.message === "datas loading cancelling") {
                            this.#datas_loading_cancel_is_asked = false;
                            setTimeout(() => { this.#update_postit_list(true); }, 100);
                        }
                        else {
                            alert(error);
                            console.error(error)
                        }
                    })
            }
        }

        // Le context ne permet pas d'ajouter des post-its
        else {
            if (this.datas_loading_in_progress) { this.#datas_loading_cancel_is_asked = true; return; }

            this.display_container.innerHTML = '';
            this.#postitsContainer.querySelector(".add_postit_container .button_add").classList.add("inactive");

            this.#toggle_empty_indicator();
        }
    }

    displayResults() {
        this.tag_search_in_progress = false;
        this._rootElement.classList.remove("tagSearchInProgress");
        this._rootElement.classList.remove("searchResultsAreDisplayed");

        this.#update_postit_list(true);
    }

    _displayTagSearchResults() {
        this.tag_search_in_progress = true;
        this._rootElement.classList.add("tagSearchInProgress");
        this._rootElement.classList.add("searchResultsAreDisplayed");

        this.#update_postit_list();
    }

    display() {
        // TMP

        // this.#full_context = "\\\\192.168.1.3\\art\\Learning Vault\\Artists\\Alexander Mandradjiev";
        // this.#relative_context = path.relative(this._root_path, "\\\\192.168.1.3\\art\\Learning Vault\\Artists\\Alexander Mandradjiev");
        // this.#miniContainer.querySelector(".maxi_button").click();
        // this.#miniContainer.querySelector(".medium_button").click();
    }
};