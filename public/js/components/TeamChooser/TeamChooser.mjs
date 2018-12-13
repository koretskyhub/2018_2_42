'use strict';

import tmpl from  "./TeamChooser.tmpl.xml"
import TEAMS from "../../modules/game/core/teams.js";

export default class TeamChooserComponent {
    constructor({ el = document.body } = {}) {
        this._el = el;
    }

    render() {
        const data = {};
        const template = tmpl(data);
        let div = document.createElement('div');
        div.innerHTML = template;
        this._el.appendChild(div.firstChild);
    }
}