
module.exports = class Parameters {

    static #element
    static #folder_input
    static #folder_label

    static #root_folder

    static #root_folder_change_callbacks = []

    static #create_element() {
        this.#element = document.createElement('div');
        this.#element.classList.add('parameters');
        this.#element.innerHTML = "<div class='inner_container'><h1>Paramètres</h1></div>";

        let container = this.#element.querySelector(".inner_container");

        container.innerHTML += '<p><span class="label">Dossier racine : </span><label class="" for="root_folder_input"></label></p>';
        container.innerHTML += '<div class="buttons"><p class="button close">Fermer</p></div>';

        this.#folder_input = document.createElement('input');
        this.#folder_input.setAttribute('id', 'root_folder_input');
        this.#folder_input.setAttribute('type', 'file');
        this.#folder_input.setAttribute('nwdirectory', '');
        container.append(this.#folder_input);

        this.#folder_label = container.querySelector('label');

        container.addEventListener('click', event => {
            let target;

            if (target = event.target.closest('.close')) {
                this.close();

                for (const callback of this.#root_folder_change_callbacks) callback(this.#root_folder);
            }
        });

        this.#folder_input.addEventListener('change', event => {

            this.#folder_label.innerHTML = this.#folder_input.value.replace(/\\/g, ' \\ ');
            this.#root_folder = this.#folder_input.value;

            localStorage.setItem('root_folder', this.#root_folder);
        });
    }

    static get_root_folder() {
        return this.#root_folder;
    }

    static init() {

        // localStorage.clear();

        this.#root_folder = localStorage.getItem('root_folder');

        this.#create_element();

        return this.#root_folder;
    }

    static on_root_folder_change(callback) {
        this.#root_folder_change_callbacks.push(callback);
    }

    static open() {

        if (this.#root_folder) {
            this.#folder_input.setAttribute('nwworkingdir', this.#root_folder);

            this.#folder_label.innerHTML = this.#root_folder.replace(/\\/g, ' \\ ');
        }
        else this.#folder_label.innerHTML = "Choisir un dossier ...";

        document.body.append(this.#element);
    }

    static close() {

        this.#element.remove();
    }

}