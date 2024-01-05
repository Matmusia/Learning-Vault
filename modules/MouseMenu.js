module.exports = class MouseMenu {

    static current
    static root_element

    #boundedHide

    constructor() {
        MouseMenu.current = this;

        if (MouseMenu.root_element === undefined) {
            MouseMenu.root_element = document.createElement("div");
            MouseMenu.root_element.classList.add("MouseMenu");
            document.body.appendChild(MouseMenu.root_element);
        }

        this.#boundedHide = this.#hide.bind(this);
    }

    #hide(event) {
        if (event && event.stopPropagation)
        {
            event.preventDefault();
            event.stopPropagation();
        }

        let item = event.target.closest(".MouseMenu .item");
        if (item && item.action) item.action(item);

        MouseMenu.root_element.classList.remove("displayed");
        document.body.removeEventListener("click", this.#boundedHide, true);
        document.body.removeEventListener("contextmenu", this.#boundedHide, true);
    }

    display(items, x, y) {

        if (MouseMenu.root_element.classList.contains("displayed")) {
            this.#hide();
            return;
        }

        document.body.addEventListener("click", this.#boundedHide, true);
        document.body.addEventListener("contextmenu", this.#boundedHide, true);

        MouseMenu.root_element.innerHTML = "";

        var item;

        items.forEach(itemDatas => {
            item = document.createElement("div");
            item.classList.add("item");
            item.innerHTML = itemDatas.label;
            item.action = itemDatas.action;
            if (itemDatas.icon) item.innerHTML += '<img src="assets/images/' + itemDatas.icon + '" />';

            MouseMenu.root_element.appendChild(item);

            if (itemDatas.sep) {
                let sep = document.createElement("div");
                sep.classList.add("sep");
                MouseMenu.root_element.appendChild(sep);
            }
        });

        MouseMenu.root_element.classList.add("displayed");

        // Menu positioning
        var bounding = document.body.getBoundingClientRect();

        if (x + MouseMenu.root_element.clientWidth > bounding.width - 10)
            x = bounding.width - 10 - MouseMenu.root_element.clientWidth;

        if (y + MouseMenu.root_element.clientHeight > bounding.height - 10)
            y = bounding.height - 10 - MouseMenu.root_element.clientHeight;

        MouseMenu.root_element.style.left = x + "px";
        MouseMenu.root_element.style.top = y + "px";
    }
}