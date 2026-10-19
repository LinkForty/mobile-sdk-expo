/**
 * Reduce a locale identifier to `language` or `language-REGION`.
 *
 * Platforms report locales in several shapes: BCP 47 tags with script and
 * extension subtags (`en-ES-u-fw-mon-mu-celsius` on Android with regional
 * preferences, `zh-Hans-CN`), ICU identifiers with keywords
 * (`en_GB@rg=eszzzz`), and POSIX names (`en_US.UTF-8`). The fingerprint only
 * needs the language and region, in the same shape a browser sends:
 *
 *   en-ES-u-fw-mon-mu-celsius → en-ES
 *   en_GB@rg=eszzzz           → en-GB
 *   zh-Hans-CN                → zh-CN
 *   es-419                    → es-419
 *
 * Returns undefined for anything that does not start with a 2–3 letter
 * language subtag.
 */
export function normalizeLanguageTag(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const subtags = value.trim().split(/[@.#]/)[0].split(/[-_]/);
  const language = subtags[0];
  if (!/^[a-z]{2,3}$/i.test(language)) return undefined;

  let region: string | undefined;
  for (const subtag of subtags.slice(1)) {
    // A single-character subtag starts an extension or private-use section.
    if (subtag.length <= 1) break;
    if (/^[a-z]{2}$/i.test(subtag) || /^\d{3}$/.test(subtag)) {
      region = subtag.toUpperCase();
      break;
    }
  }
  return region ? `${language.toLowerCase()}-${region}` : language.toLowerCase();
}

/**
 * The device language for the fingerprint, from an expo-localization locale:
 * its language and region codes when both are usable, else its normalized
 * language tag.
 */
export function languageFromLocale(
  locale: { languageTag?: string | null; languageCode?: string | null; regionCode?: string | null } | undefined
): string | undefined {
  if (!locale) return undefined;
  const { languageCode, regionCode } = locale;
  if (
    typeof languageCode === 'string' &&
    /^[a-z]{2,3}$/i.test(languageCode) &&
    typeof regionCode === 'string' &&
    (/^[a-z]{2}$/i.test(regionCode) || /^\d{3}$/.test(regionCode))
  ) {
    return `${languageCode.toLowerCase()}-${regionCode.toUpperCase()}`;
  }
  return normalizeLanguageTag(locale.languageTag);
}
