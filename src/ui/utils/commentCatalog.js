import commentsEn from "../../i18n/comments_en.json";
import commentsJa from "../../i18n/comments_ja.json";

const catalogMap = {
  en: commentsEn,
  ja: commentsJa,
};

export function getCatalog(lang = "en") {
  const normalized = lang?.toLowerCase()?.slice(0, 2);
  return catalogMap[normalized] ?? catalogMap.en;
}

export function getComment(key, lang = "en") {
  const catalog = getCatalog(lang);
  return catalog[key] ?? "";
}

export function formatComment(key, data = {}, lang = "en") {
  const template = getComment(key, lang);
  return template.replace(/\{(\w+)\}/g, (_, token) =>
    token in data ? `${data[token]}` : `{${token}}`
  );
}
