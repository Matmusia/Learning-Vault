const fs = require('fs'), path = require('path'),
    Tag = require('./Tag'),
    Section = require('./Section');

module.exports = class Result {

    static getLvDatas(path) {
        try {
            const data = fs.readFileSync(path + "/.lv", 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') return null;
            else throw error;
        }
    }

    /** @type {Section} */
    _section
    _element

    constructor(section) {
        this._section = section;
    }

    _getIconName(extention) {
        extention = extention.toLowerCase();
        if (extention == ".jpg" || extention == ".jpeg" || extention == ".png" || extention == ".gif") return "image";
        else if (extention == ".mp4" || extention == ".flv" || extention == ".avi" || extention == ".wmv" || extention == ".flv" || extention == ".m4v") return "video";
        else if (extention == ".youtube") return "youtube";
        else if (extention == ".zip" || extention == ".rar") return "zip";
        else if (extention == ".pdf") return "pdf";
        else if (extention == ".psd") return "psd";
        else if (extention == ".abr") return "brush";
        else if (extention == ".url") return "url";
        else if (extention == ".txt" || extention == ".doc" || extention == ".docx" || extention == ".rtf") return "text";
        else return "file";
    }

    toElement() { return this._element; }
};