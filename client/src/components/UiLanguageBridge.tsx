import { useEffect, useRef } from "react";
import { useLanguage, translations } from "@/contexts/LanguageContext";
import { uiLiteralTranslations } from "@/lib/ui-literal-translations";

const translatableAttributes = ["placeholder", "title", "aria-label", "alt"] as const;
type TranslatableAttribute = typeof translatableAttributes[number];

function translateLiteral(value: string, language: "pt" | "en") {
  if (language === "pt") return value;
  // JSX whitespace is often split across text nodes. The catalogue stores a
  // compact representation, so consult that canonical key before leaving text
  // in Portuguese in the English experience.
  const compact = value.replace(/\s+/g, " ").trim();
  return uiLiteralTranslations[value] || translations[value]?.en || uiLiteralTranslations[compact] || translations[compact]?.en || value;
}

/**
 * Provides a safe migration path for historic JSX labels that were written directly
 * rather than sent through t(). It only replaces exact, known interface literals.
 * Dynamic domain content, user input and regulatory text are untouched.
 */
export function UiLanguageBridge() {
  const { language } = useLanguage();
  const textOrigins = useRef(new WeakMap<Text, string>());
  const attributeOrigins = useRef(new WeakMap<Element, Partial<Record<TranslatableAttribute, string>>>());

  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;

    const translateText = (node: Text) => {
      const source = textOrigins.current.get(node) ?? node.data;
      if (!textOrigins.current.has(node)) textOrigins.current.set(node, source);
      const translated = translateLiteral(source, language);
      if (node.data !== translated) node.data = translated;
    };

    const translateAttributes = (element: Element) => {
      const saved = attributeOrigins.current.get(element) || {};
      let changed = false;
      for (const name of translatableAttributes) {
        const current = element.getAttribute(name);
        if (current === null) continue;
        const source = saved[name] ?? current;
        if (saved[name] === undefined) {
          saved[name] = source;
          changed = true;
        }
        const translated = translateLiteral(source, language);
        if (current !== translated) element.setAttribute(name, translated);
      }
      if (changed) attributeOrigins.current.set(element, saved);
    };

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) translateText(node as Text);
      if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as Element;
        if (element.tagName !== "SCRIPT" && element.tagName !== "STYLE") translateAttributes(element);
      }
      node.childNodes.forEach(walk);
    };

    const translateAdded = (node: Node) => walk(node);
    walk(root);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") translateText(mutation.target as Text);
        mutation.addedNodes.forEach(translateAdded);
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [language]);

  return null;
}

export default UiLanguageBridge;
