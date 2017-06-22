export function getElementById<T>(id: string) {
    let node = document.getElementById(id) as T | null;
    if (!node) throw Error(`#${id} is not found.`);

    return node
}

export function querySelector<T>(element: HTMLElement = document.body, query: string) {
    let node = element.querySelector(query) as T | null;
    if (!node) throw Error(`${query} is not found.`);

    return node
}

export function querySelectorAll<T extends Element>(element: HTMLElement = document.body, query: string) {
    let nodes = element.querySelectorAll(query) as NodeListOf<T>;

    return Array.from(nodes);
}
