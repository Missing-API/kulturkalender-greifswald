/* eslint-disable @schafevormfenster/one-function-per-file -- Vendored module: functions kept together to match upstream source */
/**
 * Vendored subset of @schafevormfenster/data-text-mapper (0.2.3).
 *
 * The published dist uses `require("url-regex-safe")` at module-evaluation
 * time, which Turbopack rejects. Only `dataToText` and `dataToHtml` are
 * needed and they have zero external dependencies, so we vendor them here.
 *
 * Keep in sync with: https://github.com/schafevormfenster/events-api/tree/master/packages/data-text-mapper
 */

export interface TextWithData {
  description: string;
  url?: string;
  tags?: string[];
  scopes?: string[];
  image?: string;
  document?: string;
}

function cleanSpaces(text: string): string {
  let r = text;
  r = r.replaceAll("\r\n", "\n");
  r = r.replaceAll("\r", "\n");
  r = r.replaceAll(/\n{2,}/g, "\n\n");
  r = r.replaceAll(/ +/g, " ");
  return r.trim();
}

function containsHtml(text: string): boolean {
  if (!text) return false;
  return /(<[a-z][^>]*>.*?<\/[a-z][^>]*>)|(<[a-z][^>]*\/>)/gi.test(text);
}

export function dataToText(data: TextWithData): string {
  const text = cleanSpaces(data.description);
  const image = data.image || null;
  const document = data.document || null;
  const url = data.url || null;
  const tags = data.tags?.map((t) => "#" + t).join(" ") || null;
  const scopes = data.scopes?.map((s) => "@" + s).join(" ") || null;
  const tagScopeLine =
    tags || scopes ? [tags, scopes].filter(Boolean).join(" ") : null;
  return [text, image, document, url, tagScopeLine]
    .filter((line) => line !== null)
    .join("\n\n");
}

export function dataToHtml(data: TextWithData): string {
  let descriptionBlock: string;
  const cleaned = cleanSpaces(data.description);
  if (containsHtml(cleaned)) {
    descriptionBlock = `<div class="p-description">${cleaned}</div>`;
  } else {
    const paragraphs = cleaned
      .split("\n\n")
      .map((p) => p.replaceAll("\n", "<br>"))
      .map((p) => `<p>${p}</p>`)
      .join("");
    descriptionBlock = `<div class="p-description">${paragraphs}</div>`;
  }
  const imageLine = data.image
    ? `<img class="u-photo" src="${data.image}" />`
    : null;
  const documentLine = data.document
    ? `<p class="attachment"><a class="u-document" href="${data.document}">${data.document}</a></p>`
    : null;
  const urlLine = data.url
    ? `<p class="link"><a class="u-url" href="${data.url}">${data.url}</a></p>`
    : null;
  const tags =
    data.tags
      ?.map((tag) => `<span class="p-category">#${tag}</span>`)
      .join(" ") || null;
  const scopes =
    data.scopes
      ?.map((scope) => `<span class="p-scope">@${scope}</span>`)
      .join(" ") || null;
  const tagScopeLine =
    tags || scopes
      ? '<p class="taxonomy">' +
        [tags, scopes].filter((item) => item !== null).join(" ") +
        "</p>"
      : null;
  const body = [descriptionBlock, imageLine, documentLine, urlLine, tagScopeLine]
    .filter((line) => line !== null)
    .join("");
  return `<!DOCTYPE html><html><body>${body}</body></html>`;
}
