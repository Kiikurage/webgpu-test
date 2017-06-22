import * as dom from "./dom";

export enum State {
    SETUP,
    READY,
    RUNNING
}

export enum Result {
    NONE,
    SUCCESS,
    FAILED
}

const tests = new Map<string, (playground: Playground) => Promise<void>>();

export default class Playground {
    private $runButton: HTMLButtonElement;
    private $log: HTMLDivElement;

    private _state: State = State.SETUP;
    private _result: Result = Result.NONE;
    private testId: string;

    get state() {return this._state}

    get result() {return this._result}

    constructor(protected $base: HTMLDivElement) {
        this.$runButton = dom.querySelector<HTMLButtonElement>($base, '.Playground-Run');
        this.$runButton.disabled = this.state !== State.READY;
        this.$runButton.addEventListener('click', () => this.onRunButtonClick());

        this.$log = dom.querySelector<HTMLDivElement>($base, '.Playground-Log');

        this.testId = $base.dataset['test'] || '';

        this.setupAsync()
            .then(() => this.setState(State.READY));
    }

    protected async setupAsync() {}

    protected setState(newState: State) {
        this.$runButton.disabled = newState !== State.READY;
        this.$base.classList.toggle('Playground-state-setup', newState === State.SETUP);
        this.$base.classList.toggle('Playground-state-ready', newState === State.READY);
        this.$base.classList.toggle('Playground-state-running', newState === State.RUNNING);

        this._state = newState;
    }

    protected onRunButtonClick() {
        this.run();
    }

    protected onTestFinish(result: Result, data: any) {
        this.$base.classList.toggle('Playground-result-success', result === Result.SUCCESS);
        this.$base.classList.toggle('Playground-result-failed', result === Result.FAILED);

        switch (result) {
            case Result.FAILED:
                this.print((data as Error).message);
                break;
        }

        this.setState(State.READY);
        this._result = result;
    }

    print(text: string) {
        this.$log.innerText += text + '\n';
    }

    async run() {
        if (this.state !== State.READY) return;
        this.setState(State.RUNNING);

        if (!tests.has(this.testId)) {
            return this.onTestFinish(Result.FAILED, new Error(`Test '${this.testId}' is not found.`));
        }
        let func = tests.get(this.testId)!;

        try {
            await func(this);
        } catch (e) {
            return this.onTestFinish(Result.FAILED, e);
        }

        return this.onTestFinish(Result.SUCCESS, null);
    }
}

export function registerTest(testId: string, func: (playground: Playground) => Promise<void>) {
    tests.set(testId, func);
}