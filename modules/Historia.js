const Notification = require('./Notification');

const fs = require('fs'), fsp = fs.promises, path = require('path'),
    Tag = require('./Tag');

module.exports = class Historia {

    constructor() { }

    /**
     * 
     * @param {String} msg
     * @param {Function} cancel_action 
     */
    static add(msg, cancel_action) {
        let notif = new Notification(msg,
            {
                immediate_display: true,
                button1: {
                    label: "Annuler",
                    action: event => { if (typeof cancel_action === 'function') cancel_action(); }
                }
            });
    }
}