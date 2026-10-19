type Dictionary = Record<string, string>;
export type TranslationValues = Record<string, string | number>;
const token = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Translate exact UI copy and known formatted validation messages. Unknown text stays unchanged. */
export function createTranslator(dictionary: Dictionary, language: 'en' | 'vi') {
  const patterns = Object.entries(dictionary).filter(([key]) => /\{p[0-9]+\}/.test(key)).map(([key, target]) => {
    const names: string[] = [];
    let last = 0, pattern = '^';
    for (const match of key.matchAll(token)) {
      pattern += escape(key.slice(last, match.index)) + '([\\s\\S]*?)';
      names.push(match[1]); last = match.index! + match[0].length;
    }
    return { expression: new RegExp(pattern + escape(key.slice(last)) + '$'), names, target, weight: key.replace(token, '').length };
  }).sort((a, b) => b.weight - a.weight);
  const exact = (source: string) => Object.prototype.hasOwnProperty.call(dictionary, source) ? dictionary[source] : source;
  const translate = (input: string | number | null | undefined, values?: TranslationValues, depth = 0): string => {
    const source = String(input ?? '');
    let translated = exact(source);
    if (translated === source && !Object.prototype.hasOwnProperty.call(dictionary, source)) {
      for (const pattern of patterns) {
        const match = pattern.expression.exec(source);
        if (match) {
          const captured = Object.fromEntries(pattern.names.map((name, index) => [name, depth < 2 ? translate(match[index + 1], undefined, depth + 1) : exact(match[index + 1])]));
          translated = pattern.target.replace(token, (placeholder, name: string) => captured[name] ?? placeholder);
          break;
        }
      }
    }
    if (language === 'vi' && translated === source) {
      const date = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([0-9]{1,2}), ([0-9]{4})(.*)$/.exec(source);
      if (date) translated = date[2].padStart(2, '0') + '/' + String(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(date[1]) + 1).padStart(2, '0') + '/' + date[3] + date[4];
    }
    return translated.replace(token, (placeholder, name: string) => values?.[name] === undefined ? placeholder : String(values[name]));
  };
  return (input: string | number | null | undefined, values?: TranslationValues) => translate(input, values);
}
