const fs = require('fs'), path = require('path');
const PostitSection = require('./PostitSection');

module.exports = class VideoPlayer {

    // FIXME Issue when toggling play/pause of a youtube video in PIP mode
    // TODO Store some kind of play history to display on Overview section !!!

    #root_element
    #current_result_element
    #current_file_path

    #standalone_button

    #html5Player_element
    #youtubePlayer // Object from youtube
    #youtubePlayer_element

    #currentVideoType

    #saving_timestamp_interval_id
    #stored_playing_time

    #shortcuts_are_registred = false
    #shortcut_media_play_pause

    constructor() {
        // Load css files
        try {
            let css = fs.readFileSync(path.join(__dirname, "VideoPlayer.css"), 'utf8');
            let styleElem = document.createElement("style");
            styleElem.innerHTML = css;
            document.head.appendChild(styleElem);
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la lecture du fichier '" + path.join(__dirname, "VideoPlayer.html") + "'");
            return;
        }

        // Load stored playing time
        try {
            this.#stored_playing_time = JSON.parse(fs.readFileSync(path.join(__dirname, "../datas/playing_times.json"), 'utf8'));
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la lecture du fichier '" + path.join(__dirname, "../datas/playing_times.json") + "'");
            return;
        }

        // Create root element
        this.#root_element = document.createElement("div");
        this.#root_element.id = "video_player";
        document.body.appendChild(this.#root_element);

        // this.#root_element.classList.add("displayed");
        this.#root_element.classList.add("interfaceIsDisplayed");

        // Load HTML content
        try {
            this.#root_element.innerHTML = fs.readFileSync(path.join(__dirname, "VideoPlayer.html"), 'utf8');
            this.#html5Player_element = this.#root_element.querySelector(".html5Player");
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la lecture du fichier '" + path.join(__dirname, "VideoPlayer.html") + "'");
            return;
        }

        // Move standalone_button element to main frame
        this.#standalone_button = this.#root_element.querySelector(".standalone_button");
        document.body.appendChild(this.#standalone_button);

        // STANDALONE BUTTON events handling
        this.#standalone_button.addEventListener("click", event => {
            let target;

            // Play / Pause button
            if (target = event.target.closest(".button.play_pause")) this.togglePlayPause();

            else if (target = event.target.closest(".button.add_postit")) this.#display_add_postit_floating_form();

            // Close Button
            else if (target = event.target.closest(".button.close")) this.close();

            // Main button
            else {
                if (document.pictureInPictureElement) document.exitPictureInPicture();
                this.#root_element.classList.remove("minimized");
                this.#root_element.classList.remove("pipMode");
            }
        });

        // VIDEO PLAYER events handling
        let cooldownTimerId,
            onMove = event => {
                clearTimeout(cooldownTimerId);
                this.#root_element.classList.add("interfaceIsDisplayed");
                cooldownTimerId = setTimeout(() => { this.#root_element.classList.remove("interfaceIsDisplayed") }, 2000);
            };

        this.#root_element.addEventListener("mousemove", onMove);

        this.#root_element.querySelector(".topbar").addEventListener("click", event => {
            let target;

            // Close button
            if (target = event.target.closest(".button_close")) this.close();

            // Add Post-it button
            else if (target = event.target.closest(".button_add_postit")) this.#display_add_postit_floating_form();

            // Minimize button
            else if (target = event.target.closest(".button_minimize")) this.#root_element.classList.add("minimized");

            // PIP mode button
            else if (target = event.target.closest(".button_pip")) {
                if (this.#currentVideoType === "html5") {
                    this.#html5Player_element.requestPictureInPicture();
                }
                else {
                    this.#youtubePlayer_element.contentDocument.querySelector("video").requestPictureInPicture();
                }
            }
            // Any other spot (play/pause)
            else this.togglePlayPause();
        });

        let enterPip = event => { this.#root_element.classList.add("pipMode"); }
        let leavePip = event => { this.#root_element.classList.remove("pipMode"); }

        this.#html5Player_element.addEventListener("enterpictureinpicture", enterPip);
        this.#html5Player_element.addEventListener("leavepictureinpicture", leavePip);
        this.#html5Player_element.onended = this.#html5Player_element.onpause = () => { this.#updatePlayingState(0) };
        this.#html5Player_element.onplay = () => { this.#updatePlayingState(1) };

        // Load Youtube API
        var youtubeApiScriptElem = document.createElement('script');
        youtubeApiScriptElem.src = "https://www.youtube.com/player_api";
        document.head.appendChild(youtubeApiScriptElem);

        window.onYouTubeIframeAPIReady = () => {
            this.#youtubePlayer = new YT.Player('youtubeEmbededPlayer', {
                height: '360',
                width: '640',
                events: {
                    'onReady': () => {
                        this.#youtubePlayer_element.contentDocument.querySelector("video").addEventListener("enterpictureinpicture", enterPip);
                        this.#youtubePlayer_element.contentDocument.querySelector("video").addEventListener("leavepictureinpicture", leavePip);
                    },
                    'onStateChange': event => {
                        // Playing
                        if (event.data === 1) this.#updatePlayingState(1);
                        // Pausing or Stoping
                        else if (event.data === 2 || event.data === 0) this.#updatePlayingState(0);
                    }
                }
            });

            this.#youtubePlayer_element = this.#root_element.querySelector(".youtubeEmbededPlayer");
            this.#youtubePlayer_element.addEventListener("mousemove", onMove);
        }

        // Create global shortcuts to register
        this.#shortcut_media_play_pause = new nw.Shortcut({
            key: "MediaPlayPause",
            active: () => { this.togglePlayPause(); },
            failed: (msg) => { alert(msg); }
        });
    }

    #display_add_postit_floating_form() {
        let time_stamp;

        switch (this.#currentVideoType) {
            case 'html5':
                time_stamp = this.#html5Player_element.currentTime;
                break

            case 'youtube':
                time_stamp = this.#youtubePlayer.getCurrentTime();
                break;
        }

        PostitSection.display_new_post_floating_form(this.#current_file_path, true, time_stamp);
    }

    get_stored_playing_time(file_path) {

        if (this.#stored_playing_time[this.#current_file_path] < 20) delete this.#stored_playing_time[this.#current_file_path];

        return this.#stored_playing_time[file_path];
    }

    #store_playing_time() {

        this.#stored_playing_time[this.#current_file_path] = (this.#currentVideoType === 'html5') ? this.#html5Player_element.currentTime : this.#youtubePlayer.getCurrentTime();

        if (this.#stored_playing_time[this.#current_file_path] < 20) {
            delete this.#stored_playing_time[this.#current_file_path];

            if (this.#current_result_element) this.#current_result_element.querySelector('.from_start_button').classList.remove('displayed');
        }

        else if (this.#current_result_element) this.#current_result_element.querySelector('.from_start_button').classList.add('displayed');

        try {
            fs.writeFileSync(path.join(__dirname, "../datas/playing_times.json"), JSON.stringify(this.#stored_playing_time));
        } catch (err) {
            // console.error(err);
            alert("Problème lors de la sauvegarde du fichier " + path.join(__dirname, "../datas/playing_times.json") + "");
        }
    }

    #updatePlayingState(state) {

        if (state === 0) {
            this.#standalone_button.classList.remove("playing");
            clearInterval(this.#saving_timestamp_interval_id);
            this.#store_playing_time();
        }
        else {
            this.#standalone_button.classList.add("playing");
            this.#saving_timestamp_interval_id = setInterval(this.#store_playing_time.bind(this), 5000);
        }
    }

    open(filePath, time_stamp, result_element) {

        this.#current_result_element = result_element;
        this.#current_file_path = filePath;

        this.#root_element.querySelector(".video_title").innerHTML = path.basename(filePath);

        this.#html5Player_element.classList.add("hidden");
        this.#youtubePlayer_element.classList.add("hidden");

        // Youtube video
        if (path.extname(filePath) === ".youtube") {

            try {
                let videoDatas = fs.readFileSync(path.join(ROOT_FOLDER, filePath), 'utf8');
                videoDatas = JSON.parse(videoDatas);

                if (time_stamp) this.#youtubePlayer.loadVideoById(videoDatas.videoId, time_stamp);
                else if (videoDatas.startTime && time_stamp !== 0) this.#youtubePlayer.loadVideoById(videoDatas.videoId, videoDatas.startTime);
                else if (this.#stored_playing_time[filePath] && time_stamp !== 0) this.#youtubePlayer.loadVideoById(videoDatas.videoId, this.#stored_playing_time[filePath]);
                else this.#youtubePlayer.loadVideoById(videoDatas.videoId);

                this.#root_element.classList.add("displayed");
                this.#standalone_button.classList.add("displayed");
                this.#currentVideoType = "youtube";

                this.#youtubePlayer_element.classList.remove("hidden");
            } catch (err) {
                alert(err);
                return;
            }
        }
        // Local Video file
        else {
            let source = this.#html5Player_element.querySelector("source");

            source.setAttribute("src", path.join(ROOT_FOLDER, filePath));
            // source.setAttribute("type", "video/mp4");

            this.#root_element.classList.add("displayed");
            this.#standalone_button.classList.add("displayed");

            this.#html5Player_element.load();
            this.#html5Player_element.play();

            if (time_stamp === 0) this.#html5Player_element.currentTime = 0;
            else if (time_stamp) this.#html5Player_element.currentTime = time_stamp;
            else if (this.#stored_playing_time[filePath]) this.#html5Player_element.currentTime = this.#stored_playing_time[filePath];

            this.#html5Player_element.classList.remove("hidden");
            this.#currentVideoType = "html5";
        }

        // Register golobal shortcuts
        if (this.#shortcuts_are_registred === false) {
            this.#shortcuts_are_registred = true;
            nw.App.registerGlobalHotKey(this.#shortcut_media_play_pause);
        }
    }

    close() {

        clearInterval(this.#saving_timestamp_interval_id);
        this.#store_playing_time();

        this.#root_element.classList.remove("displayed");
        this.#standalone_button.classList.remove("displayed");

        if (document.pictureInPictureElement) document.exitPictureInPicture();
        this.#root_element.classList.remove("minimized");
        this.#root_element.classList.remove("pipMode");

        switch (this.#currentVideoType) {
            case 'html5':
                let source = this.#html5Player_element.querySelector("source");

                this.#html5Player_element.pause();
                source.setAttribute("src", "");
                this.#html5Player_element.load();
                break

            case 'youtube':
                this.#youtubePlayer.stopVideo();
                this.#youtubePlayer.clearVideo();
                break;
        }

        // Unregister golobal shortcuts
        if (this.#shortcuts_are_registred) {
            this.#shortcuts_are_registred = false;
            nw.App.unregisterGlobalHotKey(this.#shortcut_media_play_pause);
        }
    }

    togglePlayPause() {
        if (this.#currentVideoType === "html5") {
            if (this.#html5Player_element.paused) this.#html5Player_element.play();
            else this.#html5Player_element.pause();
        }
        else {
            if (this.#youtubePlayer.getPlayerState() === 1) this.#youtubePlayer.pauseVideo();
            else this.#youtubePlayer.playVideo();
        }
    }

    get_playback_history() {
        return this.#stored_playing_time;
    }
}