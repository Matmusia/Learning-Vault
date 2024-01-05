module.exports = class Notification {

    static #css_is_available = false;
    static #notification_queue = [];
    static #currently_displayed_notification

    static #add_css() {

        try {
            let css = fs.readFileSync(path.join(__dirname, "Notification.css"), 'utf8');
            let styleElem = document.createElement("style");
            styleElem.innerHTML = css;
            document.head.appendChild(styleElem);
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la lecture du fichier '" + path.join(__dirname, "Notification.css") + "'");
            return;
        }

        this.#css_is_available = true;
    }

    #element
    #content_element
    #bound_on_click
    #auto_destroy = true
    #is_destroyed = false

    /**
     * 
     * @param {String} content 
     * @param {Object} options 
     * 
     * @param {(''|'confirmation'|'alert'|'warning')} options.type
     * @param {Boolean} options.immediate_display 
     * @param {Boolean} options.persistent 
     * 
     * @param {Object} options.button1 
     * @param {String} options.button1.label
     * @param {Function} options.button1.action
     * 
     * @param {Object} options.button2
     * @param {String} options.button2.label
     * @param {Function} options.button2.action
     */
    constructor(content, options) {
        if (!Notification.#css_is_available) Notification.#add_css();

        if (options === undefined) options = {};

        if (options.persistent) this.#auto_destroy = false;

        // Root element
        this.#element = document.createElement('div');
        this.#element.classList.add("Notification");
        if (options.type) this.#element.classList.add(options.type);
        this.#element.innerHTML = "<div class='notification'></div>";
        document.body.append(this.#element);

        // Content element
        this.#content_element = document.createElement('div');
        this.#content_element.classList.add("content");
        this.#content_element.innerHTML = content;
        this.#element.querySelector(".notification").append(this.#content_element);

        // Button close
        let button_close = document.createElement('div');
        button_close.classList.add("button_close");
        button_close.innerHTML = 'X';
        this.#element.querySelector(".notification").append(button_close);

        this.#bound_on_click = this.#on_click.bind(this);
        this.#element.querySelector(".notification").addEventListener('click', this.#bound_on_click);

        // Custom buttons
        if (options.button1) {
            let button = document.createElement('div');
            button.classList.add('button');
            button.innerHTML = options.button1.label;
            button.addEventListener('click', options.button1.action);

            this.#element.querySelector('.content').after(button);
        }
        if (options.button2) {
            let button = document.createElement('div');
            button.classList.add('button');
            button.innerHTML = options.button2.label;
            button.addEventListener('click', options.button2.action);

            this.#element.querySelector('.button_close').before(button);
        }

        if (Notification.#currently_displayed_notification) {
            Notification.#notification_queue.push(this);
            if (options.immediate_display) Notification.#currently_displayed_notification.destroy(); // Trigger the passing to next in queue
        }
        else this.#display();
    }

    #display() {
        Notification.#currently_displayed_notification = this;

        setTimeout(() => { this.#element.classList.add("displayed"); }, 10);
        if (this.#auto_destroy) setTimeout(() => { this.destroy() }, 8000);
    }

    #on_click(event) {
        if (event.target.closest(".button") || event.target.closest(".button_close")) this.destroy();
    }

    /**
     * 
     * @param {String} new_content 
     * @param {String} class_target 
     */
    update_content(new_content, class_target) {
        if (class_target) this.#content_element.querySelector(class_target).innerHTML = new_content;
        else this.#content_element.innerHTML = new_content;
    }

    destroy() {
        if (!this.#is_destroyed) {
            this.#is_destroyed = true;

            // Remove ALL event listener from #element and its children, preventing further interaction with this soon to be destroyed Notification
            let clone = this.#element.cloneNode(true);
            this.#element.replaceWith(clone);
            this.#element = clone;
            clone = null;

            setTimeout(() => { this.#element.classList.remove("displayed"); }, 10);

            setTimeout(() => {

                this.#element.querySelector(".notification").removeEventListener('click', this.#bound_on_click);
                this.#element.remove();
                this.#element.innerHTML = null;
                this.#element = null;
                this.#bound_on_click = null;

                Notification.#currently_displayed_notification = null;

                if (Notification.#notification_queue.length > 0) {
                    let notification = Notification.#notification_queue.shift();
                    notification.#display();
                }

            }, 500);
        }
    }

    /**
     * 
     * @returns {HTMLElement}
     */
    toElement() { return this.#element; }
}