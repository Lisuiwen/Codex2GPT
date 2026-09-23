const COMPOSER_SELECTORS = [
  "#prompt-textarea",
  '[contenteditable="true"][data-lexical-editor="true"]',
  "textarea"
] as const;

const SEND_BUTTON_SELECTORS = [
  'button[data-testid="send-button"]',
  'button[aria-label="Send prompt"]',
  'button[aria-label="Send"]'
] as const;

const STOP_BUTTON_SELECTORS = [
  'button[data-testid="stop-button"]',
  'button[aria-label="Stop generating"]',
  'button[aria-label="Stop"]'
] as const;

const ASSISTANT_SELECTOR = '[data-message-author-role="assistant"]';

export class ChatGptAdapter {
  async execute(prompt: string, timeoutMs: number): Promise<string> {
    const startedAt = Date.now();
    const assistantCountBefore =
      document.querySelectorAll(ASSISTANT_SELECTOR).length;

    const composer = await this.waitForElement(COMPOSER_SELECTORS, 20_000);
    this.writePrompt(composer, prompt);

    const sendButton = await this.waitForElement(SEND_BUTTON_SELECTORS, 10_000);
    (sendButton as HTMLElement).click();

    return this.waitForResponse(
      assistantCountBefore,
      Math.max(1_000, timeoutMs - (Date.now() - startedAt))
    );
  }

  private writePrompt(element: Element, text: string): void {
    if (
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLInputElement
    ) {
      const prototype = element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;

      const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
      descriptor?.set?.call(element, text);
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.focus();
      return;
    }

    const htmlElement = element as HTMLElement;
    htmlElement.focus();
    htmlElement.textContent = text;
    htmlElement.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text
      })
    );
  }

  private waitForResponse(previousCount: number, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      let lastText = "";
      let stableSince = Date.now();

      const tick = () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("Timed out waiting for ChatGPT response"));
          return;
        }

        const assistants = Array.from(document.querySelectorAll(ASSISTANT_SELECTOR));
        const latest = assistants.at(-1) as HTMLElement | undefined;
        const hasNewAssistant = assistants.length > previousCount;
        const text = latest?.innerText?.trim() ?? "";

        if (text !== lastText) {
          lastText = text;
          stableSince = Date.now();
        }

        const generating = this.hasAny(STOP_BUTTON_SELECTORS);
        const stableForMs = Date.now() - stableSince;

        if (hasNewAssistant && text.length > 0 && !generating && stableForMs >= 1_200) {
          resolve(text);
          return;
        }

        setTimeout(tick, 250);
      };

      tick();
    });
  }

  private async waitForElement(
    selectors: readonly string[],
    timeoutMs: number
  ): Promise<Element> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) return element;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`ChatGPT DOM element not found: ${selectors.join(", ")}`);
  }

  private hasAny(selectors: readonly string[]): boolean {
    return selectors.some((selector) => document.querySelector(selector) != null);
  }
}
