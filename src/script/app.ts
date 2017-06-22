import * as dom from "./dom";
import Playground from "./playground";
import "./tests";

function initialize() {
    dom.querySelectorAll<HTMLDivElement>(document.body, ".Playground")
        .forEach($base => new Playground($base));
}

document.addEventListener('DOMContentLoaded', initialize);
